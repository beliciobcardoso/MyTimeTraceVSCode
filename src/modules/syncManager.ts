import * as vscode from 'vscode';
import { ApiKeyManager } from './apiKeyManager';
import { DeviceManager } from './deviceManager';
import { DatabaseManager } from './database';
import { SyncRetryManager } from './syncRetryManager';
import { API_BASE_URL, SYNC_BATCH_LIMIT, SYNC_DEFAULT_TIMES } from '../config/constants';

/**
 * 🔄 SyncManager
 * 
 * Orquestra toda a sincronização bidirecional entre cliente e servidor.
 * 
 * **Funcionalidades:**
 * - Push: Envia entries locais não sincronizadas para servidor
 * - Pull: Recebe entries de outros dispositivos do servidor
 * - Auto-sync: Sincronização automática em horários configurados
 * - Retry: Tentativas automáticas em caso de falha
 * - Config dinâmica: Busca configurações do servidor
 * 
 * **Fluxo:**
 * 1. Initialize: Verifica API Key e agenda auto-sync
 * 2. Auto-sync: Timer verifica horários configurados
 * 3. performSync: Push + Pull sequenciais
 * 4. Retry: SyncRetryManager tenta novamente em caso de falha
 * 
 * @see {@link https://backend.mytimetrace.com/api/sync/*}
 */
export class SyncManager {
  private apiKeyManager: ApiKeyManager;
  private deviceManager: DeviceManager;
  private dbManager: DatabaseManager;
  private retryManager: SyncRetryManager;
  private statusBarManager: any; // StatusBarManager (evita circular dependency)
  private syncTimer: NodeJS.Timeout | null = null;
  private syncTimes: string[] = SYNC_DEFAULT_TIMES; // Configurável via /sync/config
  private batchLimit: number = SYNC_BATCH_LIMIT; // Configurável via /sync/config
  private isSyncing: boolean = false;
  
  constructor(
    apiKeyManager: ApiKeyManager,
    deviceManager: DeviceManager,
    dbManager: DatabaseManager,
    statusBarManager?: any
  ) {
    this.apiKeyManager = apiKeyManager;
    this.deviceManager = deviceManager;
    this.dbManager = dbManager;
    this.statusBarManager = statusBarManager;
    this.retryManager = new SyncRetryManager();
  }
  
  /**
   * Inicializa sincronização automática
   * 
   * **Comportamento:**
   * - Se API Key NÃO configurada: retorna silenciosamente (modo local)
   * - Se API Key configurada: busca config e agenda auto-sync
   * 
   * @example
   * ```typescript
   * await syncManager.initialize();
   * // Sync agendado automaticamente se API Key existir
   * ```
   */
  async initialize(): Promise<void> {
    const hasApiKey = await this.apiKeyManager.hasApiKey();
    if (!hasApiKey) {
      console.log('🔇 Sync desabilitado: Nenhuma API Key configurada (modo local)');
      return;
    }
    
    console.log('🔄 Inicializando SyncManager...');
    
    // Carrega configurações salvas do banco (fallback para API)
    await this.loadSavedConfig();
    
    // Busca configurações de sync do servidor
    await this.fetchSyncConfig();
    
    // Agenda auto-sync
    this.scheduleAutoSync();
    
    console.log('✅ SyncManager inicializado com sucesso');
  }
  
  /**
   * Carrega configurações salvas do banco local
   */
  private async loadSavedConfig(): Promise<void> {
    try {
      const savedSyncTimes = await this.dbManager.getMetadata('sync_times');
      const savedBatchLimit = await this.dbManager.getMetadata('sync_batch_limit');
      const savedMaxRetries = await this.dbManager.getMetadata('max_retries');
      const savedRetryDelay = await this.dbManager.getMetadata('retry_delay_ms');
      
      if (savedSyncTimes) {
        this.syncTimes = JSON.parse(savedSyncTimes);
        console.log('📦 Sync times carregados do banco:', this.syncTimes);
      }
      
      if (savedBatchLimit) {
        this.batchLimit = parseInt(savedBatchLimit, 10);
        console.log('📦 Batch limit carregado do banco:', this.batchLimit);
      }
      
      if (savedMaxRetries && savedRetryDelay) {
        this.retryManager.updateConfig(
          parseInt(savedMaxRetries, 10),
          parseInt(savedRetryDelay, 10)
        );
        console.log('📦 Retry config carregado do banco:', {
          maxRetries: savedMaxRetries,
          retryDelayMs: savedRetryDelay
        });
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar config salva, usando padrão:', error);
    }
  }
  
  /**
   * Busca configurações de sync do servidor (opcional)
   * 
   * **Endpoint:** GET /sync/config
   * **Configurações:**
   * - syncTimes: Horários de auto-sync (ex: ["08:00", "17:00"])
   * - batchLimit: Limite de entries por batch (ex: 100)
   * - maxRetries: Número máximo de tentativas
   * - retryDelayMs: Delay entre tentativas
   * 
   * **Fallback:** Se falhar, usa valores padrão
   */
  private async fetchSyncConfig(): Promise<void> {
    try {
      const apiKey = await this.apiKeyManager.getApiKey();
      if (!apiKey) {return;}
      
      const response = await fetch(`${API_BASE_URL}/sync/config`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (response.ok) {
        const config: any = await response.json();
        this.syncTimes = config.syncTimes || SYNC_DEFAULT_TIMES;
        this.batchLimit = config.batchLimit || SYNC_BATCH_LIMIT;
        const maxRetries = config.maxRetries || 5;
        const retryDelayMs = config.retryDelayMs || 10000;
        
        this.retryManager.updateConfig(maxRetries, retryDelayMs);
        
        // Salva configurações no banco para persistência
        await this.dbManager.setMetadata('sync_times', JSON.stringify(this.syncTimes));
        await this.dbManager.setMetadata('sync_batch_limit', this.batchLimit.toString());
        await this.dbManager.setMetadata('max_retries', maxRetries.toString());
        await this.dbManager.setMetadata('retry_delay_ms', retryDelayMs.toString());
        
        console.log('✅ Config de sync obtida do servidor:', config);
      } else {
        console.warn('⚠️ Falha ao buscar config, usando padrão');
      }
    } catch (error) {
      console.error('⚠️ Erro ao buscar config de sync, usando padrão:', error);
    }
  }
  
  /**
   * Agenda auto-sync em horários configurados
   * 
   * **Lógica:**
   * - Verifica a cada 1 minuto se chegou hora de sincronizar
   * - Compara hora atual com syncTimes
   * - Se match: executa performSync()
   * 
   * **Exemplo:** syncTimes = ["08:00", "17:00"]
   * - 08:00 → Sync automático
   * - 17:00 → Sync automático
   */
  scheduleAutoSync(): void {
    // Limpa timer anterior se existir
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    console.log(`📅 Auto-sync agendado para: ${this.syncTimes.join(', ')}`);
    
    // Verifica a cada 1 minuto se chegou hora de sincronizar
    this.syncTimer = setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (this.syncTimes.includes(currentTime)) {
        console.log(`⏰ Horário de auto-sync detectado: ${currentTime}`);
        this.performSync();
      }
    }, 60000); // 60 segundos
  }
  
  /**
   * Executa sincronização completa (Push + Pull)
   * 
   * **Fluxo:**
   * 1. Push: Envia entries locais não sincronizadas (batches de 100)
   * 2. Pull: Recebe entries de outros dispositivos
   * 3. Retry: Tenta novamente em caso de falha
   * 4. Loop: Continua até não ter mais entries para sincronizar
   * 
   * **Comportamento:**
   * - Sucesso: Silencioso (sem notificação)
   * - Falha: SyncRetryManager notifica usuário após todas tentativas
   * 
   * @returns true se sucesso, false se erro
   * 
   * @example
   * ```typescript
   * const success = await syncManager.performSync();
   * if (success) {
   *   console.log('✅ Sync completo!');
   * }
   * ```
   */
  async performSync(): Promise<boolean> {
    // Evita sincronização simultânea
    if (this.isSyncing) {
      console.log('⏳ Sync já em andamento, ignorando nova tentativa');
      return false;
    }
    
    const apiKey = await this.apiKeyManager.getApiKey();
    if (!apiKey) {
      console.warn('⚠️ Sync cancelado: API Key não configurada');
      return false;
    }
    
    this.isSyncing = true;
    if (this.statusBarManager?.setSyncStatus) {
      this.statusBarManager.setSyncStatus(true);
    }
    console.log('🔄 Iniciando sincronização completa...');
    
    try {
      let totalSynced = 0;
      let hasMoreEntries = true;
      let batchCount = 0;
      
      // Loop: continua até não ter mais entries
      while (hasMoreEntries) {
        batchCount++;
        console.log(`🔄 Batch ${batchCount}...`);
        
        // Executa com retry automático
        const result = await this.retryManager.execute(async () => {
          const syncResult = await this.pushEntries(apiKey);
          await this.pullEntries(apiKey);
          return syncResult;
        });
        
        if (result === null) {
          console.error('❌ Sincronização falhou após todos os retries');
          return false;
        }
        
        totalSynced += result.syncedCount;
        
        // Para quando syncedCount = 0 (não tinha mais entries pra enviar)
        hasMoreEntries = result.syncedCount > 0;
        
        if (hasMoreEntries) {
          console.log(`📊 Batch ${batchCount} completo. ${result.syncedCount} entries processadas. Continuando...`);
        }
      }
      
      console.log(`✅ Sincronização completa! Total: ${totalSynced} entries em ${batchCount} batch(es)`);
      return true;
    } finally {
      this.isSyncing = false;
      if (this.statusBarManager?.setSyncStatus) {
        this.statusBarManager.setSyncStatus(false);
      }
    }
  }
  
  /**
   * Push: Envia entries locais não sincronizadas para servidor
   * 
   * **Endpoint:** POST /sync/push
   * **Limite:** 500 entries por request (conforme spec backend)
   * 
   * **Fluxo:**
   * 1. Busca entries com synced=0 do SQLite
   * 2. Envia para servidor (batch de 500)
   * 3. Marca como synced=1 no SQLite
   * 
   * @param apiKey - API Key do usuário
   * @returns Objeto com syncedCount e conflictsCount
   * @throws Error se push falhar
   */
  private async pushEntries(apiKey: string): Promise<{ syncedCount: number; conflictsCount: number }> {
    const deviceKey = await this.deviceManager.getOrCreateDeviceKey();
    
    // Busca entries não sincronizadas (limite dinâmico via /sync/config)
    const unsyncedEntries = await this.dbManager.getUnsyncedEntries(this.batchLimit);
    
    if (unsyncedEntries.length === 0) {
      console.log('✅ Push: Nenhuma entry para sincronizar');
      return { syncedCount: 0, conflictsCount: 0 };
    }
    
    console.log(`📤 Push: Enviando ${SYNC_BATCH_LIMIT} entries...`);
    
    const response = await fetch(`${API_BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        deviceKey,
        entries: unsyncedEntries.map(entry => ({
          clientId: `local-${entry.id}`,
          timestamp: entry.timestamp,
          project: entry.project || 'Unknown',
          file: entry.file || 'Unknown',
          durationSeconds: entry.duration_seconds,
          isIdle: entry.is_idle === 1
        }))
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const result: any = await response.json();
    
    // Estratégia SIMPLES: Marca TODAS as entries enviadas como synced=1
    // Motivo: Se backend aceitou → salvou na cloud
    //         Se backend rejeitou (conflito) → JÁ estava na cloud
    // Conclusão: Não precisa reenviar em ambos os casos
    
    const syncedIds = unsyncedEntries.map(e => e.id);
    await this.dbManager.markAsSynced(syncedIds);
    
    const savedCount = result.savedCount || 0;
    const conflictsCount = result.conflictsCount || 0;
    
    console.log(`✅ Push: ${unsyncedEntries.length} entries marcadas como synced`);
    if (savedCount > 0) {
      console.log(`   └─ ${savedCount} novas salvas na cloud`);
    }
    if (conflictsCount > 0) {
      console.log(`   └─ ${conflictsCount} já existiam na cloud (ignoradas)`);
    }
    
    // Retorna quantidade enviada (não importa se salvou ou conflitou)
    return {
      syncedCount: unsyncedEntries.length,
      conflictsCount: conflictsCount
    };
  }
  
  /**
   * Pull: Recebe entries de outros dispositivos do servidor
   * 
   * **Endpoint:** GET /sync/pull?deviceKey=xxx&since=xxx&limit=500
   * **Paginação:** 500 entries por vez
   * 
   * **Fluxo:**
   * 1. Busca última sincronização (last_pull_timestamp)
   * 2. Request entries após essa data
   * 3. Insere no SQLite com synced=1
   * 4. Atualiza last_pull_timestamp
   * 
   * @param apiKey - API Key do usuário
   * @throws Error se pull falhar
   */
  private async pullEntries(apiKey: string): Promise<void> {
    const deviceKey = await this.deviceManager.getOrCreateDeviceKey();
    
    // Busca última sincronização
    const lastPull = await this.dbManager.getMetadata('last_pull_timestamp');
    const since = lastPull || new Date(0).toISOString(); // Epoch se nunca sincronizou
    
    console.log(`📥 Pull: Buscando entries desde ${since}...`);
    
    const response = await fetch(
      `${API_BASE_URL}/sync/pull?deviceKey=${deviceKey}&since=${encodeURIComponent(since)}&limit=${this.batchLimit}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pull failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const result: any = await response.json();
    
    if (result.entries.length === 0) {
      console.log('✅ Pull: Nenhuma entry nova de outros dispositivos');
      await this.dbManager.setMetadata('last_pull_timestamp', new Date().toISOString());
      return;
    }
    
    console.log(`📥 Pull: Recebendo ${result.entries.length} entries...`);
    
    // Insere entries no banco local (já marcadas como synced=1)
    for (const entry of result.entries) {
      try {
        await this.dbManager.insertSyncedEntry({
          clientId: entry.clientId,
          timestamp: entry.timestamp,
          project: entry.project,
          file: entry.file,
          durationSeconds: entry.durationSeconds,
          isIdle: entry.isIdle,
          deviceKey: entry.deviceKey
        });
      } catch (error) {
        // INSERT OR IGNORE pode falhar silenciosamente se entry já existe
        console.warn(`⚠️ Entry ${entry.clientId} já existe localmente, ignorando`);
      }
    }
    
    // Atualiza timestamp de última sincronização
    await this.dbManager.setMetadata('last_pull_timestamp', result.syncedAt);
    
    console.log(`✅ Pull: ${result.entries.length} entries recebidas e armazenadas`);
  }
  
  /**
   * Limpa timer de auto-sync (chamado no dispose da extensão)
   */
  dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('🛑 SyncManager: Timer de auto-sync limpo');
    }
  }
  
  /**
   * Obtém status de sincronização atual
   * 
   * @returns Objeto com informações de status
   */
  getStatus(): {
    isSyncing: boolean;
    syncTimes: string[];
    batchLimit: number;
    retryConfig: { maxRetries: number; retryDelayMs: number };
  } {
    return {
      isSyncing: this.isSyncing,
      syncTimes: this.syncTimes,
      batchLimit: this.batchLimit,
      retryConfig: this.retryManager.getConfig()
    };
  }
}
