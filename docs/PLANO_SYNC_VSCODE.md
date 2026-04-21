# 📋 Plano de Ação - Implementação de Sincronização (Extensão VS Code)

⚠️ **STATUS: LEGADO (Deprecated desde v0.5.0)**  
Este é o planejamento original com sincronização bidirecional (push + pull). A partir de v0.5.0, o sync é **unidirecional (push-only)**. Veja [PLANO_SYNC_UNIDIRECIONAL_EXT_CLOUD.md](PLANO_SYNC_UNIDIRECIONAL_EXT_CLOUD.md) para o plano atual.

**Data:** 22 de novembro de 2025  
**Versão Atual:** v0.3.1 (HISTÓRICO)  
**Feature:** Sincronização Cloud Multi-Dispositivo (LEGADO)  
**Status:** ✅ Substituído por arquitetura push-only

---

## ⚠️ CONTEXTO IMPORTANTE

### 🎯 Escopo Deste Projeto

**✅ ESTE REPOSITÓRIO (MyTimeTrace VS Code Extension):**
- Implementa APENAS a extensão VS Code
- Consome API REST do backend
- Gerencia sincronização local ↔ cloud
- Interface de usuário (comandos, painéis, notificações)

**❌ ESTE REPOSITÓRIO NÃO IMPLEMENTA:**
- Backend/API REST (repositório separado)
- Banco de dados PostgreSQL
- Lógica de servidor
- Admin panel web

### 📡 Backend API (Repositório Separado)

**Status:** ✅ **100% IMPLEMENTADO E FUNCIONAL**

- **Base URL:** `http://localhost:8989/api`
- **Swagger:** `http://localhost:8989/api/docs`
- **Autenticação:** Header `X-API-Key`
- **Endpoints Disponíveis:**
  - `POST /sync/register` - Registrar dispositivo
  - `POST /sync/push` - Enviar entries locais
  - `GET /sync/pull` - Receber entries de outros PCs (legado, removido em v0.5.0)
  - `GET /sync/status` - Status de sincronização
  - `GET/PUT /sync/config` - Configurações (superadmin)

**Comunicação:** Qualquer mudança no backend será comunicada previamente.

---

## 🎯 Objetivos da Feature

### Funcionalidades Principais

1. **Autenticação Cloud**
   - Gerenciar API Key via SecretStorage
   - Comandos: Set, View, Revoke API Key

2. **Sincronização Bidirecional (LEGADO - Removida em v0.5.0)**
   - Push: Enviar entries locais → servidor ✅ mantido
   - Pull: Receber entries de outros PCs → local ❌ removido
   - Auto-sync em horários configurados

3. **Multi-Dispositivo**
   - Gerar device_key único por instalação
   - Registrar dispositivo no servidor
   - Visualizar status de outros dispositivos

4. **Experiência do Usuário**
   - Modo local 100% funcional (sem API Key)
   - Notificações apenas em erros críticos
   - Interface de status e configuração

---

## 📊 Arquitetura Proposta

### Estrutura de Módulos

```
src/modules/
├── apiKeyManager.ts          # 🔐 NOVO - Gerencia API Key
├── deviceManager.ts          # 💻 NOVO - Gerencia device_key
├── syncManager.ts            # 🔄 NOVO - Orquestra sincronização
├── syncRetryManager.ts       # 🔄 NOVO - Lógica de retry
├── timeTrace.ts              # ⏱️ EXISTENTE - Adicionar hooks sync
├── database.ts               # 💾 EXISTENTE - Adicionar métodos sync
├── commands.ts               # ⌨️ EXISTENTE - Adicionar comandos sync
└── statusBar.ts              # 📊 EXISTENTE - Adicionar status sync
```

### Fluxo de Dados

```
┌──────────────────────────────────────────────────────────┐
│ 1. USUÁRIO CONFIGURA API KEY                            │
│    → Comando: "Set API Key"                             │
│    → ApiKeyManager.setApiKey()                          │
│    → Salva em context.secrets (criptografado)           │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 2. EXTENSÃO GERA DEVICE KEY (primeira vez)              │
│    → DeviceManager.getOrCreateDeviceKey()               │
│    → UUID v4 auto-gerado                                │
│    → Salva em context.secrets                           │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 3. REGISTRA DISPOSITIVO NO SERVIDOR                     │
│    → POST /sync/register                                │
│    → Envia: { deviceKey, deviceName, deviceInfo }       │
│    → Response: { success, device }                      │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 4. RASTREAMENTO NORMAL (timeTrace.ts)                   │
│    → Gera time_entries no SQLite local                  │
│    → synced = 0 (não sincronizadas)                     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 5. AUTO-SYNC (horários configurados)                    │
│    → SyncManager.performSync()                          │
│    ├── Push: Envia entries com synced=0                │
│    │   → POST /sync/push { entries: [...] }            │
│    │   → Marca como synced=1 no SQLite                 │
│    └── Pull: REMOVIDO em v0.5.0 ❌                     │
│        → GET /sync/pull LEGADO / não mais usado        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 6. TRATAMENTO DE ERROS                                  │
│    → SyncRetryManager.retry()                           │
│    → Máx 5 tentativas, 10s delay                       │
│    → Se falhar tudo → Notifica usuário                 │
│    → Extension continua funcionando (modo local)        │
└──────────────────────────────────────────────────────────┘
```

---

## 🗂️ Estrutura do Banco de Dados (SQLite Local)

### Alterações Necessárias

```sql
-- TABELA EXISTENTE: time_entries (ADICIONAR COLUNAS)
ALTER TABLE time_entries ADD COLUMN client_id TEXT UNIQUE;  -- UUID local
ALTER TABLE time_entries ADD COLUMN synced INTEGER DEFAULT 0; -- ✅ JÁ EXISTE
ALTER TABLE time_entries ADD COLUMN device_key TEXT;        -- Identifica origem

-- NOVA TABELA: sync_metadata
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,           -- Ex: 'last_pull_timestamp'
  value TEXT NOT NULL,                -- Ex: '2025-11-22T10:00:00Z'
  updated_at TEXT NOT NULL            -- Timestamp de atualização
);

-- NOVA TABELA: sync_conflicts (opcional - v2)
CREATE TABLE sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  local_entry TEXT NOT NULL,          -- JSON da entry local
  remote_entry TEXT NOT NULL,         -- JSON da entry remota
  resolved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### Índices para Performance

```sql
CREATE INDEX IF NOT EXISTS idx_synced ON time_entries(synced);
CREATE INDEX IF NOT EXISTS idx_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_device_key ON time_entries(device_key);
```

---

## 📝 Implementação Detalhada

### FASE 1: Fundação (Semana 1)

#### 1.1 - ApiKeyManager (src/modules/apiKeyManager.ts)

```typescript
import * as vscode from 'vscode';

export class ApiKeyManager {
  private static readonly SECRET_KEY = 'mytimetrace.apiKey';
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  // Salva API Key no SecretStorage (criptografado)
  async setApiKey(apiKey: string): Promise<void> {
    if (!this.validateApiKeyFormat(apiKey)) {
      throw new Error('Formato inválido. Use: mtt_xxxxx (32 chars)');
    }
    await this.context.secrets.store(ApiKeyManager.SECRET_KEY, apiKey);
  }
  
  // Recupera API Key
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ApiKeyManager.SECRET_KEY);
  }
  
  // Remove API Key
  async revokeApiKey(): Promise<void> {
    await this.context.secrets.delete(ApiKeyManager.SECRET_KEY);
  }
  
  // Valida formato: mtt_xxxxx (32 chars alfanuméricos)
  private validateApiKeyFormat(apiKey: string): boolean {
    return /^mtt_[a-z0-9]{32}$/i.test(apiKey);
  }
  
  // Testa conexão com servidor
  async testConnection(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return false;
    
    try {
      const response = await fetch('http://localhost:8989/api/sync/status', {
        headers: { 'X-API-Key': apiKey }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
```

**Checklist:**
- [ ] Criar arquivo `apiKeyManager.ts`
- [ ] Implementar métodos set/get/revoke
- [ ] Adicionar validação de formato
- [ ] Implementar teste de conexão
- [ ] Escrever testes unitários (>80%)

---

#### 1.2 - DeviceManager (src/modules/deviceManager.ts)

```typescript
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { getDeviceInfo } from './deviceInfo';

export class DeviceManager {
  private static readonly SECRET_KEY = 'mytimetrace.deviceKey';
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  // Gera ou recupera device_key existente
  async getOrCreateDeviceKey(): Promise<string> {
    let deviceKey = await this.context.secrets.get(DeviceManager.SECRET_KEY);
    
    if (!deviceKey) {
      deviceKey = uuidv4(); // Gera UUID v4
      await this.context.secrets.store(DeviceManager.SECRET_KEY, deviceKey);
      console.log('🆕 Device Key gerado:', deviceKey);
    }
    
    return deviceKey;
  }
  
  // Obtem informações do dispositivo
  getDeviceInfo() {
    return getDeviceInfo(); // Usa módulo existente deviceInfo.ts
  }
  
  // Registra dispositivo no servidor
  async registerDevice(apiKey: string): Promise<boolean> {
    const deviceKey = await this.getOrCreateDeviceKey();
    const deviceInfo = this.getDeviceInfo();
    
    try {
      const response = await fetch('http://localhost:8989/api/sync/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          deviceKey,
          deviceName: deviceInfo.hostname,
          deviceHostname: deviceInfo.hostname,
          devicePlatform: deviceInfo.platform,
          deviceArch: deviceInfo.arch,
          deviceType: deviceInfo.type,
          deviceRelease: deviceInfo.release
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Device registrado:', result);
      return true;
    } catch (error) {
      console.error('❌ Erro ao registrar device:', error);
      return false;
    }
  }
}
```

**Checklist:**
- [ ] Criar arquivo `deviceManager.ts`
- [ ] Implementar geração de UUID v4
- [ ] Usar módulo existente `deviceInfo.ts`
- [ ] Implementar registro no servidor
- [ ] Escrever testes unitários

---

#### 1.3 - Comandos de API Key (src/modules/commands.ts)

```typescript
// ADICIONAR ao arquivo commands.ts existente

import { ApiKeyManager } from './apiKeyManager';
import { DeviceManager } from './deviceManager';

export function registerSyncCommands(
  context: vscode.ExtensionContext,
  apiKeyManager: ApiKeyManager,
  deviceManager: DeviceManager
): void {
  
  // Comando: Set API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Cole sua API Key obtida na plataforma web',
        placeHolder: 'mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        password: true, // Oculta texto
        validateInput: (value) => {
          if (!value) return 'API Key é obrigatória';
          if (!/^mtt_[a-z0-9]{32}$/i.test(value)) {
            return 'Formato inválido. Use: mtt_xxxxx (32 caracteres)';
          }
          return null;
        }
      });
      
      if (!apiKey) return;
      
      try {
        await apiKeyManager.setApiKey(apiKey);
        
        // Testa conexão
        const isValid = await apiKeyManager.testConnection();
        if (!isValid) {
          vscode.window.showWarningMessage(
            '⚠️ API Key salva, mas não foi possível conectar ao servidor. Verifique se o backend está rodando.'
          );
          return;
        }
        
        // Registra dispositivo
        const registered = await deviceManager.registerDevice(apiKey);
        if (registered) {
          vscode.window.showInformationMessage('✅ API Key configurada! Sincronização ativada.');
        } else {
          vscode.window.showWarningMessage('⚠️ API Key configurada, mas falha ao registrar dispositivo.');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Erro: ${error.message}`);
      }
    })
  );
  
  // Comando: View API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.viewApiKey', async () => {
      const apiKey = await apiKeyManager.getApiKey();
      
      if (!apiKey) {
        vscode.window.showInformationMessage('Nenhuma API Key configurada.');
        return;
      }
      
      // Mostra mascarada: mtt_abc...xyz
      const masked = `${apiKey.slice(0, 7)}...${apiKey.slice(-3)}`;
      
      const action = await vscode.window.showInformationMessage(
        `API Key atual: ${masked}`,
        'Copiar Completa',
        'Testar Conexão'
      );
      
      if (action === 'Copiar Completa') {
        await vscode.env.clipboard.writeText(apiKey);
        vscode.window.showInformationMessage('✅ API Key copiada!');
      } else if (action === 'Testar Conexão') {
        const isValid = await apiKeyManager.testConnection();
        if (isValid) {
          vscode.window.showInformationMessage('✅ Conexão OK!');
        } else {
          vscode.window.showWarningMessage('❌ Falha na conexão com servidor.');
        }
      }
    })
  );
  
  // Comando: Revoke API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.revokeApiKey', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Deseja realmente remover a API Key? Sincronização será desativada.',
        { modal: true },
        'Sim, Remover'
      );
      
      if (confirm !== 'Sim, Remover') return;
      
      await apiKeyManager.revokeApiKey();
      vscode.window.showInformationMessage('✅ API Key removida. Modo local ativado.');
    })
  );
}
```

**Checklist:**
- [ ] Adicionar comandos ao `commands.ts`
- [ ] Implementar UI de input/confirmação
- [ ] Adicionar ao `package.json` (contributes.commands)
- [ ] Testar fluxo completo de configuração

---

### FASE 2: Sincronização Core (Semana 2)

#### 2.1 - SyncManager (src/modules/syncManager.ts)

```typescript
import * as vscode from 'vscode';
import { ApiKeyManager } from './apiKeyManager';
import { DeviceManager } from './deviceManager';
import { DatabaseManager } from './database';
import { SyncRetryManager } from './syncRetryManager';

interface TimeEntry {
  clientId: string;
  timestamp: string;
  project: string;
  file: string;
  durationSeconds: number;
  isIdle: boolean;
}

export class SyncManager {
  private apiKeyManager: ApiKeyManager;
  private deviceManager: DeviceManager;
  private dbManager: DatabaseManager;
  private retryManager: SyncRetryManager;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncTimes: string[] = ['08:00', '17:00']; // Padrão
  
  constructor(
    context: vscode.ExtensionContext,
    apiKeyManager: ApiKeyManager,
    deviceManager: DeviceManager,
    dbManager: DatabaseManager
  ) {
    this.apiKeyManager = apiKeyManager;
    this.deviceManager = deviceManager;
    this.dbManager = dbManager;
    this.retryManager = new SyncRetryManager();
  }
  
  // Inicializa sincronização automática
  async initialize(): Promise<void> {
    const apiKey = await this.apiKeyManager.getApiKey();
    if (!apiKey) {
      console.log('🔇 Sync desabilitado: Nenhuma API Key configurada');
      return;
    }
    
    // Busca configurações de sync do servidor
    await this.fetchSyncConfig();
    
    // Agenda auto-sync
    this.scheduleAutoSync();
    
    console.log('✅ SyncManager inicializado');
  }
  
  // Busca config de sync do servidor
  private async fetchSyncConfig(): Promise<void> {
    try {
      const apiKey = await this.apiKeyManager.getApiKey();
      if (!apiKey) return;
      
      const response = await fetch('http://localhost:8989/api/sync/config', {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (response.ok) {
        const config = await response.json();
        this.syncTimes = config.syncTimes || ['08:00', '17:00'];
        this.retryManager.updateConfig(config.maxRetries, config.retryDelayMs);
      }
    } catch (error) {
      console.error('⚠️ Falha ao buscar config de sync:', error);
    }
  }
  
  // Agenda auto-sync nos horários configurados
  private scheduleAutoSync(): void {
    // Verifica a cada 1 minuto se chegou hora de sincronizar
    this.syncTimer = setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (this.syncTimes.includes(currentTime)) {
        this.performSync();
      }
    }, 60000); // 60 segundos
  }
  
  // Executa sincronização completa (push + pull)
  async performSync(): Promise<void> {
    const apiKey = await this.apiKeyManager.getApiKey();
    if (!apiKey) return;
    
    console.log('🔄 Iniciando sincronização...');
    
    await this.retryManager.execute(async () => {
      await this.pushEntries(apiKey);
      await this.pullEntries(apiKey);
    });
  }
  
  // Push: Envia entries locais não sincronizadas
  private async pushEntries(apiKey: string): Promise<void> {
    const deviceKey = await this.deviceManager.getOrCreateDeviceKey();
    
    // Busca entries não sincronizadas (synced = 0)
    const unsyncedEntries = await this.dbManager.getUnsyncedEntries();
    
    if (unsyncedEntries.length === 0) {
      console.log('✅ Push: Nenhuma entry para sincronizar');
      return;
    }
    
    // Limita a 500 entries por request (conforme spec do backend)
    const batch = unsyncedEntries.slice(0, 500);
    
    const response = await fetch('http://localhost:8989/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        deviceKey,
        entries: batch.map(entry => ({
          clientId: entry.client_id,
          timestamp: entry.timestamp,
          project: entry.project,
          file: entry.file,
          durationSeconds: entry.duration_seconds,
          isIdle: entry.is_idle === 1
        }))
      })
    });
    
    if (!response.ok) {
      throw new Error(`Push failed: HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    // Marca entries como sincronizadas
    const syncedIds = batch.map(e => e.client_id);
    await this.dbManager.markAsSynced(syncedIds);
    
    console.log(`✅ Push: ${result.savedCount} entries enviadas`);
  }
  
  // Pull: Recebe entries de outros dispositivos
  private async pullEntries(apiKey: string): Promise<void> {
    const deviceKey = await this.deviceManager.getOrCreateDeviceKey();
    
    // Busca última sincronização
    const lastPull = await this.dbManager.getMetadata('last_pull_timestamp');
    const since = lastPull || new Date(0).toISOString();
    
    const response = await fetch(
      `http://localhost:8989/api/sync/pull?deviceKey=${deviceKey}&since=${since}&limit=500`,
      { headers: { 'X-API-Key': apiKey } }
    );
    
    if (!response.ok) {
      throw new Error(`Pull failed: HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.entries.length === 0) {
      console.log('✅ Pull: Nenhuma entry nova');
      return;
    }
    
    // Insere entries no banco local (já marcadas como synced=1)
    for (const entry of result.entries) {
      await this.dbManager.insertSyncedEntry(entry);
    }
    
    // Atualiza timestamp de última sincronização
    await this.dbManager.setMetadata('last_pull_timestamp', result.syncedAt);
    
    console.log(`✅ Pull: ${result.entries.length} entries recebidas`);
  }
  
  // Limpa timer ao desativar
  dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}
```

**Checklist:**
- [ ] Criar arquivo `syncManager.ts`
- [x] Implementar push/pull de entries (legado)
- [x] Remover pull em v0.5.0
- [ ] Implementar auto-sync com timer
- [ ] Integrar com retryManager
- [ ] Escrever testes unitários

---

#### 2.2 - SyncRetryManager (src/modules/syncRetryManager.ts)

```typescript
export class SyncRetryManager {
  private maxRetries: number = 5;
  private retryDelayMs: number = 10000; // 10 segundos
  
  updateConfig(maxRetries: number, retryDelayMs: number): void {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Tentativa ${attempt}/${this.maxRetries} falhou:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs);
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    this.notifyFailure(lastError);
    return null;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private notifyFailure(error: Error | null): void {
    const message = error?.message || 'Erro desconhecido';
    vscode.window.showWarningMessage(
      `⚠️ Sincronização falhou após ${this.maxRetries} tentativas: ${message}`
    );
  }
}
```

**Checklist:**
- [ ] Criar arquivo `syncRetryManager.ts`
- [ ] Implementar lógica de retry exponencial
- [ ] Adicionar notificação apenas em falha total
- [ ] Escrever testes unitários

---

#### 2.3 - Database Extensions (src/modules/database.ts)

```typescript
// ADICIONAR ao DatabaseManager existente

export class DatabaseManager {
  // ... código existente ...
  
  // Busca entries não sincronizadas
  async getUnsyncedEntries(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM time_entries WHERE synced = 0 ORDER BY timestamp ASC LIMIT 500',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
  
  // Marca entries como sincronizadas
  async markAsSynced(clientIds: string[]): Promise<void> {
    const placeholders = clientIds.map(() => '?').join(',');
    const query = `UPDATE time_entries SET synced = 1 WHERE client_id IN (${placeholders})`;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, clientIds, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  // Insere entry já sincronizada (vinda do servidor)
  async insertSyncedEntry(entry: any): Promise<void> {
    const query = `
      INSERT OR IGNORE INTO time_entries 
      (client_id, timestamp, project, file, duration_seconds, is_idle, synced, device_key)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(
        query,
        [
          entry.clientId,
          entry.timestamp,
          entry.project,
          entry.file,
          entry.durationSeconds,
          entry.isIdle ? 1 : 0,
          entry.deviceKey || 'unknown'
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  
  // Gerencia metadados de sincronização
  async getMetadata(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT value FROM sync_metadata WHERE key = ?',
        [key],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.value || null);
        }
      );
    });
  }
  
  async setMetadata(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const query = `
      INSERT INTO sync_metadata (key, value, updated_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, [key, value, now, value, now], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
```

**Checklist:**
- [ ] Adicionar métodos ao `database.ts`
- [ ] Criar tabela `sync_metadata` (migration)
- [ ] Adicionar índices de performance
- [ ] Atualizar testes existentes

---

### FASE 3: UI e Comandos (Semana 3)

#### 3.1 - Comandos de Sincronização

```typescript
// ADICIONAR ao commands.ts

// Comando: Sync Now (manual)
context.subscriptions.push(
  vscode.commands.registerCommand('my-time-trace-vscode.syncNow', async () => {
    const apiKey = await apiKeyManager.getApiKey();
    if (!apiKey) {
      vscode.window.showWarningMessage('Configure uma API Key primeiro.');
      return;
    }
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Sincronizando com Cloud...',
      cancellable: false
    }, async (progress) => {
      await syncManager.performSync();
      return Promise.resolve();
    });
  })
);

// Comando: View Sync Status
context.subscriptions.push(
  vscode.commands.registerCommand('my-time-trace-vscode.viewSyncStatus', async () => {
    const apiKey = await apiKeyManager.getApiKey();
    if (!apiKey) {
      vscode.window.showInformationMessage('Modo Local: Sincronização desabilitada');
      return;
    }
    
    const deviceKey = await deviceManager.getOrCreateDeviceKey();
    
    const response = await fetch(
      `http://localhost:8989/api/sync/status?deviceKey=${deviceKey}`,
      { headers: { 'X-API-Key': apiKey } }
    );
    
    if (!response.ok) {
      vscode.window.showErrorMessage('Erro ao buscar status de sincronização');
      return;
    }
    
    const status = await response.json();
    
    // Mostra painel com status
    const panel = vscode.window.createWebviewPanel(
      'syncStatus',
      'Status de Sincronização',
      vscode.ViewColumn.One,
      {}
    );
    
    panel.webview.html = generateSyncStatusHTML(status);
  })
);
```

**Checklist:**
- [ ] Adicionar comando `syncNow`
- [ ] Adicionar comando `viewSyncStatus`
- [ ] Criar painel de status (webview)
- [ ] Adicionar ao `package.json`

---

#### 3.2 - StatusBar Integration

```typescript
// MODIFICAR statusBar.ts para mostrar status de sync

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isSyncing: boolean = false;
  
  // ... código existente ...
  
  updateSyncStatus(syncing: boolean): void {
    this.isSyncing = syncing;
    this.update();
  }
  
  private update(): void {
    let text = `⏱️ ${this.formatTime(this.totalSeconds)}`;
    
    if (this.isSyncing) {
      text += ' 🔄'; // Indicador de sincronização ativa
    }
    
    this.statusBarItem.text = text;
  }
}
```

**Checklist:**
- [ ] Modificar `statusBar.ts`
- [ ] Adicionar indicador visual de sync
- [ ] Atualizar em tempo real

---

### FASE 4: Integração Final (Semana 4)

#### 4.1 - Extension.ts (Orquestração)

```typescript
// MODIFICAR extension.ts

import { ApiKeyManager } from './modules/apiKeyManager';
import { DeviceManager } from './modules/deviceManager';
import { SyncManager } from './modules/syncManager';

export async function activate(context: vscode.ExtensionContext) {
  console.log('🚀 MyTimeTrace está ativo!');
  
  // Módulos existentes
  const dbManager = new DatabaseManager(context);
  const statusBarManager = new StatusBarManager();
  const timeTraceManager = new TimeTrace(context, dbManager, statusBarManager);
  
  // NOVOS módulos de sincronização
  const apiKeyManager = new ApiKeyManager(context);
  const deviceManager = new DeviceManager(context);
  const syncManager = new SyncManager(
    context,
    apiKeyManager,
    deviceManager,
    dbManager
  );
  
  // Inicializa sync (se API Key configurada)
  await syncManager.initialize();
  
  // Registra comandos existentes
  registerCommands(context, timeTraceManager, dbManager, statusBarManager);
  
  // NOVOS comandos de sync
  registerSyncCommands(context, apiKeyManager, deviceManager);
  
  // Cleanup
  context.subscriptions.push({
    dispose: () => {
      syncManager.dispose();
      timeTraceManager.dispose();
      dbManager.dispose();
    }
  });
}
```

**Checklist:**
- [ ] Modificar `extension.ts`
- [ ] Integrar SyncManager ao lifecycle
- [ ] Testar ativação/desativação
- [ ] Verificar limpeza de recursos

---

#### 4.2 - Package.json (Comandos e Configurações)

```json
{
  "contributes": {
    "commands": [
      {
        "command": "my-time-trace-vscode.setApiKey",
        "title": "MyTimeTrace: Set API Key",
        "category": "MyTimeTrace"
      },
      {
        "command": "my-time-trace-vscode.viewApiKey",
        "title": "MyTimeTrace: View API Key",
        "category": "MyTimeTrace"
      },
      {
        "command": "my-time-trace-vscode.revokeApiKey",
        "title": "MyTimeTrace: Revoke API Key",
        "category": "MyTimeTrace"
      },
      {
        "command": "my-time-trace-vscode.syncNow",
        "title": "MyTimeTrace: Sync Now",
        "category": "MyTimeTrace"
      },
      {
        "command": "my-time-trace-vscode.viewSyncStatus",
        "title": "MyTimeTrace: View Sync Status",
        "category": "MyTimeTrace"
      }
    ],
    "configuration": {
      "type": "object",
      "title": "MyTimeTrace Configuration",
      "properties": {
        "myTimeTraceVSCode.syncEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable automatic cloud synchronization"
        },
        "myTimeTraceVSCode.syncInterval": {
          "type": "number",
          "default": 60,
          "description": "Auto-sync check interval (minutes)"
        }
      }
    }
  },
  "dependencies": {
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0"
  }
}
```

**Checklist:**
- [ ] Atualizar `package.json`
- [ ] Adicionar comandos ao contributes
- [ ] Adicionar configurações
- [ ] Instalar dependências: `pnpm add uuid @types/uuid`

---

## 🧪 Plano de Testes

### Testes Unitários (>80% cobertura)

```typescript
// src/test/apiKeyManager.test.ts
describe('ApiKeyManager', () => {
  test('should validate API Key format', async () => {
    // ...
  });
  
  test('should store and retrieve API Key', async () => {
    // ...
  });
});

// src/test/syncManager.test.ts
describe('SyncManager', () => {
  test('should push unsynced entries', async () => {
    // ...
  });
  
  // REMOVIDO: teste de pull legado
  // test('should pull entries from server', async () => {
    // ...
  });
  
  test('should handle network failures with retry', async () => {
    // ...
  });
});
```

**Checklist:**
- [ ] Criar testes para ApiKeyManager
- [ ] Criar testes para DeviceManager
- [ ] Criar testes para SyncManager
- [ ] Criar testes para SyncRetryManager
- [ ] Atingir >80% cobertura

---

### Testes de Integração

1. **Cenário 1: Novo Usuário**
   - [ ] Instalar extensão
   - [ ] Configurar API Key
   - [ ] Registrar dispositivo
   - [ ] Trabalhar localmente (gerar entries)
   - [ ] Executar sync manual
   - [ ] Verificar entries no servidor

2. **Cenário 2: Multi-Dispositivo**
   - [ ] PC A: Configurar API Key
   - [ ] PC A: Gerar 50 entries
   - [ ] PC A: Sync manual (push)
   - [ ] PC B: Configurar mesma API Key
   - [x] PC B: Sync manual (pull) - REMOVIDO em v0.5.0
   - [ ] PC B: Verificar 50 entries recebidas

3. **Cenário 3: Falha de Rede**
   - [ ] Desabilitar backend
   - [ ] Tentar sync
   - [ ] Verificar retry (5 tentativas)
   - [ ] Verificar notificação de erro
   - [ ] Verificar extensão continua funcionando

4. **Cenário 4: API Key Inválida**
   - [ ] Configurar API Key fake
   - [ ] Tentar sync
   - [ ] Verificar erro HTTP 401
   - [ ] Verificar notificação ao usuário

---

## 📦 Dependências

### Novas Dependências

```bash
pnpm add uuid
pnpm add -D @types/uuid
```

### Dependências Existentes (manter)

```json
{
  "vscode": "^1.100.0",
  "sqlite3": "^5.1.6",
  "typescript": "^5.8.3"
}
```

---

## 📚 Documentação

### Documentos a Atualizar

1. **README.md**
   - [ ] Adicionar seção "Sincronização Cloud"
   - [ ] Documentar comandos de sync
   - [ ] Adicionar FAQ sobre multi-dispositivo

2. **CHANGELOG.md**
   - [ ] Criar entrada v0.4.0 - Sincronização Cloud
   - [ ] Listar breaking changes (se houver)

3. **Criar SYNC_GUIDE.md**
   - [ ] Guia passo-a-passo de configuração
   - [ ] Troubleshooting de problemas comuns
   - [ ] Perguntas frequentes

---

## ⏱️ Timeline Estimado

### Semana 1: Fundação
- **Dias 1-2:** ApiKeyManager + DeviceManager
- **Dias 3-4:** Comandos de API Key (set/view/revoke)
- **Dia 5:** Testes unitários (ApiKey, Device)

### Semana 2: Sincronização Core
- **Dias 1-3:** SyncManager (push/pull)
- **Dia 4:** SyncRetryManager
- **Dia 5:** Database extensions + testes

### Semana 3: UI e Comandos
- **Dias 1-2:** Comandos de sync (syncNow, viewStatus)
- **Dias 3-4:** StatusBar integration
- **Dia 5:** Testes de integração

### Semana 4: Integração e Deploy
- **Dias 1-2:** Extension.ts orchestration
- **Dia 3:** Package.json + documentação
- **Dia 4:** Testes E2E completos
- **Dia 5:** Deploy beta + feedback

---

## 🎯 Critérios de Sucesso

### Funcionalidade
- [ ] API Key gerenciada via SecretStorage
- [ ] Device_key gerado automaticamente
- [ ] Push de entries locais → servidor
- [ ] Pull de entries de outros PCs → local
- [ ] Auto-sync em horários configurados
- [ ] Retry automático em falhas

### Experiência do Usuário
- [ ] Modo local 100% funcional (sem API Key)
- [ ] Notificações apenas em erros críticos
- [ ] Comandos intuitivos e bem documentados
- [ ] Status visual de sincronização

### Qualidade
- [ ] >80% cobertura de testes
- [ ] Zero regressões em funcionalidades existentes
- [ ] Performance: sync não bloqueia UI
- [ ] Segurança: API Key criptografada

### Integração Backend
- [ ] Compatível com 100% dos endpoints
- [ ] Trata corretamente HTTP 401/403
- [ ] Respeita rate limiting do servidor
- [ ] Loga erros de forma útil

---

## 🚨 Riscos e Mitigações

### Risco 1: Mudanças no Backend
**Mitigação:** Comunicação prévia de qualquer mudança na API

### Risco 2: Conflitos de Sincronização
**Mitigação:** Implementar lógica de merge por timestamp (v2)

### Risco 3: Performance com Muitas Entries
**Mitigação:** Batch de 500 entries por request (conforme spec)

### Risco 4: Falha de Rede Prolongada
**Mitigação:** Modo local continua funcionando + retry automático

---

## 📞 Comunicação

### Mudanças no Backend
**Qualquer alteração nos endpoints será comunicada previamente:**
- Novos endpoints
- Mudanças em schemas
- Novos códigos de erro
- Rate limiting updates

### Feedback de Implementação
- Daily updates no canal do projeto
- Code reviews semanais
- Testes integrados com backend staging

---

## ✅ Checklist Geral

### Fase 1: Fundação
- [ ] ApiKeyManager implementado
- [ ] DeviceManager implementado
- [ ] Comandos de API Key adicionados
- [ ] Testes unitários >80%

### Fase 2: Sincronização
- [ ] SyncManager implementado
- [ ] SyncRetryManager implementado
- [ ] Database extensions criadas
- [ ] Testes de sync >80%

### Fase 3: UI
- [ ] Comandos de sync adicionados
- [ ] StatusBar integrada
- [ ] Webview de status criada
- [ ] Testes de UI

### Fase 4: Integração
- [ ] Extension.ts atualizado
- [ ] Package.json configurado
- [ ] Documentação completa
- [ ] Testes E2E passando

### Deploy
- [ ] Beta release testado
- [ ] Feedback coletado
- [ ] Ajustes finais
- [ ] Release v0.4.0 publicado

---

**📊 Status:** 📝 Planejamento Completo  
**🎯 Próximo Passo:** Iniciar FASE 1 - ApiKeyManager

**🚀 Let's build this!**
