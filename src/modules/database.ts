import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";

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
            `Erro ao conectar ao SQLite: ${err.message}`
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
              synced INTEGER DEFAULT 0 -- 0 para não sincronizado, 1 para sincronizado
          )`,
          (tableErr: Error | null) => {
            if (tableErr) {
              vscode.window.showErrorMessage(
                `Erro ao criar tabela: ${tableErr.message}`
              );
              console.error("Erro ao criar tabela:", tableErr);
              return reject(tableErr);
            }
            console.log('Tabela "time_entries" verificada/criada com sucesso.');
            resolve();
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
        "Monitoramento de tempo: Banco de dados não está pronto."
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
        project || "unknown-project",
        file || "unknown-file",
        duration,
        isIdle ? 1 : 0,
        (error: Error | null) => {
          if (error) {
            console.error("Erro ao inserir dados no SQLite:", error);
            vscode.window.showErrorMessage(
              `Erro ao salvar dados: ${error.message}`
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
   * Verifica se o banco de dados está inicializado
   */
  isInitialized(): boolean {
    return this.db !== undefined;
  }
}
