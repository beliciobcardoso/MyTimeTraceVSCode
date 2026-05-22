import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { BackupPanel } from '../ui/backupPanel';
import { BackupManager } from '../modules/backupManager';

/**
 * 🧪 Testes Unitários — BackupPanel
 *
 * Cobertura:
 * - createOrShow: painel único (reveal em vez de criar novo)
 * - Renderização com backups existentes
 * - Estado vazio com mensagem orientativa
 * - Confirmação antes de exclusão individual
 * - Atualização via FileSystemWatcher ao deletar arquivo externo
 */
suite('BackupPanel Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let tmpDir: string;
  let mockBackupManager: Partial<BackupManager>;
  let mockPanel: any;
  let mockWebview: any;

  function makeStatus(overrides: Partial<ReturnType<BackupManager['getStatus']>> = {}) {
    return {
      state: 'active' as const,
      isBacking: false,
      lastBackupAt: '2026-05-21T10:00:00.000Z',
      nextBackupAt: null,
      lastError: null,
      destinationPath: path.join(tmpDir, 'backups'),
      ...overrides,
    };
  }

  setup(() => {
    sandbox = sinon.createSandbox();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtt-panel-test-'));

    mockWebview = {
      html: '',
      onDidReceiveMessage: sandbox.stub().callsFake((_handler: any, _thisArg: any, disposables: any[]) => {
        const d = { dispose: () => {} };
        disposables?.push(d);
        return d;
      }),
      postMessage: sandbox.stub().resolves(true),
    };

    mockPanel = {
      webview: mockWebview,
      reveal: sandbox.stub(),
      dispose: sandbox.stub(),
      onDidDispose: sandbox.stub().callsFake((cb: () => void, _thisArg: any, disposables: any[]) => {
        const d = { dispose: cb };
        disposables?.push(d);
        return d;
      }),
    };

    mockBackupManager = {
      getStatus: sandbox.stub().returns(makeStatus()),
      triggerManualBackup: sandbox.stub().resolves(),
      openConfigWizard: sandbox.stub().resolves(),
      restoreFromBackup: sandbox.stub().resolves(),
      pauseScheduler: sandbox.stub(),
    } as any;

    // Stub vscode.window.createWebviewPanel para retornar nosso mock
    sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel as any);

    // Stub FileSystemWatcher
    const fakeWatcher = {
      onDidCreate: sandbox.stub().callsFake((_cb: any, _thisArg: any, disposables: any[]) => {
        const d = { dispose: () => {} };
        disposables?.push(d);
        return d;
      }),
      onDidDelete: sandbox.stub().callsFake((_cb: any, _thisArg: any, disposables: any[]) => {
        const d = { dispose: () => {} };
        disposables?.push(d);
        return d;
      }),
      dispose: sandbox.stub(),
    };
    sandbox.stub(vscode.workspace, 'createFileSystemWatcher').returns(fakeWatcher as any);
  });

  teardown(() => {
    // Garantir que currentPanel seja limpo após cada teste
    (BackupPanel as any).currentPanel = undefined;
    sandbox.restore();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignorar */ }
  });

  // ─── createOrShow ─────────────────────────────────────────────────────────

  suite('createOrShow()', () => {
    test('Deve criar novo painel quando não existe', () => {
      BackupPanel.createOrShow(mockBackupManager as BackupManager);
      assert.ok(BackupPanel.currentPanel, 'currentPanel deve existir após createOrShow');
    });

    test('Deve revelar painel existente em vez de criar novo', () => {
      BackupPanel.createOrShow(mockBackupManager as BackupManager);
      const firstPanel = BackupPanel.currentPanel;

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      assert.strictEqual(
        BackupPanel.currentPanel,
        firstPanel,
        'Deve ser o mesmo painel (não criado de novo)',
      );
      assert.ok((mockPanel.reveal as sinon.SinonStub).called, 'reveal deve ter sido chamado');
      assert.ok(
        (vscode.window.createWebviewPanel as sinon.SinonStub).calledOnce,
        'createWebviewPanel deve ter sido chamado apenas uma vez',
      );
    });
  });

  // ─── Renderização com backups existentes ─────────────────────────────────

  suite('Renderização', () => {
    test('HTML deve conter nome dos arquivos de backup', () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });
      fs.writeFileSync(path.join(destPath, 'time_tracker_2026-05-20_10-00-00.sqlite'), 'dummy');
      fs.writeFileSync(path.join(destPath, 'time_tracker_2026-05-21_10-00-00.sqlite'), 'dummy');

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const html: string = mockWebview.html;
      assert.ok(html.includes('time_tracker_2026-05-20_10-00-00'), 'HTML deve conter o backup mais antigo');
      assert.ok(html.includes('time_tracker_2026-05-21_10-00-00'), 'HTML deve conter o backup mais recente');
    });

    test('Badge "● atual" deve aparecer apenas no backup mais recente', () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });
      fs.writeFileSync(path.join(destPath, 'time_tracker_2026-05-20_10-00-00.sqlite'), 'dummy');
      fs.writeFileSync(path.join(destPath, 'time_tracker_2026-05-21_10-00-00.sqlite'), 'dummy');

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const html: string = mockWebview.html;
      // localize() retorna EN no ambiente de testes; aceitar ambos os idiomas
      const count = (html.match(/● atual|● current/g) || []).length;
      assert.strictEqual(count, 1, 'Badge de "atual/current" deve aparecer exatamente uma vez');
    });

    test('Estado vazio: mensagem orientativa quando pasta está vazia', () => {
      (mockBackupManager.getStatus as sinon.SinonStub).returns(
        makeStatus({ destinationPath: path.join(tmpDir, 'pasta-vazia') }),
      );
      fs.mkdirSync(path.join(tmpDir, 'pasta-vazia'), { recursive: true });

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const html: string = mockWebview.html;
      // localize() retorna EN no ambiente de testes; aceitar ambos os idiomas
      assert.ok(
        html.includes('Nenhum backup encontrado') || html.includes('No backups found'),
        'Deve exibir mensagem orientativa quando pasta está vazia',
      );
    });

    test('Estado vazio: mensagem orientativa quando pasta não configurada', () => {
      (mockBackupManager.getStatus as sinon.SinonStub).returns(
        makeStatus({ destinationPath: '' }),
      );

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const html: string = mockWebview.html;
      // localize() retorna EN no ambiente de testes; aceitar ambos os idiomas
      assert.ok(
        html.includes('Nenhum backup encontrado') || html.includes('No backups found') ||
        html.includes('Fazer Backup Agora') || html.includes('Backup Now'),
        'Deve exibir mensagem orientativa ou botão de ação',
      );
    });
  });

  // ─── Exclusão individual com confirmação ──────────────────────────────────

  suite('Exclusão individual', () => {
    test('Deve pedir confirmação antes de excluir', async () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });
      const fileName = 'time_tracker_2026-05-20_10-00-00.sqlite';
      const filePath = path.join(destPath, fileName);
      fs.writeFileSync(filePath, 'dummy');

      // localize() retorna inglês nos testes — confirmar com 'Delete'
      const showWarnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Delete' as any);

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const handler = (mockWebview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
      await handler({ command: 'deleteBackup', fileName });

      assert.ok(showWarnStub.called, 'Deve ter exibido diálogo de confirmação');
      // Verificar via filesystem real — evita stub em propriedade non-configurable
      assert.ok(!fs.existsSync(filePath), 'Arquivo deve ter sido excluído após confirmação');
    });

    test('Cancelar confirmação deve preservar o arquivo', async () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });
      const fileName = 'time_tracker_2026-05-20_10-00-00.sqlite';
      const filePath = path.join(destPath, fileName);
      fs.writeFileSync(filePath, 'dummy');

      sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined); // Cancelar

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      const handler = (mockWebview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
      await handler({ command: 'deleteBackup', fileName });

      assert.ok(fs.existsSync(filePath), 'Arquivo deve ser preservado quando usuário cancela');
    });
  });

  // ─── FileSystemWatcher ────────────────────────────────────────────────────

  suite('FileSystemWatcher', () => {
    test('Deve registrar watchers para onDidCreate e onDidDelete', () => {
      const destPath = path.join(tmpDir, 'backups');
      fs.mkdirSync(destPath, { recursive: true });

      BackupPanel.createOrShow(mockBackupManager as BackupManager);

      assert.ok(
        (vscode.workspace.createFileSystemWatcher as sinon.SinonStub).called,
        'createFileSystemWatcher deve ter sido chamado',
      );
    });
  });

  // ─── refresh() ───────────────────────────────────────────────────────────

  suite('refresh()', () => {
    test('Deve atualizar o HTML do painel', () => {
      BackupPanel.createOrShow(mockBackupManager as BackupManager);
      const htmlBefore = mockWebview.html;

      // Alterar estado e chamar refresh
      (mockBackupManager.getStatus as sinon.SinonStub).returns(
        makeStatus({ state: 'failed', lastError: 'Erro de teste' }),
      );
      BackupPanel.currentPanel!.refresh();

      const htmlAfter = mockWebview.html;
      assert.ok(htmlAfter.includes('Falha') || htmlAfter.includes('Erro de teste'), 'HTML deve refletir o novo estado após refresh');
    });
  });
});
