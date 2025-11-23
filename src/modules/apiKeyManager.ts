import * as vscode from 'vscode';
import { API_BASE_URL, SECRET_KEYS } from '../config/constants';

/**
 * 🔐 ApiKeyManager
 * 
 * Gerencia a API Key do usuário de forma segura usando SecretStorage do VS Code.
 * A chave é criptografada automaticamente pelo sistema operacional (Keychain, Credential Manager, libsecret).
 * 
 * **Formato da API Key:** `mtt_xxxxx` (32 caracteres alfanuméricos após o prefixo)
 * 
 * **Fluxo:**
 * 1. Usuário cria conta na plataforma web MyTimeTrace
 * 2. Plataforma gera API Key única
 * 3. Usuário cola na extensão via comando "Set API Key"
 * 4. ApiKeyManager valida formato e armazena criptografado
 * 5. Testa conexão com servidor backend
 * 
 * @see {@link https://code.visualstudio.com/api/references/vscode-api#SecretStorage}
 */
export class ApiKeyManager {
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  /**
   * Salva API Key no SecretStorage (criptografado nativamente)
   * 
   * @param apiKey - API Key no formato: mtt_xxxxx (32 chars)
   * @throws {Error} Se formato for inválido
   * 
   * @example
   * ```typescript
   * await apiKeyManager.setApiKey('mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p');
   * ```
   */
  async setApiKey(apiKey: string): Promise<void> {
    if (!this.validateApiKeyFormat(apiKey)) {
      throw new Error('Formato inválido. Esperado: mtt_xxxxx (32 caracteres alfanuméricos)');
    }
    
    await this.context.secrets.store(SECRET_KEYS.API_KEY, apiKey);
    console.log('✅ API Key salva com sucesso (criptografada)');
  }
  
  /**
   * Recupera API Key do SecretStorage
   * 
   * @returns API Key ou undefined se não configurada
   * 
   * @example
   * ```typescript
   * const apiKey = await apiKeyManager.getApiKey();
   * if (apiKey) {
   *   console.log('API Key configurada:', apiKey.slice(0, 7) + '...');
   * }
   * ```
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(SECRET_KEYS.API_KEY);
  }
  
  /**
   * Remove API Key do SecretStorage
   * 
   * Usado quando usuário quer desativar sincronização ou regenerou chave no servidor.
   * 
   * @example
   * ```typescript
   * await apiKeyManager.revokeApiKey();
   * console.log('Modo local ativado');
   * ```
   */
  async revokeApiKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEYS.API_KEY);
    console.log('🔓 API Key removida');
  }
  
  /**
   * Valida formato da API Key
   * 
   * **Formato esperado:** `mtt_` + 32 caracteres alfanuméricos (case-insensitive)
   * 
   * @param apiKey - Chave a ser validada
   * @returns true se válida, false caso contrário
   * 
   * @example
   * ```typescript
   * validateApiKeyFormat('mtt_abc123xyz') // false - muito curto
   * validateApiKeyFormat('mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p') // true
   * validateApiKeyFormat('invalid_key') // false - prefixo errado
   * ```
   */
  private validateApiKeyFormat(apiKey: string): boolean {
    // Regex: mtt_ + 32 caracteres alfanuméricos
    const regex = /^mtt_[a-z0-9]{32}$/i;
    return regex.test(apiKey);
  }
  
  /**
   * Testa conexão com servidor usando a API Key configurada
   * 
   * Faz request no endpoint /sync/status para validar se:
   * - Servidor está acessível
   * - API Key é válida (não retorna 401)
   * 
   * @returns true se conexão OK, false em caso de erro
   * 
   * @example
   * ```typescript
   * const isValid = await apiKeyManager.testConnection();
   * if (isValid) {
   *   vscode.window.showInformationMessage('✅ Conexão OK!');
   * } else {
   *   vscode.window.showWarningMessage('❌ Falha na conexão');
   * }
   * ```
   */
  async testConnection(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.warn('⚠️ Nenhuma API Key configurada para testar');
      return false;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/sync/status`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (response.ok) {
        console.log('✅ Conexão com servidor OK');
        return true;
      } else if (response.status === 401) {
        console.error('❌ API Key inválida (HTTP 401)');
        return false;
      } else if (response.status === 403) {
        console.error('❌ API Key desabilitada (HTTP 403)');
        return false;
      } else {
        console.error(`❌ Erro no servidor (HTTP ${response.status})`);
        return false;
      }
    } catch (error) {
      console.error('❌ Falha ao conectar com servidor:', error);
      return false;
    }
  }
  
  /**
   * Retorna API Key mascarada para exibição segura
   * 
   * Mostra apenas primeiros 7 e últimos 3 caracteres.
   * 
   * @returns String mascarada ou 'Não configurada'
   * 
   * @example
   * ```typescript
   * const masked = await apiKeyManager.getMaskedApiKey();
   * console.log(masked); // "mtt_1a2...6p"
   * ```
   */
  async getMaskedApiKey(): Promise<string> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return 'Não configurada';
    }
    
    return `${apiKey.slice(0, 7)}...${apiKey.slice(-3)}`;
  }
  
  /**
   * Verifica se API Key está configurada
   * 
   * @returns true se configurada, false caso contrário
   * 
   * @example
   * ```typescript
   * if (await apiKeyManager.hasApiKey()) {
   *   console.log('Sincronização disponível');
   * } else {
   *   console.log('Modo local apenas');
   * }
   * ```
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return apiKey !== undefined && apiKey.length > 0;
  }
}
