import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ApiKeyManager } from '../modules/apiKeyManager';

/**
 * 🧪 Testes Unitários - ApiKeyManager
 * 
 * Cobertura:
 * - Validação de formato de API Key
 * - Armazenamento/recuperação via SecretStorage
 * - Remoção de API Key
 * - Teste de conexão com servidor
 * - Máscaramento de API Key
 */
suite('ApiKeyManager Tests', () => {
  let context: vscode.ExtensionContext;
  let apiKeyManager: ApiKeyManager;
  let secretsStub: any;
  let fetchStub: sinon.SinonStub;

  setup(() => {
    // Mock do SecretStorage
    secretsStub = {
      store: sinon.stub().resolves(),
      get: sinon.stub().resolves(undefined),
      delete: sinon.stub().resolves()
    };

    // Mock do ExtensionContext
    context = {
      secrets: secretsStub
    } as any;

    // Mock do fetch global
    fetchStub = sinon.stub(global, 'fetch' as any);

    apiKeyManager = new ApiKeyManager(context);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('setApiKey()', () => {
    test('Deve aceitar API Key válida (formato correto)', async () => {
      const validKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';

      await apiKeyManager.setApiKey(validKey);

      assert.strictEqual(secretsStub.store.calledOnce, true);
      assert.strictEqual(secretsStub.store.firstCall.args[0], 'mytimetrace.apiKey');
      assert.strictEqual(secretsStub.store.firstCall.args[1], validKey);
    });

    test('Deve rejeitar API Key sem prefixo mtt_', async () => {
      const invalidKey = 'abc_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';

      await assert.rejects(
        async () => await apiKeyManager.setApiKey(invalidKey),
        /Formato inválido/
      );

      assert.strictEqual(secretsStub.store.called, false);
    });

    test('Deve rejeitar API Key com menos de 32 caracteres', async () => {
      const invalidKey = 'mtt_abc123'; // Muito curto

      await assert.rejects(
        async () => await apiKeyManager.setApiKey(invalidKey),
        /Formato inválido/
      );

      assert.strictEqual(secretsStub.store.called, false);
    });

    test('Deve rejeitar API Key com caracteres especiais', async () => {
      const invalidKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n@#$%';

      await assert.rejects(
        async () => await apiKeyManager.setApiKey(invalidKey),
        /Formato inválido/
      );

      assert.strictEqual(secretsStub.store.called, false);
    });

    test('Deve aceitar API Key case-insensitive', async () => {
      const upperKey = 'MTT_1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P';

      await apiKeyManager.setApiKey(upperKey);

      assert.strictEqual(secretsStub.store.calledOnce, true);
    });
  });

  suite('getApiKey()', () => {
    test('Deve retornar undefined se API Key não configurada', async () => {
      secretsStub.get.resolves(undefined);

      const result = await apiKeyManager.getApiKey();

      assert.strictEqual(result, undefined);
      assert.strictEqual(secretsStub.get.calledWith('mytimetrace.apiKey'), true);
    });

    test('Deve retornar API Key se configurada', async () => {
      const savedKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      secretsStub.get.resolves(savedKey);

      const result = await apiKeyManager.getApiKey();

      assert.strictEqual(result, savedKey);
    });
  });

  suite('revokeApiKey()', () => {
    test('Deve remover API Key do SecretStorage', async () => {
      await apiKeyManager.revokeApiKey();

      assert.strictEqual(secretsStub.delete.calledOnce, true);
      assert.strictEqual(secretsStub.delete.firstCall.args[0], 'mytimetrace.apiKey');
    });
  });

  suite('testConnection()', () => {
    test('Deve retornar false se API Key não configurada', async () => {
      secretsStub.get.resolves(undefined);

      const result = await apiKeyManager.testConnection();

      assert.strictEqual(result, false);
      assert.strictEqual(fetchStub.called, false);
    });

    test('Deve retornar true se servidor responde 200 OK', async () => {
      const validKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      secretsStub.get.resolves(validKey);

      fetchStub.resolves({
        ok: true,
        status: 200
      });

      const result = await apiKeyManager.testConnection();

      assert.strictEqual(result, true);
      assert.strictEqual(fetchStub.calledOnce, true);
      assert.strictEqual(
        fetchStub.firstCall.args[0],
        'http://localhost:8989/api/sync/status'
      );
      assert.deepStrictEqual(fetchStub.firstCall.args[1].headers, {
        'X-API-Key': validKey
      });
    });

    test('Deve retornar false se servidor responde 401 Unauthorized', async () => {
      const invalidKey = 'mtt_invalid_key_abc123xyz789000000';
      secretsStub.get.resolves(invalidKey);

      fetchStub.resolves({
        ok: false,
        status: 401
      });

      const result = await apiKeyManager.testConnection();

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se servidor responde 403 Forbidden', async () => {
      const disabledKey = 'mtt_disabled_key_abc123xyz78900000';
      secretsStub.get.resolves(disabledKey);

      fetchStub.resolves({
        ok: false,
        status: 403
      });

      const result = await apiKeyManager.testConnection();

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se servidor está offline (erro de rede)', async () => {
      const validKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      secretsStub.get.resolves(validKey);

      fetchStub.rejects(new Error('Network error'));

      const result = await apiKeyManager.testConnection();

      assert.strictEqual(result, false);
    });
  });

  suite('getMaskedApiKey()', () => {
    test('Deve retornar "Não configurada" se API Key não existe', async () => {
      secretsStub.get.resolves(undefined);

      const result = await apiKeyManager.getMaskedApiKey();

      assert.strictEqual(result, 'Não configurada');
    });

    test('Deve mascarar API Key mostrando apenas início e fim', async () => {
      const fullKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      secretsStub.get.resolves(fullKey);

      const result = await apiKeyManager.getMaskedApiKey();

      // Mostra: mtt_1a2...o6p
      assert.strictEqual(result, 'mtt_1a2...o6p');
    });
  });

  suite('hasApiKey()', () => {
    test('Deve retornar false se API Key não configurada', async () => {
      secretsStub.get.resolves(undefined);

      const result = await apiKeyManager.hasApiKey();

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se API Key é string vazia', async () => {
      secretsStub.get.resolves('');

      const result = await apiKeyManager.hasApiKey();

      assert.strictEqual(result, false);
    });

    test('Deve retornar true se API Key configurada', async () => {
      const validKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      secretsStub.get.resolves(validKey);

      const result = await apiKeyManager.hasApiKey();

      assert.strictEqual(result, true);
    });
  });
});
