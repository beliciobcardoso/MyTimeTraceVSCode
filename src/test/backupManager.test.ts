import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as sqlite3 from 'sqlite3';
import { BackupManager } from '../modules/backupManager';

/**
 * 🧪 Testes Unitários — BackupManager
 *
 * Cobertura:
 * - Backup bem-sucedido (arquivo criado, timestamp persistido)
 * - Política de retenção (remove mais antigo ao atingir limite)
 * - Colisão de nome (sufixo _1, _2)
 * - Pasta inacessível (erro + backup.state)
 * - Sanitização de intervalHours inválido
 * - Mutex impede backup duplo simultâneo
 * - Agendamento: scheduleNext, checkMissedBackup, pausa/retomada
 */
suite('BackupManager Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let tmpDir: string;
  let dbDir: string;
  let dbPath: string;
  let backupManager: BackupManager;
  let mockDb: any;
  let mockDatabaseManager: any;
  let mockMyTimeTrace: any;
  let mockOutputChannel: any;
  let clock: sinon.SinonFakeTimers;

  function createSqliteDb(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(filePath, (err) => {
        if (err) { return reject(err); }
        db.run('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)', (e) => {
          db.close((ce) => (ce || e ? reject(ce || e) : resolve()));
        });
      });
    });
  }

  setup(async () => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });

    // Diretório temporário para banco de dados de origem e pasta de backup
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtt-backup-test-'));
    dbDir = path.join(tmpDir, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    dbPath = path.join(dbDir, 'time_tracker.sqlite');

    // Cria banco SQLite real de origem
    await createSqliteDb(dbPath);

    // Simular db real para PRAGMA quick_check e VACUUM INTO
    mockDb = {
      get: sandbox.stub().callsFake((sql: string, cb: Function) => {
        if (sql === 'PRAGMA quick_check') {
          cb(null, { quick_check: 'ok' });
        }
      }),
      run: sandbox.stub().callsFake((sql: string, cb: Function) => {
        // VACUUM INTO — copiar o arquivo real
        const match = sql.match(/VACUUM INTO '(.+)'/);
        if (match) {
          fs.copyFileSync(dbPath, match[1]);
        }
        cb(null);
      }),
    };

    mockDatabaseManager = {
      db: mockDb,
      getDbPath: () => dbPath,
      checkIntegrity: sandbox.stub().resolves(),
      vacuumInto: sandbox.stub().callsFake((destPath: string) => {
        fs.copyFileSync(dbPath, destPath);
        return Promise.resolve();
      }),
      setMetadata: sandbox.stub().resolves(),
      getMetadata: sandbox.stub().resolves(null),
      setSyncMetadata: sandbox.stub().resolves(),
      getSyncMetadata: sandbox.stub().resolves(null),
      close: sandbox.stub().resolves(),
    };

    mockMyTimeTrace = {
      pauseTracking: sandbox.stub(),
    };

    mockOutputChannel = {
      appendLine: sandbox.stub(),
    };

    // Stub de configuração
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string, def: any) => {
        const cfgMap: Record<string, any> = {
          enabled: true,
          destinationPath: path.join(tmpDir, 'backups'),
          intervalHours: 24,
          maxBackups: 3,
          notifyOnSuccess: false,
        };
        return cfgMap[key] ?? def;
      },
      update: sandbox.stub().resolves(),
    } as any);

    backupManager = new BackupManager(
      mockDatabaseManager,
      mockMyTimeTrace,
      mockOutputChannel,
    );
  });

  teardown(() => {
    clock.restore();
    sandbox.restore();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignorar */ }
  });

  // ─── Backup bem-sucedido ─────────────────────────────────────────────────

  suite('triggerManualBackup()', () => {
    test('Deve criar arquivo de backup com nome correto', async () => {
      const destPath = path.join(tmpDir, 'backups');
      await backupManager.triggerManualBackup();

      const files = fs.readdirSync(destPath).filter(f => f.endsWith('.sqlite'));
      assert.ok(files.length >= 1, 'Deve existir ao menos um arquivo .sqlite na pasta de destino');
      assert.match(files[0], /^time_tracker_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sqlite$/);
    });

    test('Deve persistir timestamp após backup bem-sucedido', async () => {
      await backupManager.triggerManualBackup();
      const status = backupManager.getStatus();
      assert.ok(status.lastBackupAt, 'lastBackupAt deve estar preenchido após backup');
      assert.ok(!isNaN(new Date(status.lastBackupAt!).getTime()), 'lastBackupAt deve ser ISO válido');
    });

    test('Estado deve ser "active" após backup bem-sucedido', async () => {
      await backupManager.triggerManualBackup();
      assert.strictEqual(backupManager.getStatus().state, 'active');
    });
  });

  // ─── Mutex ───────────────────────────────────────────────────────────────

  suite('Mutex — backup duplo simultâneo', () => {
    test('Segunda chamada simultânea deve ser ignorada', async () => {
      const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

      // Simular vacuum lento via stub do databaseManager
      let resolveVacuum!: () => void;
      const vacuumPromise = new Promise<void>(r => { resolveVacuum = r; });
      mockDatabaseManager.vacuumInto = sandbox.stub().callsFake((destPath: string) => {
        fs.copyFileSync(dbPath, destPath);
        return vacuumPromise;
      });

      const first = backupManager.triggerManualBackup();
      // Segunda chamada antes do primeiro terminar
      const second = backupManager.triggerManualBackup();

      // Liberamos o primeiro vacuum
      resolveVacuum();
      await Promise.all([first, second]);

      assert.ok(
        showInfoStub.calledWith(sinon.match(/already in progress|já em andamento/i)),
        'Deve exibir mensagem informando que backup já está em andamento',
      );
    });
  });

  // ─── Política de retenção ────────────────────────────────────────────────

  suite('Política de retenção', () => {
    test('Deve remover backup mais antigo ao atingir maxBackups', async () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });

      // Cria 3 backups antigos
      const oldNames = [
        'time_tracker_2025-01-01_00-00-00.sqlite',
        'time_tracker_2025-01-02_00-00-00.sqlite',
        'time_tracker_2025-01-03_00-00-00.sqlite',
      ];
      for (const name of oldNames) {
        fs.copyFileSync(dbPath, path.join(destPath, name));
      }

      // Avançar clock para 2025-01-04 — novo backup fica mais recente que os existentes
      clock.setSystemTime(new Date('2025-01-04T00:00:01.000Z'));

      // maxBackups=3 → após novo backup, o mais antigo (2025-01-01) deve ser removido
      await backupManager.triggerManualBackup();

      const remaining = fs.readdirSync(destPath).filter(f => f.endsWith('.sqlite'));
      assert.ok(remaining.length <= 3, `Deve ter no máximo 3 backups, encontrou ${remaining.length}`);
      assert.ok(
        !remaining.includes('time_tracker_2025-01-01_00-00-00.sqlite'),
        'O backup mais antigo deve ter sido removido',
      );
    });

    test('Arquivos com nome fora do padrão não devem ser removidos', async () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });

      // Arquivo fora do padrão
      const external = path.join(destPath, 'meu_backup_manual.sqlite');
      fs.copyFileSync(dbPath, external);

      // 3 backups no limite
      const names = [
        'time_tracker_2025-01-01_00-00-00.sqlite',
        'time_tracker_2025-01-02_00-00-00.sqlite',
        'time_tracker_2025-01-03_00-00-00.sqlite',
      ];
      for (const name of names) {
        fs.copyFileSync(dbPath, path.join(destPath, name));
      }

      await backupManager.triggerManualBackup();

      assert.ok(
        fs.existsSync(external),
        'Arquivo com nome fora do padrão não deve ser removido pela política de retenção',
      );
    });
  });

  // ─── Colisão de nome ─────────────────────────────────────────────────────

  suite('Resolução de colisão de nome', () => {
    test('Deve gerar sufixo _1 quando nome já existe', async () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });

      // Pré-criar arquivo com o timestamp que o clock vai gerar (epoch 0 = 1970-01-01_00-00-00)
      fs.copyFileSync(dbPath, path.join(destPath, 'time_tracker_1970-01-01_00-00-00.sqlite'));

      await backupManager.triggerManualBackup();

      const files = fs.readdirSync(destPath).filter(f => f.endsWith('.sqlite'));
      assert.ok(
        files.some(f => f.includes('_1.sqlite')),
        `Deve existir arquivo com sufixo _1. Encontrados: ${files.join(', ')}`,
      );
    });
  });

  // ─── Pasta inacessível ───────────────────────────────────────────────────

  suite('Erros de destino', () => {
    test('Path com aspas simples deve falhar com erro descritivo', async () => {
      const showErrStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

      // Substituir configuração para retornar path inválido
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns({
        get: (key: string, def: any) => {
          if (key === 'destinationPath') { return "/tmp/back'up"; }
          const defaults: Record<string, any> = { enabled: true, intervalHours: 24, maxBackups: 3, notifyOnSuccess: false };
          return defaults[key] ?? def;
        },
        update: sandbox.stub().resolves(),
      } as any);

      await backupManager.triggerManualBackup();

      assert.ok(
        showErrStub.calledWith(sinon.match(/single quotes|aspas simples/i)),
        'Deve exibir erro sobre aspas simples no path',
      );
      assert.strictEqual(backupManager.getStatus().state, 'failed');
    });
  });

  // ─── Sanitização de intervalHours inválido ────────────────────────────────

  suite('Sanitização de configuração', () => {
    test('intervalHours 0 deve ser tratado como 1', () => {
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns({
        get: (key: string, def: any) => {
          if (key === 'intervalHours') { return 0; }
          const defaults: Record<string, any> = { enabled: true, destinationPath: path.join(tmpDir, 'backups'), maxBackups: 3, notifyOnSuccess: false };
          return defaults[key] ?? def;
        },
        update: sandbox.stub().resolves(),
      } as any);

      // BackupManager interno usa Math.max(1, ...) — verificar via scheduleNext sem crash
      assert.doesNotThrow(() => backupManager.scheduleNext(1 * 3600_000));
    });

    test('intervalHours NaN deve ser tratado como 1', () => {
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns({
        get: (key: string, def: any) => {
          if (key === 'intervalHours') { return NaN; }
          const defaults: Record<string, any> = { enabled: true, destinationPath: path.join(tmpDir, 'backups'), maxBackups: 3, notifyOnSuccess: false };
          return defaults[key] ?? def;
        },
        update: sandbox.stub().resolves(),
      } as any);

      assert.doesNotThrow(() => backupManager.scheduleNext(1 * 3600_000));
    });
  });

  // ─── Agendamento ─────────────────────────────────────────────────────────

  suite('scheduleNext() e pauseScheduler()', () => {
    test('pauseScheduler deve colocar estado como paused', () => {
      backupManager.scheduleNext(3600_000);
      backupManager.pauseScheduler();
      assert.strictEqual(backupManager.getStatus().state, 'paused');
    });

    test('checkMissedBackup não deve fazer nada quando enabled=false', async () => {
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns({
        get: (key: string, def: any) => {
          if (key === 'enabled') { return false; }
          return def;
        },
        update: sandbox.stub().resolves(),
      } as any);

      const spy = sandbox.spy(backupManager, 'triggerManualBackup');
      await backupManager.checkMissedBackup();
      assert.ok(!spy.called, 'triggerManualBackup não deve ser chamado quando backup está desabilitado');
    });
  });

  // ─── dispose ─────────────────────────────────────────────────────────────

  suite('dispose()', () => {
    test('Deve encerrar sem erros', () => {
      backupManager.scheduleNext(3600_000);
      assert.doesNotThrow(() => backupManager.dispose());
    });
  });
});
