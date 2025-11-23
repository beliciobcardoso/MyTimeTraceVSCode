import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { getDeviceInfo, getDeviceName } from './deviceInfo';
import { API_BASE_URL, SECRET_KEYS } from '../config/constants';

/**
 * 💻 DeviceManager
 * 
 * Gerencia o device_key (identificador único do dispositivo) e informações do hardware.
 * 
 * **Conceito:**
 * - Cada instalação da extensão = 1 device_key único (UUID v4)
 * - Gerado automaticamente na primeira sincronização
 * - Armazenado criptografado no SecretStorage
 * - NÃO sincroniza entre máquinas (cada PC tem o seu)
 * 
 * **Fluxo:**
 * 1. Usuário configura API Key
 * 2. DeviceManager gera UUID v4 automaticamente (se não existir)
 * 3. Registra dispositivo no servidor com info de hardware
 * 4. Server associa device_key ao userId (via API Key)
 * 
 * @see {@link https://code.visualstudio.com/api/references/vscode-api#SecretStorage}
 */
export class DeviceManager {
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  /**
   * Gera ou recupera device_key existente
   * 
   * **Comportamento:**
   * - Se device_key JÁ EXISTE: retorna do SecretStorage
   * - Se NÃO EXISTE: gera UUID v4 novo e salva criptografado
   * 
   * **Importante:** Mesmo device_key é usado para toda vida útil da extensão neste PC.
   * 
   * @returns device_key (UUID v4)
   * 
   * @example
   * ```typescript
   * const deviceKey = await deviceManager.getOrCreateDeviceKey();
   * console.log('Device Key:', deviceKey); // "550e8400-e29b-41d4-a716-446655440000"
   * ```
   */
  async getOrCreateDeviceKey(): Promise<string> {
    let deviceKey = await this.context.secrets.get(SECRET_KEYS.DEVICE_KEY);
    
    if (!deviceKey) {
      // Gera UUID v4 único para este dispositivo
      deviceKey = uuidv4();
      await this.context.secrets.store(SECRET_KEYS.DEVICE_KEY, deviceKey);
      console.log('🆕 Device Key gerado:', deviceKey);
    } else {
      console.log('✅ Device Key recuperado:', deviceKey);
    }
    
    return deviceKey;
  }
  
  /**
   * Remove device_key do SecretStorage
   * 
   * Usado quando usuário revoga API Key ou desinstala extensão.
   * Próxima sincronização gerará novo device_key.
   * 
   * @example
   * ```typescript
   * await deviceManager.revokeDeviceKey();
   * console.log('Device desvinculado');
   * ```
   */
  async revokeDeviceKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEYS.DEVICE_KEY);
    console.log('🔓 Device Key removido');
  }
  
  /**
   * Verifica se device_key já foi gerado
   * 
   * @returns true se device_key existe, false caso contrário
   * 
   * @example
   * ```typescript
   * if (await deviceManager.hasDeviceKey()) {
   *   console.log('Dispositivo já registrado');
   * }
   * ```
   */
  async hasDeviceKey(): Promise<boolean> {
    const deviceKey = await this.context.secrets.get(SECRET_KEYS.DEVICE_KEY);
    return deviceKey !== undefined && deviceKey.length > 0;
  }
  
  /**
   * Obtém informações completas do dispositivo
   * 
   * Usa módulo existente `deviceInfo.ts` para coletar dados de hardware.
   * 
   * @returns Objeto com informações do dispositivo
   * 
   * @example
   * ```typescript
   * const info = deviceManager.getDeviceInfo();
   * console.log(info);
   * // {
   * //   hostname: "DESKTOP-ABC",
   * //   platform: "linux",
   * //   arch: "x64",
   * //   type: "PC",
   * //   release: "Ubuntu 22.04"
   * // }
   * ```
   */
  getDeviceInfo() {
    return getDeviceInfo(); // Usa módulo existente
  }
  
  /**
   * Obtém apenas o nome amigável do dispositivo
   * 
   * @returns Nome do dispositivo (hostname)
   * 
   * @example
   * ```typescript
   * const name = deviceManager.getDeviceName();
   * console.log('Este PC:', name); // "Notebook Dell"
   * ```
   */
  getDeviceName(): string {
    return getDeviceName(); // Usa módulo existente
  }
  
  /**
   * Registra dispositivo no servidor backend
   * 
   * **Fluxo:**
   * 1. Gera/recupera device_key
   * 2. Coleta informações de hardware (deviceInfo.ts)
   * 3. Envia POST /sync/register com header X-API-Key
   * 4. Servidor associa device ao user_id (via API Key)
   * 
   * **Responses:**
   * - 201 Created: Dispositivo registrado pela primeira vez
   * - 200 OK: Dispositivo já estava registrado (atualiza info)
   * - 401 Unauthorized: API Key inválida
   * 
   * @param apiKey - API Key do usuário (obtida via ApiKeyManager)
   * @returns true se sucesso, false se erro
   * 
   * @example
   * ```typescript
   * const apiKey = await apiKeyManager.getApiKey();
   * if (apiKey) {
   *   const success = await deviceManager.registerDevice(apiKey);
   *   if (success) {
   *     console.log('✅ Dispositivo registrado!');
   *   }
   * }
   * ```
   */
  async registerDevice(apiKey: string): Promise<boolean> {
    const deviceKey = await this.getOrCreateDeviceKey();
    const deviceInfo = this.getDeviceInfo();
    const deviceName = this.getDeviceName();
    
    try {
      const response = await fetch(`${API_BASE_URL}/sync/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          deviceKey,
          deviceName,
          deviceHostname: deviceInfo.hostname,
          devicePlatform: deviceInfo.platform,
          deviceArch: deviceInfo.arch,
          deviceType: deviceInfo.type,
          deviceRelease: deviceInfo.release
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro ao registrar device (HTTP ${response.status}):`, errorText);
        return false;
      }
      
      const result = await response.json();
      
      if (response.status === 201) {
        console.log('✅ Dispositivo registrado pela primeira vez:', result);
      } else if (response.status === 200) {
        console.log('✅ Dispositivo já estava registrado (info atualizada):', result);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Falha ao registrar device:', error);
      return false;
    }
  }
  
  /**
   * Busca status de sincronização do servidor
   * 
   * Retorna informações sobre este dispositivo e outros do mesmo usuário.
   * 
   * @param apiKey - API Key do usuário
   * @returns Objeto com status de sincronização ou null se erro
   * 
   * @example
   * ```typescript
   * const status = await deviceManager.getSyncStatus(apiKey);
   * if (status) {
   *   console.log('Total de entries:', status.currentDevice.totalEntries);
   *   console.log('Outros PCs:', status.otherDevices.length);
   * }
   * ```
   */
  async getSyncStatus(apiKey: string): Promise<any | null> {
    const deviceKey = await this.getOrCreateDeviceKey();
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/sync/status?deviceKey=${deviceKey}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey
          }
        }
      );
      
      if (!response.ok) {
        console.error(`❌ Erro ao buscar status (HTTP ${response.status})`);
        return null;
      }
      
      const status = await response.json();
      console.log('✅ Status de sincronização:', status);
      return status;
    } catch (error) {
      console.error('❌ Falha ao buscar status:', error);
      return null;
    }
  }
}
