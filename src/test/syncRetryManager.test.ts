import * as assert from 'assert';
import * as sinon from 'sinon';
import { SyncRetryManager } from '../modules/syncRetryManager';

/**
 * 🧪 Testes Unitários - SyncRetryManager
 * 
 * Cobertura:
 * - Configuração dinâmica (maxRetries, retryDelayMs)
 * - Execução com retry automático
 * - Delay entre tentativas
 * - Notificação de falha total
 */
suite('SyncRetryManager Tests', () => {
  let retryManager: SyncRetryManager;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    retryManager = new SyncRetryManager();
    clock = sinon.useFakeTimers(); // Mock de setTimeout
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
  });

  suite('updateConfig()', () => {
    test('Deve atualizar configurações de retry', () => {
      retryManager.updateConfig(3, 5000);

      const config = retryManager.getConfig();
      assert.strictEqual(config.maxRetries, 3);
      assert.strictEqual(config.retryDelayMs, 5000);
    });

    test('Deve limitar maxRetries entre 1 e 10', () => {
      retryManager.updateConfig(0, 5000); // Menor que 1
      assert.strictEqual(retryManager.getConfig().maxRetries, 1);

      retryManager.updateConfig(15, 5000); // Maior que 10
      assert.strictEqual(retryManager.getConfig().maxRetries, 10);
    });

    test('Deve limitar retryDelayMs entre 1000 e 60000', () => {
      retryManager.updateConfig(3, 500); // Menor que 1000
      assert.strictEqual(retryManager.getConfig().retryDelayMs, 1000);

      retryManager.updateConfig(3, 90000); // Maior que 60000
      assert.strictEqual(retryManager.getConfig().retryDelayMs, 60000);
    });
  });

  suite('execute()', () => {
    test('Deve retornar resultado se operação suceder na primeira tentativa', async () => {
      const operation = sinon.stub().resolves({ success: true });

      const result = await retryManager.execute(operation);

      assert.deepStrictEqual(result, { success: true });
      assert.strictEqual(operation.callCount, 1);
    });

    test('Deve tentar novamente se primeira tentativa falhar', async () => {
      const operation = sinon.stub()
        .onFirstCall().rejects(new Error('Network error'))
        .onSecondCall().resolves({ success: true });

      retryManager.updateConfig(5, 100); // 5 tentativas, 100ms delay

      const executePromise = retryManager.execute(operation);

      // Avança tempo para permitir retry
      await clock.tickAsync(100);

      const result = await executePromise;

      assert.deepStrictEqual(result, { success: true });
      assert.strictEqual(operation.callCount, 2);
    });

    test('Deve retornar null se todas tentativas falharem', async () => {
      const operation = sinon.stub().rejects(new Error('Network error'));

      retryManager.updateConfig(3, 100); // 3 tentativas, 100ms delay

      const executePromise = retryManager.execute(operation);

      // Avança tempo para permitir todos os retries
      await clock.tickAsync(100); // Tentativa 2
      await clock.tickAsync(100); // Tentativa 3

      const result = await executePromise;

      assert.strictEqual(result, null);
      assert.strictEqual(operation.callCount, 3);
    });

    test('Deve aguardar delay entre tentativas', async () => {
      const operation = sinon.stub()
        .onFirstCall().rejects(new Error('Error 1'))
        .onSecondCall().rejects(new Error('Error 2'))
        .onThirdCall().resolves({ success: true });

      retryManager.updateConfig(5, 1000); // 1000ms delay

      const executePromise = retryManager.execute(operation);

      // Primeira tentativa (imediata)
      await Promise.resolve();
      assert.strictEqual(operation.callCount, 1);

      // Avança 999ms (não deve executar ainda)
      await clock.tickAsync(999);
      assert.strictEqual(operation.callCount, 1);

      // Avança mais 1ms (total 1000ms, deve executar tentativa 2)
      await clock.tickAsync(1);
      await Promise.resolve();
      assert.strictEqual(operation.callCount, 2);

      // Avança mais 1000ms (tentativa 3)
      await clock.tickAsync(1000);
      await Promise.resolve();
      assert.strictEqual(operation.callCount, 3);

      const result = await executePromise;
      assert.deepStrictEqual(result, { success: true });
    });

    test('Não deve aguardar delay após última tentativa (falha)', async () => {
      const operation = sinon.stub().rejects(new Error('Network error'));

      retryManager.updateConfig(2, 1000); // 2 tentativas, 1000ms delay

      const start = Date.now();
      const executePromise = retryManager.execute(operation);

      // Tentativa 1 (imediata)
      await Promise.resolve();

      // Tentativa 2 (após 1000ms)
      await clock.tickAsync(1000);

      await executePromise;
      const elapsed = Date.now() - start;

      // Total: 1000ms (1 delay entre tentativa 1 e 2, sem delay após 2)
      assert.strictEqual(elapsed, 1000);
      assert.strictEqual(operation.callCount, 2);
    });
  });

  suite('getConfig()', () => {
    test('Deve retornar configurações atuais', () => {
      retryManager.updateConfig(7, 15000);

      const config = retryManager.getConfig();

      assert.deepStrictEqual(config, {
        maxRetries: 7,
        retryDelayMs: 15000
      });
    });

    test('Deve retornar configurações padrão se não atualizado', () => {
      const config = retryManager.getConfig();

      assert.strictEqual(config.maxRetries, 5);
      assert.strictEqual(config.retryDelayMs, 10000);
    });
  });

  suite('Logging e Notificações', () => {
    test('Deve logar tentativas e erros', async () => {
      const consoleLogStub = sinon.stub(console, 'log');
      const consoleErrorStub = sinon.stub(console, 'error');

      const operation = sinon.stub()
        .onFirstCall().rejects(new Error('Network error'))
        .onSecondCall().resolves({ success: true });

      retryManager.updateConfig(5, 100);

      const executePromise = retryManager.execute(operation);
      await clock.tickAsync(100);
      await executePromise;

      // Verifica logs de tentativas
      assert.strictEqual(consoleLogStub.called, true);
      assert.strictEqual(consoleErrorStub.called, true);

      // Verifica mensagens de log
      const logCalls = consoleLogStub.getCalls().map(call => call.args[0]);
      assert.ok(logCalls.some(msg => msg.includes('Tentativa 1/5')));
      assert.ok(logCalls.some(msg => msg.includes('Sucesso na tentativa 2')));
    });
  });
});
