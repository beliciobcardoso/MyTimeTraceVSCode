import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { BackupRetryManager } from '../modules/backupRetryManager';

/**
 * 🧪 Testes Unitários — BackupRetryManager
 *
 * Cobertura:
 * - execute(): sucesso na primeira tentativa
 * - execute(): retry automático após falha
 * - execute(): notificação após todas as tentativas falharem
 * - updateConfig(): no-op com console.warn
 */
suite('BackupRetryManager Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let retryManager: BackupRetryManager;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    retryManager = new BackupRetryManager();
  });

  teardown(() => {
    clock.restore();
    sandbox.restore();
  });

  suite('execute()', () => {
    test('Deve retornar resultado quando operação tem sucesso na primeira tentativa', async () => {
      const op = sandbox.stub().resolves('ok');
      const result = await retryManager.execute(op);
      assert.strictEqual(result, 'ok');
      assert.ok(op.calledOnce, 'Operação deve ser chamada apenas uma vez');
    });

    test('Deve tentar novamente após falha e retornar resultado no segundo intento', async () => {
      let attempt = 0;
      const op = async () => {
        attempt++;
        if (attempt < 2) { throw new Error('Falha temporária'); }
        return 'sucesso';
      };

      const resultPromise = retryManager.execute(op);
      // Avançar clock para superar o delay de retry (BACKUP_RETRY_DELAY_MS = 30s)
      await clock.tickAsync(31_000);
      const result = await resultPromise;

      assert.strictEqual(result, 'sucesso');
      assert.strictEqual(attempt, 2);
    });

    test('Deve notificar usuário após todas as tentativas falharem', async () => {
      const showErrStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
      const op = sandbox.stub().rejects(new Error('Erro persistente'));

      const resultPromise = retryManager.execute(op);
      // Avançar clock para cobrir todos os retries (3 tentativas × 30s)
      await clock.tickAsync(3 * 31_000);
      const result = await resultPromise;

      assert.strictEqual(result, null, 'Deve retornar null quando todas as tentativas falham');
      assert.ok(showErrStub.called, 'Deve exibir notificação de erro');
      assert.ok(
        showErrStub.firstCall.args[0].includes('Falha após'),
        'Mensagem deve mencionar número de tentativas',
      );
    });

    test('Notificação "Tentar Novamente" deve executar comando backupNow', async () => {
      sandbox.stub(vscode.window, 'showErrorMessage').resolves('Tentar Novamente' as any);
      const executeStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
      const op = sandbox.stub().rejects(new Error('Erro'));

      const resultPromise = retryManager.execute(op);
      await clock.tickAsync(3 * 31_000);
      await resultPromise;

      // Aguarda a Promise do showErrorMessage resolver
      await Promise.resolve();

      assert.ok(
        executeStub.calledWith('my-time-trace-vscode.backupNow'),
        'Deve executar comando backupNow ao clicar "Tentar Novamente"',
      );
    });
  });

  suite('updateConfig()', () => {
    test('Deve ser no-op sem lançar exceção', () => {
      // console.warn é interceptado pelo extension host — verificamos apenas que não lança
      assert.doesNotThrow(() => retryManager.updateConfig(5, 10_000));
    });
  });
});
