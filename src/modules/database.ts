import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface ActivityData {
  timestamp: string;
  project: string | undefined;
  file: string | undefined;
  duration: number; // em segundos
  isIdle?: boolean;
}

/**
 * Classe responsável por gerenciar o banco de dados SQLite
 */
export class DatabaseManager {
  private db: sqlite3.Database | undefined;

  /**
   * Inicializa o banco de dados SQLite
   */
  async initialize(storagePath: string): Promise<void> {
    const dbPath = path.join(storagePath, "time_tracker.sqlite");
    console.log(`Caminho do banco de dados: ${dbPath}`);

    // Garante que o diretório de armazenamento global exista
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err: Error | null) => {
        if (err) {
          vscode.window.showErrorMessage(
            localize('database.connectionError', 'Error connecting to SQLite: {0}', err.message)
          );
          console.error("Erro ao conectar ao SQLite:", err);
          return reject(err);
        }
        console.log("Conectado ao banco de dados SQLite.");

        // Cria a tabela se não existir
        this.db!.run(
          `CREATE TABLE IF NOT EXISTS time_entries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp TEXT NOT NULL,
              project TEXT,
              file TEXT,
              duration_seconds INTEGER NOT NULL,
              is_idle INTEGER DEFAULT 0,
              synced INTEGER DEFAULT 0, -- 0 para não sincronizado, 1 para sincronizado
              deleted_at TEXT DEFAULT NULL -- Soft delete: NULL = ativo, data = deletado
          )`,
          (tableErr: Error | null) => {
            if (tableErr) {
              vscode.window.showErrorMessage(
                localize('database.tableCreationError', 'Error creating table: {0}', tableErr.message)
              );
              console.error("Erro ao criar tabela:", tableErr);
              return reject(tableErr);
            }
            console.log('Tabela "time_entries" verificada/criada com sucesso.');
            
            // Migração: Adicionar coluna deleted_at se não existir
            this.db!.run(
              `ALTER TABLE time_entries ADD COLUMN deleted_at TEXT DEFAULT NULL`,
              (alterErr: Error | null) => {
                if (alterErr) {
                  // Coluna já existe, isso é esperado
                  if (alterErr.message.includes('duplicate column name')) {
                    console.log('✅ Coluna deleted_at já existe (migração já aplicada)');
                  } else {
                    console.warn('⚠️ Aviso ao adicionar coluna deleted_at:', alterErr.message);
                  }
                } else {
                  console.log('✅ Coluna deleted_at adicionada com sucesso (migração aplicada)');
                }
                
                // Criar tabela de histórico de exclusões
                this.db!.run(
                  `CREATE TABLE IF NOT EXISTS deletion_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    deleted_at TEXT NOT NULL,
                    records_count INTEGER NOT NULL,
                    deletion_type TEXT NOT NULL, -- 'soft' ou 'hard'
                    restored_at TEXT DEFAULT NULL -- NULL = não restaurado, data = restaurado
                  )`,
                  (historyErr: Error | null) => {
                    if (historyErr) {
                      console.error('❌ Erro ao criar tabela deletion_history:', historyErr);
                    } else {
                      console.log('✅ Tabela deletion_history verificada/criada com sucesso');
                    }
                    resolve();
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  /**
   * Salva dados de atividade no banco de dados
   */
  async saveActivityData(data: ActivityData): Promise<void> {
    if (!this.db) {
      console.error(
        "Banco de dados não inicializado. Não foi possível salvar os dados."
      );
      vscode.window.showWarningMessage(
        localize('database.notReady', 'Time Tracking: Database is not ready.')
      );
      return;
    }

    console.log("Salvando dados localmente:", data);
    const { timestamp, project, file, duration, isIdle } = data;

    const stmt = this.db.prepare(
      "INSERT INTO time_entries (timestamp, project, file, duration_seconds, is_idle) VALUES (?, ?, ?, ?, ?)"
    );
    
    return new Promise((resolve, reject) => {
      stmt.run(
        timestamp,
        project || "Arquivos Diversos",
        file || "unknown-file",
        duration,
        isIdle ? 1 : 0,
        (error: Error | null) => {
          if (error) {
            console.error("Erro ao inserir dados no SQLite:", error);
            vscode.window.showErrorMessage(
              localize('database.saveError', 'Error saving data: {0}', error.message)
            );
            reject(error);
          } else {
            console.log("Dados salvos localmente com sucesso.");
            resolve();
          }
          stmt.finalize();
        }
      );
    });
  }

  /**
   * Executa uma consulta SQL
   */
  query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }

      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Deleta todos os registros de tempo de um projeto específico (SOFT DELETE)
   * Marca como deletado em vez de remover permanentemente
   * @param projectName Nome do projeto a ser deletado
   * @returns Número de registros marcados como deletados
   */
  async deleteProjectHistory(projectName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      // SOFT DELETE: Marca como deletado com timestamp
      const sql = `UPDATE time_entries SET deleted_at = datetime('now') WHERE project = ? AND deleted_at IS NULL`;
      
      console.log(`🗑️ Executando SOFT DELETE para projeto: ${projectName}`);
      
      const self = this; // Captura contexto para usar dentro do callback
      
      this.db.run(sql, [projectName], function(err: Error | null) {
        if (err) {
          console.error(`❌ Erro ao deletar projeto ${projectName}:`, err);
          reject(err);
        } else {
          // this.changes retorna o número de linhas afetadas (contexto do SQLite)
          const deletedCount = this.changes;
          console.log(`✅ ${deletedCount} registro(s) marcado(s) como deletado(s) do projeto ${projectName}`);
          
          // Registrar no histórico de exclusões
          self.logDeletion(projectName, deletedCount, 'soft')
            .then(() => resolve(deletedCount))
            .catch((historyErr: Error) => {
              console.warn('⚠️ Erro ao registrar histórico, mas exclusão foi bem-sucedida:', historyErr);
              resolve(deletedCount); // Exclusão funcionou, apenas o log falhou
            });
        }
      });
    });
  }

  /**
   * Deleta PERMANENTEMENTE os registros de um projeto
   * Usar apenas para limpeza definitiva
   * @param projectName Nome do projeto
   * @returns Número de registros deletados permanentemente
   */
  async hardDeleteProjectHistory(projectName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      // HARD DELETE: Remove permanentemente apenas projetos que já estão soft-deleted
      const sql = `DELETE FROM time_entries WHERE project = ? AND deleted_at IS NOT NULL`;
      
      console.log(`💥 Executando HARD DELETE para projeto: ${projectName}`);
      
      const self = this;
      
      this.db.run(sql, [projectName], function(err: Error | null) {
        if (err) {
          console.error(`❌ Erro ao deletar permanentemente projeto ${projectName}:`, err);
          reject(err);
        } else {
          const deletedCount = this.changes;
          console.log(`✅ ${deletedCount} registro(s) deletado(s) PERMANENTEMENTE do projeto ${projectName}`);
          
          // Registrar no histórico de exclusões
          self.logDeletion(projectName, deletedCount, 'hard')
            .then(() => resolve(deletedCount))
            .catch((historyErr: Error) => {
              console.warn('⚠️ Erro ao registrar histórico, mas exclusão foi bem-sucedida:', historyErr);
              resolve(deletedCount);
            });
        }
      });
    });
  }

  /**
   * Restaura um projeto que foi deletado (soft delete)
   * @param projectName Nome do projeto a restaurar
   * @returns Número de registros restaurados
   */
  async restoreProjectHistory(projectName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      const sql = `UPDATE time_entries SET deleted_at = NULL WHERE project = ? AND deleted_at IS NOT NULL`;
      
      console.log(`♻️ Restaurando projeto: ${projectName}`);
      
      const self = this;
      
      this.db.run(sql, [projectName], function(err: Error | null) {
        if (err) {
          console.error(`❌ Erro ao restaurar projeto ${projectName}:`, err);
          reject(err);
        } else {
          const restoredCount = this.changes;
          console.log(`✅ ${restoredCount} registro(s) restaurado(s) do projeto ${projectName}`);
          
          // Registrar restauração no histórico
          self.logRestoration(projectName)
            .then(() => resolve(restoredCount))
            .catch((historyErr: Error) => {
              console.warn('⚠️ Erro ao registrar restauração, mas operação foi bem-sucedida:', historyErr);
              resolve(restoredCount);
            });
        }
      });
    });
  }

  /**
   * Lista projetos deletados (soft delete)
   * @returns Array de nomes de projetos deletados
   */
  async getDeletedProjects(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      const sql = `
        SELECT DISTINCT project
        FROM time_entries 
        WHERE deleted_at IS NOT NULL
        GROUP BY project
        ORDER BY MAX(deleted_at) DESC
      `;
      
      this.db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          // Extrai apenas os nomes dos projetos
          const projectNames = rows.map((row: any) => row.project);
          resolve(projectNames);
        }
      });
    });
  }

  /**
   * Registra uma exclusão no histórico
   * @param projectName Nome do projeto deletado
   * @param recordsCount Quantidade de registros afetados
   * @param deletionType Tipo de exclusão ('soft' ou 'hard')
   */
  private async logDeletion(projectName: string, recordsCount: number, deletionType: 'soft' | 'hard'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      const sql = `
        INSERT INTO deletion_history (project_name, deleted_at, records_count, deletion_type)
        VALUES (?, datetime('now'), ?, ?)
      `;
      
      this.db.run(sql, [projectName, recordsCount, deletionType], (err: Error | null) => {
        if (err) {
          console.error('❌ Erro ao registrar histórico de exclusão:', err);
          reject(err);
        } else {
          console.log(`📝 Histórico registrado: ${projectName} (${deletionType})`);
          resolve();
        }
      });
    });
  }

  /**
   * Registra uma restauração no histórico
   * @param projectName Nome do projeto restaurado
   */
  private async logRestoration(projectName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      // SQLite não permite ORDER BY/LIMIT diretamente no UPDATE
      // Solução: Usar WHERE id IN (SELECT...) para pegar o registro mais recente
      const sql = `
        UPDATE deletion_history 
        SET restored_at = datetime('now')
        WHERE id = (
          SELECT id 
          FROM deletion_history
          WHERE project_name = ? 
            AND restored_at IS NULL
          ORDER BY deleted_at DESC
          LIMIT 1
        )
      `;
      
      this.db.run(sql, [projectName], (err: Error | null) => {
        if (err) {
          console.error('❌ Erro ao registrar restauração:', err);
          reject(err);
        } else {
          console.log(`📝 Restauração registrada: ${projectName}`);
          resolve();
        }
      });
    });
  }

  /**
   * Obtém histórico completo de exclusões
   * @param includeRestored Incluir projetos que foram restaurados
   * @returns Array com histórico de exclusões
   */
  async getDeletionHistory(includeRestored: boolean = true): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Banco de dados não inicializado"));
        return;
      }
      
      let sql = `
        SELECT 
          id,
          project_name,
          deleted_at,
          records_count,
          deletion_type,
          restored_at,
          CASE 
            WHEN restored_at IS NOT NULL THEN 'restored'
            WHEN deletion_type = 'hard' THEN 'permanent'
            ELSE 'deleted'
          END as status
        FROM deletion_history
      `;
      
      if (!includeRestored) {
        sql += ` WHERE restored_at IS NULL`;
      }
      
      sql += ` ORDER BY deleted_at DESC`;
      
      this.db.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('❌ Erro ao buscar histórico de exclusões:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Fecha a conexão com o banco de dados
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err: Error | null) => {
          if (err) {
            console.error("Erro ao fechar o banco de dados:", err.message);
            reject(err);
          } else {
            console.log("Banco de dados fechado com sucesso.");
            this.db = undefined;
            resolve();
          }
        });
      } else {
        console.log("Banco de dados já estava fechado ou não inicializado.");
        resolve();
      }
    });
  }

  /**
   * Retorna projetos deletados (soft delete) com informações de tempo
   */
  async getDeletedProjectsWithDays(): Promise<Array<{
    project: string;
    deleted_at: string;
    records_count: number;
    days_since_deletion: number;
  }>> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          project,
          deleted_at,
          COUNT(*) as records_count,
          CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) as days_since_deletion
        FROM time_entries
        WHERE deleted_at IS NOT NULL
        GROUP BY project, deleted_at
        ORDER BY deleted_at DESC
      `;
      
      this.db!.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('❌ Erro ao buscar projetos deletados com dias:', err);
          reject(err);
        } else {
          console.log(`✅ ${rows.length} projeto(s) deletado(s) encontrado(s)`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Deleta permanentemente projetos expirados (mais de 30 dias)
   * @returns Número de projetos removidos permanentemente
   */
  async cleanupExpiredProjects(): Promise<number> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    console.log('🧹 Iniciando limpeza de projetos expirados (>30 dias)...');

    return new Promise(async (resolve, reject) => {
      try {
        // Primeiro, buscar projetos que serão deletados para log
        const projectsToDelete = await new Promise<any[]>((res, rej) => {
          this.db!.all(
            `SELECT DISTINCT project, COUNT(*) as records_count
             FROM time_entries 
             WHERE deleted_at IS NOT NULL 
             AND CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) > 30
             GROUP BY project`,
            [],
            (err: Error | null, rows: any[]) => {
              if (err) {
                rej(err);
              } else {
                res(rows);
              }
            }
          );
        });

        if (projectsToDelete.length === 0) {
          console.log('✅ Nenhum projeto expirado para limpar');
          resolve(0);
          return;
        }

        // Registrar no histórico antes de deletar
        for (const project of projectsToDelete) {
          await this.logDeletion(project.project, project.records_count, 'hard');
        }

        // Deletar permanentemente
        this.db!.run(
          `DELETE FROM time_entries 
           WHERE deleted_at IS NOT NULL 
           AND CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) > 30`,
          [],
          function(err: Error | null) {
            if (err) {
              console.error('❌ Erro ao limpar projetos expirados:', err);
              reject(err);
            } else {
              const deletedCount = this.changes;
              console.log(`✅ ${deletedCount} registro(s) de ${projectsToDelete.length} projeto(s) expirado(s) removido(s) permanentemente`);
              resolve(projectsToDelete.length);
            }
          }
        );
      } catch (error) {
        console.error('❌ Erro no cleanup:', error);
        reject(error);
      }
    });
  }

  /**
   * Verifica se o banco de dados está inicializado
   */
  isInitialized(): boolean {
    return this.db !== undefined;
  }
}
