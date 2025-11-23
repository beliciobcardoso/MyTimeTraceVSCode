import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { DeviceManager } from '../modules/deviceManager';
import * as deviceInfo from '../modules/deviceInfo';

/**
 * 🧪 Testes Unitários - DeviceManager
 * 
 * Cobertura:
 * - Geração de device_key (UUID v4)
 * - Armazenamento/recuperação via SecretStorage
 * - Remoção de device_key
 * - Registro de dispositivo no servidor
 * - Obtenção de informações de hardware
 */
suite('DeviceManager Tests', () => {
  let context: vscode.ExtensionContext;
  let deviceManager: DeviceManager;
  let secretsStub: any;
  let fetchStub: sinon.SinonStub;
  let getDeviceInfoStub: sinon.SinonStub;
  let getDeviceNameStub: sinon.SinonStub;

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

    // Mock das funções de deviceInfo
    getDeviceInfoStub = sinon.stub(deviceInfo, 'getDeviceInfo');
    getDeviceNameStub = sinon.stub(deviceInfo, 'getDeviceName');

    getDeviceInfoStub.returns({
      hostname: 'DESKTOP-TEST',
      platform: 'linux',
      arch: 'x64',
      type: 'Linux',
      release: 'Ubuntu 22.04'
    });

    getDeviceNameStub.returns('DESKTOP-TEST');

    deviceManager = new DeviceManager(context);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('getOrCreateDeviceKey()', () => {
    test('Deve gerar novo device_key se não existe', async () => {
      secretsStub.get.resolves(undefined);

      const deviceKey = await deviceManager.getOrCreateDeviceKey();

      // Valida formato UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(deviceKey, uuidRegex);

      // Verifica se salvou no SecretStorage
      assert.strictEqual(secretsStub.store.calledOnce, true);
      assert.strictEqual(secretsStub.store.firstCall.args[0], 'mytimetrace.deviceKey');
      assert.match(secretsStub.store.firstCall.args[1], uuidRegex);
    });

    test('Deve retornar device_key existente se já foi gerado', async () => {
      const existingKey = '550e8400-e29b-41d4-a716-446655440000';
      secretsStub.get.resolves(existingKey);

      const deviceKey = await deviceManager.getOrCreateDeviceKey();

      assert.strictEqual(deviceKey, existingKey);
      assert.strictEqual(secretsStub.store.called, false); // Não deve salvar novamente
    });

    test('Deve gerar device_key único a cada chamada (se não existe)', async () => {
      secretsStub.get.resolves(undefined);

      const deviceKey1 = await deviceManager.getOrCreateDeviceKey();
      
      // Reset para simular nova instalação
      secretsStub.store.resetHistory();
      secretsStub.get.resolves(undefined);
      
      const deviceKey2 = await deviceManager.getOrCreateDeviceKey();

      assert.notStrictEqual(deviceKey1, deviceKey2);
    });
  });

  suite('revokeDeviceKey()', () => {
    test('Deve remover device_key do SecretStorage', async () => {
      await deviceManager.revokeDeviceKey();

      assert.strictEqual(secretsStub.delete.calledOnce, true);
      assert.strictEqual(secretsStub.delete.firstCall.args[0], 'mytimetrace.deviceKey');
    });
  });

  suite('hasDeviceKey()', () => {
    test('Deve retornar false se device_key não configurado', async () => {
      secretsStub.get.resolves(undefined);

      const result = await deviceManager.hasDeviceKey();

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se device_key é string vazia', async () => {
      secretsStub.get.resolves('');

      const result = await deviceManager.hasDeviceKey();

      assert.strictEqual(result, false);
    });

    test('Deve retornar true se device_key configurado', async () => {
      const validKey = '550e8400-e29b-41d4-a716-446655440000';
      secretsStub.get.resolves(validKey);

      const result = await deviceManager.hasDeviceKey();

      assert.strictEqual(result, true);
    });
  });

  suite('getDeviceInfo()', () => {
    test('Deve retornar informações completas do dispositivo', () => {
      const info = deviceManager.getDeviceInfo();

      assert.deepStrictEqual(info, {
        hostname: 'DESKTOP-TEST',
        platform: 'linux',
        arch: 'x64',
        type: 'Linux',
        release: 'Ubuntu 22.04'
      });

      assert.strictEqual(getDeviceInfoStub.calledOnce, true);
    });
  });

  suite('getDeviceName()', () => {
    test('Deve retornar nome amigável do dispositivo', () => {
      const name = deviceManager.getDeviceName();

      assert.strictEqual(name, 'DESKTOP-TEST');
      assert.strictEqual(getDeviceNameStub.calledOnce, true);
    });
  });

  suite('registerDevice()', () => {
    const validApiKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
    const mockDeviceKey = '550e8400-e29b-41d4-a716-446655440000';

    setup(() => {
      secretsStub.get.resolves(mockDeviceKey);
    });

    test('Deve registrar dispositivo com sucesso (201 Created)', async () => {
      fetchStub.resolves({
        ok: true,
        status: 201,
        json: async () => ({
          message: 'Device registered successfully',
          device: { id: 'device-uuid-123', deviceKey: mockDeviceKey }
        })
      });

      const result = await deviceManager.registerDevice(validApiKey);

      assert.strictEqual(result, true);
      assert.strictEqual(fetchStub.calledOnce, true);

      const fetchArgs = fetchStub.firstCall.args;
      assert.strictEqual(fetchArgs[0], 'http://localhost:8989/api/sync/register');
      
      const requestOptions = fetchArgs[1];
      assert.strictEqual(requestOptions.method, 'POST');
      assert.deepStrictEqual(requestOptions.headers, {
        'Content-Type': 'application/json',
        'X-API-Key': validApiKey
      });

      const body = JSON.parse(requestOptions.body);
      assert.strictEqual(body.deviceKey, mockDeviceKey);
      assert.strictEqual(body.deviceName, 'DESKTOP-TEST');
      assert.strictEqual(body.deviceHostname, 'DESKTOP-TEST');
      assert.strictEqual(body.devicePlatform, 'linux');
      assert.strictEqual(body.deviceArch, 'x64');
      assert.strictEqual(body.deviceType, 'Linux');
      assert.strictEqual(body.deviceRelease, 'Ubuntu 22.04');
    });

    test('Deve atualizar dispositivo existente (200 OK)', async () => {
      fetchStub.resolves({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Device already registered',
          device: { id: 'device-uuid-123', deviceKey: mockDeviceKey }
        })
      });

      const result = await deviceManager.registerDevice(validApiKey);

      assert.strictEqual(result, true);
    });

    test('Deve retornar false se API Key inválida (401)', async () => {
      fetchStub.resolves({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      const result = await deviceManager.registerDevice('invalid-key');

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se servidor está offline', async () => {
      fetchStub.rejects(new Error('Network error'));

      const result = await deviceManager.registerDevice(validApiKey);

      assert.strictEqual(result, false);
    });

    test('Deve retornar false se servidor responde 500', async () => {
      fetchStub.resolves({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await deviceManager.registerDevice(validApiKey);

      assert.strictEqual(result, false);
    });
  });

  suite('getSyncStatus()', () => {
    const validApiKey = 'mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
    const mockDeviceKey = '550e8400-e29b-41d4-a716-446655440000';

    setup(() => {
      secretsStub.get.resolves(mockDeviceKey);
    });

    test('Deve retornar status de sincronização com sucesso', async () => {
      const mockStatus = {
        currentDevice: {
          id: 'device-uuid-1',
          deviceKey: mockDeviceKey,
          deviceName: 'DESKTOP-TEST',
          totalEntries: 150,
          lastSeen: '2025-11-22T10:00:00Z'
        },
        otherDevices: [
          {
            id: 'device-uuid-2',
            deviceName: 'Notebook Dell',
            totalEntries: 100,
            lastSeen: '2025-11-22T08:00:00Z'
          }
        ],
        totals: {
          totalDevices: 2,
          totalEntries: 250,
          totalEntriesAllDevices: 250
        }
      };

      fetchStub.resolves({
        ok: true,
        status: 200,
        json: async () => mockStatus
      });

      const result = await deviceManager.getSyncStatus(validApiKey);

      assert.deepStrictEqual(result, mockStatus);
      assert.strictEqual(fetchStub.calledOnce, true);

      const fetchUrl = fetchStub.firstCall.args[0];
      assert.match(fetchUrl, /\/sync\/status\?deviceKey=/);
      assert.match(fetchUrl, new RegExp(mockDeviceKey));
    });

    test('Deve retornar null se erro na requisição', async () => {
      fetchStub.resolves({
        ok: false,
        status: 500
      });

      const result = await deviceManager.getSyncStatus(validApiKey);

      assert.strictEqual(result, null);
    });

    test('Deve retornar null se servidor está offline', async () => {
      fetchStub.rejects(new Error('Network error'));

      const result = await deviceManager.getSyncStatus(validApiKey);

      assert.strictEqual(result, null);
    });
  });
});
