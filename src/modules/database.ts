import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';
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
 * Interface para configurações do Pomodoro
 */
export interface PomodoroConfig {
  focusDuration: number; // em minutos, padrão 45
  shortBreakDuration: number; // em minutos, padrão 15
  longBreakDuration: number; // em minutos, padrão 30
  sessionsUntilLongBreak: number; // número de sessões até pausa longa, padrão 4
  autoStartBreaks: boolean; // iniciar pausas automaticamente
  autoStartFocus: boolean; // iniciar foco automaticamente após pausa
  enableSoundAlerts: boolean; // alertas sonoros
  enableDesktopNotifications: boolean; // notificações do sistema
  enableStatusBarTimer: boolean; // mostrar timer na status bar
  dailyGoalSessions: number; // meta diária de sessões, padrão 8
}

/**
 * Interface para sessões do Pomodoro
 */
export interface PomodoroSession {
  id?: number;
  sessionType: 'focus' | 'short_break' | 'long_break';
  plannedDuration: number; // duração planejada em segundos
  actualDuration?: number; // duração real em segundos
  startTime: number; // timestamp Unix
  endTime?: number; // timestamp Unix
  wasCompleted: boolean; // sessão foi completada
  wasInterrupted: boolean; // sessão foi interrompida
  interruptionReason?: string; // motivo da interrupção
  associatedActivity?: string; // atividade associada durante foco
  productivityRating?: number; // avaliação de produtividade (1-10)
  notes?: string; // notas adicionais
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
              synced INTEGER DEFAULT 0 -- 0 para não sincronizado, 1 para sincronizado
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
            
            // Criar tabela de configuração do Pomodoro
            this.db!.run(
              `CREATE TABLE IF NOT EXISTS pomodoro_config (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  focus_duration INTEGER NOT NULL DEFAULT 45,
                  short_break_duration INTEGER NOT NULL DEFAULT 15,
                  long_break_duration INTEGER NOT NULL DEFAULT 30,
                  sessions_until_long_break INTEGER NOT NULL DEFAULT 4,
                  auto_start_breaks BOOLEAN NOT NULL DEFAULT 1,
                  auto_start_focus BOOLEAN NOT NULL DEFAULT 0,
                  enable_sound_alerts BOOLEAN NOT NULL DEFAULT 1,
                  enable_desktop_notifications BOOLEAN NOT NULL DEFAULT 1,
                  enable_status_bar_timer BOOLEAN NOT NULL DEFAULT 1,
                  daily_goal_sessions INTEGER NOT NULL DEFAULT 8,
                  created_at INTEGER DEFAULT (strftime('%s', 'now')),
                  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
              )`,
              (pomodoroConfigErr: Error | null) => {
                if (pomodoroConfigErr) {
                  vscode.window.showErrorMessage(
                    localize('database.pomodoroConfigTableError', 'Error creating pomodoro_config table: {0}', pomodoroConfigErr.message)
                  );
                  console.error("Erro ao criar tabela pomodoro_config:", pomodoroConfigErr);
                  return reject(pomodoroConfigErr);
                }
                console.log('Tabela "pomodoro_config" verificada/criada com sucesso.');
                
                // Criar tabela de sessões do Pomodoro
                this.db!.run(
                  `CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      session_type TEXT NOT NULL CHECK (session_type IN ('focus', 'short_break', 'long_break')),
                      planned_duration INTEGER NOT NULL,
                      actual_duration INTEGER,
                      start_time INTEGER NOT NULL,
                      end_time INTEGER,
                      was_completed BOOLEAN NOT NULL DEFAULT 0,
                      was_interrupted BOOLEAN NOT NULL DEFAULT 0,
                      interruption_reason TEXT,
                      associated_activity TEXT,
                      productivity_rating INTEGER CHECK (productivity_rating BETWEEN 1 AND 10),
                      notes TEXT,
                      created_at INTEGER DEFAULT (strftime('%s', 'now'))
                  )`,
                  (pomodoroSessionsErr: Error | null) => {
                    if (pomodoroSessionsErr) {
                      vscode.window.showErrorMessage(
                        localize('database.pomodoroSessionsTableError', 'Error creating pomodoro_sessions table: {0}', pomodoroSessionsErr.message)
                      );
                      console.error("Erro ao criar tabela pomodoro_sessions:", pomodoroSessionsErr);
                      return reject(pomodoroSessionsErr);
                    }
                    console.log('Tabela "pomodoro_sessions" verificada/criada com sucesso.');
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
        project || "unknown-project",
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

  // ============================
  // MÉTODOS POMODORO
  // ============================

  /**
   * Salva ou atualiza a configuração do Pomodoro
   */
  async savePomodoroConfig(config: PomodoroConfig): Promise<void> {
    if (!this.db) {
      throw new Error("Banco de dados não inicializado");
    }

    // Primeiro verifica se já existe uma configuração
    const existingConfig = await this.query("SELECT id FROM pomodoro_config LIMIT 1");
    
    if (existingConfig.length > 0) {
      // Atualiza configuração existente
      const updateQuery = `
        UPDATE pomodoro_config SET 
        focus_duration = ?, 
        short_break_duration = ?, 
        long_break_duration = ?, 
        sessions_until_long_break = ?,
        auto_start_breaks = ?, 
        auto_start_focus = ?, 
        enable_sound_alerts = ?, 
        enable_desktop_notifications = ?, 
        enable_status_bar_timer = ?, 
        daily_goal_sessions = ?,
        updated_at = strftime('%s', 'now')
        WHERE id = ?
      `;
      
      return new Promise((resolve, reject) => {
        this.db!.run(updateQuery, [
          config.focusDuration,
          config.shortBreakDuration,
          config.longBreakDuration,
          config.sessionsUntilLongBreak,
          config.autoStartBreaks ? 1 : 0,
          config.autoStartFocus ? 1 : 0,
          config.enableSoundAlerts ? 1 : 0,
          config.enableDesktopNotifications ? 1 : 0,
          config.enableStatusBarTimer ? 1 : 0,
          config.dailyGoalSessions,
          existingConfig[0].id
        ], (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      // Insere nova configuração
      const insertQuery = `
        INSERT INTO pomodoro_config (
          focus_duration, short_break_duration, long_break_duration, 
          sessions_until_long_break, auto_start_breaks, auto_start_focus,
          enable_sound_alerts, enable_desktop_notifications, enable_status_bar_timer,
          daily_goal_sessions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      return new Promise((resolve, reject) => {
        this.db!.run(insertQuery, [
          config.focusDuration,
          config.shortBreakDuration,
          config.longBreakDuration,
          config.sessionsUntilLongBreak,
          config.autoStartBreaks ? 1 : 0,
          config.autoStartFocus ? 1 : 0,
          config.enableSoundAlerts ? 1 : 0,
          config.enableDesktopNotifications ? 1 : 0,
          config.enableStatusBarTimer ? 1 : 0,
          config.dailyGoalSessions
        ], (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Obtém a configuração atual do Pomodoro
   */
  async getPomodoroConfig(): Promise<PomodoroConfig | null> {
    const rows = await this.query("SELECT * FROM pomodoro_config LIMIT 1");
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      focusDuration: row.focus_duration,
      shortBreakDuration: row.short_break_duration,
      longBreakDuration: row.long_break_duration,
      sessionsUntilLongBreak: row.sessions_until_long_break,
      autoStartBreaks: Boolean(row.auto_start_breaks),
      autoStartFocus: Boolean(row.auto_start_focus),
      enableSoundAlerts: Boolean(row.enable_sound_alerts),
      enableDesktopNotifications: Boolean(row.enable_desktop_notifications),
      enableStatusBarTimer: Boolean(row.enable_status_bar_timer),
      dailyGoalSessions: row.daily_goal_sessions
    };
  }

  /**
   * Salva uma sessão Pomodoro
   */
  async savePomodoroSession(session: PomodoroSession): Promise<number> {
    if (!this.db) {
      throw new Error("Banco de dados não inicializado");
    }

    const insertQuery = `
      INSERT INTO pomodoro_sessions (
        session_type, planned_duration, actual_duration, start_time, end_time,
        was_completed, was_interrupted, interruption_reason, associated_activity,
        productivity_rating, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(insertQuery, [
        session.sessionType,
        session.plannedDuration,
        session.actualDuration,
        session.startTime,
        session.endTime,
        session.wasCompleted ? 1 : 0,
        session.wasInterrupted ? 1 : 0,
        session.interruptionReason,
        session.associatedActivity,
        session.productivityRating,
        session.notes
      ], function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID!);
        }
      });
    });
  }

  /**
   * Obtém sessões Pomodoro com filtros opcionais
   */
  async getPomodoroSessions(
    startDate?: Date, 
    endDate?: Date, 
    sessionType?: 'focus' | 'short_break' | 'long_break'
  ): Promise<PomodoroSession[]> {
    let query = "SELECT * FROM pomodoro_sessions WHERE 1=1";
    const params: any[] = [];

    if (startDate) {
      query += " AND start_time >= ?";
      params.push(Math.floor(startDate.getTime() / 1000));
    }

    if (endDate) {
      query += " AND start_time <= ?";
      params.push(Math.floor(endDate.getTime() / 1000));
    }

    if (sessionType) {
      query += " AND session_type = ?";
      params.push(sessionType);
    }

    query += " ORDER BY start_time DESC";

    const rows = await this.query(query, params);
    
    return rows.map(row => ({
      id: row.id,
      sessionType: row.session_type,
      plannedDuration: row.planned_duration,
      actualDuration: row.actual_duration,
      startTime: row.start_time,
      endTime: row.end_time,
      wasCompleted: Boolean(row.was_completed),
      wasInterrupted: Boolean(row.was_interrupted),
      interruptionReason: row.interruption_reason,
      associatedActivity: row.associated_activity,
      productivityRating: row.productivity_rating,
      notes: row.notes
    }));
  }

  /**
   * Atualiza uma sessão Pomodoro existente
   */
  async updatePomodoroSession(sessionId: number, updates: Partial<PomodoroSession>): Promise<void> {
    if (!this.db) {
      throw new Error("Banco de dados não inicializado");
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (updates.actualDuration !== undefined) {
      fields.push("actual_duration = ?");
      params.push(updates.actualDuration);
    }
    if (updates.endTime !== undefined) {
      fields.push("end_time = ?");
      params.push(updates.endTime);
    }
    if (updates.wasCompleted !== undefined) {
      fields.push("was_completed = ?");
      params.push(updates.wasCompleted ? 1 : 0);
    }
    if (updates.wasInterrupted !== undefined) {
      fields.push("was_interrupted = ?");
      params.push(updates.wasInterrupted ? 1 : 0);
    }
    if (updates.interruptionReason !== undefined) {
      fields.push("interruption_reason = ?");
      params.push(updates.interruptionReason);
    }
    if (updates.productivityRating !== undefined) {
      fields.push("productivity_rating = ?");
      params.push(updates.productivityRating);
    }
    if (updates.notes !== undefined) {
      fields.push("notes = ?");
      params.push(updates.notes);
    }

    if (fields.length === 0) {
      return; // Nada para atualizar
    }

    params.push(sessionId);
    const query = `UPDATE pomodoro_sessions SET ${fields.join(", ")} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db!.run(query, params, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Verifica se o banco de dados está inicializado
   */
  isInitialized(): boolean {
    return this.db !== undefined;
  }
}
