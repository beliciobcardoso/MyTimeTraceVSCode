import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import { randomUUID } from 'crypto';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface ActivityData {
  timestamp: string;
  project: string | undefined;
  file: string | undefined;
  duration: number; // em segundos
  isIdle?: boolean;
  device_name?: string; // Nome do dispositivo/computador
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
              client_id TEXT UNIQUE,
              timestamp TEXT NOT NULL,
              project TEXT,
              file TEXT,
              duration_seconds INTEGER NOT NULL,
              is_idle INTEGER DEFAULT 0,
              synced INTEGER DEFAULT 0, -- 0 para não sincronizado, 1 para sincronizado
              deleted_at TEXT DEFAULT NULL, -- Soft delete: NULL = ativo, data = deletado
              device_name TEXT DEFAULT NULL -- Nome do dispositivo/computador
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
                
                // Migração: Adicionar coluna device_name se não existir
                this.db!.run(
                  `ALTER TABLE time_entries ADD COLUMN device_name TEXT DEFAULT NULL`,
                  (deviceErr: Error | null) => {
                    if (deviceErr) {
                      if (deviceErr.message.includes('duplicate column name')) {
                        console.log('✅ Coluna device_name já existe (migração já aplicada)');
                      } else {
                        console.warn('⚠️ Aviso ao adicionar coluna device_name:', deviceErr.message);
                      }
                    } else {
                      console.log('✅ Coluna device_name adicionada com sucesso (migração aplicada)');
                    }

                    // Migração: Adicionar coluna client_id se não existir
                    this.db!.run(
                      `ALTER TABLE time_entries ADD COLUMN client_id TEXT`,
                      (clientIdErr: Error | null) => {
                        if (clientIdErr) {
                          if (clientIdErr.message.includes('duplicate column name')) {
                            console.log('✅ Coluna client_id já existe (migração já aplicada)');
                          } else {
                            console.warn('⚠️ Aviso ao adicionar coluna client_id:', clientIdErr.message);
                          }
                        } else {
                          console.log('✅ Coluna client_id adicionada com sucesso (migração aplicada)');
                        }

                        // Backfill: garante client_id para registros antigos
                        this.db!.run(
                          `UPDATE time_entries SET client_id = ('local-' || id) WHERE client_id IS NULL`,
                          (backfillErr: Error | null) => {
                            if (backfillErr) {
                              console.warn('⚠️ Aviso no backfill de client_id:', backfillErr.message);
                            } else {
                              console.log('✅ Backfill de client_id concluído');
                            }

                            // Índice único para deduplicar inserts vindos do pull
                            this.db!.run(
                              `CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_client_id_unique ON time_entries(client_id)`,
                              (indexErr: Error | null) => {
                                if (indexErr) {
                                  console.warn('⚠️ Aviso ao criar índice único de client_id:', indexErr.message);
                                } else {
                                  console.log('✅ Índice único de client_id verificado/criado com sucesso');
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
                                    
                                    // 🔄 FASE 2: Criar tabela de metadados de sincronização
                                    this.db!.run(
                                      `CREATE TABLE IF NOT EXISTS sync_metadata (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            key TEXT NOT NULL UNIQUE,
                            value TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                          )`,
                                      (syncMetaErr: Error | null) => {
                                        if (syncMetaErr) {
                                          console.error('❌ Erro ao criar tabela sync_metadata:', syncMetaErr);
                                        } else {
                                          console.log('✅ Tabela sync_metadata verificada/criada com sucesso');
                                        }
                                        resolve();
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
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
    const { timestamp, project, file, duration, isIdle, device_name } = data;
    const clientId = `local-${randomUUID()}`;

    const stmt = this.db.prepare(
      "INSERT INTO time_entries (client_id, timestamp, project, file, duration_seconds, is_idle, device_name) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    
    return new Promise((resolve, reject) => {
      stmt.run(
        clientId,
        timestamp,
        project || "Arquivos Diversos",
        file || "unknown-file",
        duration,
        isIdle ? 1 : 0,
        device_name || null,
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

  // ============================================
  // 🔄 MÉTODOS DE SINCRONIZAÇÃO (FASE 2)
  // ============================================

  /**
   * Busca entries locais não sincronizadas (synced = 0)
   * 
   * **Usado por:** SyncManager.pushEntries()
   * **Limite:** 500 entries por vez (conforme spec backend)
   * 
   * @returns Array de time_entries não sincronizadas
   * 
   * @param limit - Limite de entries a buscar (padrão: 100)
   * @example
   * ```typescript
   * const unsyncedEntries = await dbManager.getUnsyncedEntries(200);
   * console.log(`${unsyncedEntries.length} entries para sincronizar`);
   * ```
   */
  async getUnsyncedEntries(limit: number = 100): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM time_entries 
         WHERE synced = 0 AND deleted_at IS NULL 
         ORDER BY timestamp ASC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            console.error('❌ Erro ao buscar entries não sincronizadas:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Retorna o total de entries no banco local (não deletadas)
   * 
   * **Usado por:** Status de sincronização
   * 
   * @returns Total de entries
   * @example
   * ```typescript
   * const total = await dbManager.getTotalEntriesCount();
   * console.log(`Total: ${total} entries`);
   * ```
   */
  async getTotalEntriesCount(): Promise<number> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT COUNT(*) as count FROM time_entries WHERE deleted_at IS NULL`,
        (err, row: any) => {
          if (err) {
            console.error('❌ Erro ao contar entries:', err);
            reject(err);
          } else {
            resolve(row?.count || 0);
          }
        }
      );
    });
  }

  /**
   * Marca entries como sincronizadas (synced = 1)
   * 
   * **Usado por:** SyncManager.pushEntries() após sucesso no servidor
   * 
   * @param entryIds - Array de IDs (campo 'id' do SQLite)
   * 
   * @example
   * ```typescript
   * await dbManager.markAsSynced([1, 2, 3, 4, 5]);
   * console.log('✅ 5 entries marcadas como sincronizadas');
   * ```
   */
  async markAsSynced(entryIds: number[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    if (entryIds.length === 0) {
      console.log('⚠️ Nenhum ID fornecido para markAsSynced');
      return;
    }

    const placeholders = entryIds.map(() => '?').join(',');
    const query = `UPDATE time_entries SET synced = 1 WHERE id IN (${placeholders})`;

    return new Promise((resolve, reject) => {
      this.db!.run(query, entryIds, (err) => {
        if (err) {
          console.error('❌ Erro ao marcar entries como sincronizadas:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Insere entry já sincronizada (LEGADO: era usado por pull em v0.4.x)
   * 
  * **Status:** Não mais chamado - pull removido em v0.5.1. Mantido para compatibilidade de dedup local.
   * **Importante:** Usa INSERT OR IGNORE para evitar duplicatas
   * 
   * @param entry - Objeto com dados da entry (formato backend)
   * 
   * @example
   * ```typescript
   * await dbManager.insertSyncedEntry({
   *   clientId: 'uuid-entry-1',
   *   timestamp: '2025-11-22T10:00:00Z',
   *   project: 'MyProject',
   *   file: 'src/main.ts',
   *   durationSeconds: 300,
   *   isIdle: false,
   *   deviceKey: 'uuid-device-2'
   * });
   * ```
   */
  async insertSyncedEntry(entry: {
    clientId: string;
    timestamp: string;
    project: string;
    file: string;
    durationSeconds: number;
    isIdle: boolean;
    deviceKey?: string;
  }): Promise<void> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    // Evita duplicatas por client_id e por assinatura da linha.
    // Isso cobre dados antigos da cloud com client_id diferente mas conteúdo idêntico.
    const query = `
      INSERT INTO time_entries (client_id, timestamp, project, file, duration_seconds, is_idle, synced, device_name)
      SELECT ?, ?, ?, ?, ?, ?, 1, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM time_entries
        WHERE client_id = ?
           OR (
             timestamp = ?
             AND IFNULL(project, '') = IFNULL(?, '')
             AND IFNULL(file, '') = IFNULL(?, '')
             AND duration_seconds = ?
             AND is_idle = ?
             AND IFNULL(device_name, '') = IFNULL(?, '')
           )
      )
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(
        query,
        [
          entry.clientId,
          entry.timestamp,
          entry.project,
          entry.file,
          entry.durationSeconds,
          entry.isIdle ? 1 : 0,
          entry.deviceKey || 'unknown',
          entry.clientId,
          entry.timestamp,
          entry.project,
          entry.file,
          entry.durationSeconds,
          entry.isIdle ? 1 : 0,
          entry.deviceKey || 'unknown'
        ],
        (err) => {
          if (err) {
            console.error('❌ Erro ao inserir entry sincronizada:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Gerencia metadados de sincronização (key-value store)
   * 
   * **Usado para:** Armazenar last_pull_timestamp, last_push_timestamp, etc.
   * **Tabela:** sync_metadata
   * 
   * @param key - Chave do metadado (ex: 'last_pull_timestamp')
   * @returns Valor ou null se não existe
   * 
   * @example
   * ```typescript
   * const lastPull = await dbManager.getMetadata('last_pull_timestamp');
   * if (lastPull) {
   *   console.log('Última sincronização:', new Date(lastPull));
   * }
   * ```
   */
  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT value FROM sync_metadata WHERE key = ?',
        [key],
        (err, row: any) => {
          if (err) {
            console.error(`❌ Erro ao buscar metadata '${key}':`, err);
            reject(err);
          } else {
            resolve(row?.value || null);
          }
        }
      );
    });
  }

  /**
   * Define metadado de sincronização (INSERT ou UPDATE)
   * 
   * **Usado por:** SyncManager após pull bem-sucedido
   * 
   * @param key - Chave do metadado
   * @param value - Valor a ser armazenado
   * 
   * @example
   * ```typescript
   * await dbManager.setMetadata('last_pull_timestamp', new Date().toISOString());
   * console.log('✅ Timestamp de última sincronização atualizado');
   * ```
   */
  async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database não inicializado');
    }

    const now = new Date().toISOString();
    const query = `
      INSERT INTO sync_metadata (key, value, updated_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(query, [key, value, now, value, now], (err) => {
        if (err) {
          console.error(`❌ Erro ao definir metadata '${key}':`, err);
          reject(err);
        } else {
          console.log(`✅ Metadata '${key}' definido: ${value}`);
          resolve();
        }
      });
    });
  }
}

