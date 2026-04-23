# 🔄 Especificação de Integração - Sincronização VS Code Extension

**Data:** 22 de novembro de 2025  
**Extensão:** MyTimeTrace VS Code (Projeto Separado - Já em Produção)  
**Backend:** MyTimeTraceCloud API (NestJS + PostgreSQL)

---

## ⚠️ IMPORTANTE - ESCOPO DESTE DOCUMENTO

**🎯 Este repositório (MyTimeTraceCloud) implementa APENAS o backend Cloud.**

**A extensão VS Code:**
- ✅ **JÁ EXISTE** em produção (repositório separado)
- ✅ **NÃO SERÁ** implementada neste projeto
- 📋 Este documento serve como **especificação de integração**
- 📋 Informações aqui devem ser **levadas para o projeto MyTimeTrace VS Code**

**Objetivo deste documento:**
- Documentar endpoints do backend que a extensão deve consumir
- Especificar formato de dados (DTOs, requests, responses)
- Definir fluxos de autenticação e sincronização
- Fornecer exemplos de integração para o time da extensão

---

## 📋 Resumo Executivo

Este documento detalha **exatamente** o que precisa ser implementado na extensão VS Code para sincronização funcionar com o backend no modo push-only.

### ✅ Backend MyTimeTraceCloud (Este Repositório)
- ✅ Schema Prisma configurado (PostgreSQL 17)
- ✅ Endpoints criados: `/sync/register`, `/sync/push`, `/sync/pull`, `/sync/status`
- ✅ Sincronização push-first adotada como fluxo oficial
- ✅ Dados pertencem ao usuário (não ao dispositivo)
- ✅ Constraint UNIQUE previne duplicatas
- ✅ Validação de API Key via ApiKeyGuard (middleware obrigatório)
- ✅ Documentação Swagger em `/api/docs`

### 📋 VS Code Extension (Repositório Separado - Já em Produção)
- ⚠️ **ESTE PROJETO NÃO IMPLEMENTA A EXTENSÃO**
- 📋 Extensão já existe em produção (repositório próprio)
- 📋 Este documento serve como **especificação de integração**
- 📋 Código de exemplo serve como **referência** para o time da extensão
- 📋 Implementação real deve ser feita no **repositório MyTimeTrace VS Code**

### ⚠️ **REGRA CRÍTICA DE SINCRONIZAÇÃO**
```
🔐 SYNC É OPCIONAL - SEM API KEY = MODO LOCAL

Comportamentos por cenário:

1️⃣ API Key NUNCA foi configurada:
   ✅ Extension funciona 100% normal (modo local)
   ✅ time_entries são rastreadas no SQLite
   ❌ Sync NÃO tenta executar
   🔇 NENHUMA mensagem ao usuário (silencioso)

2️⃣ API Key configurada E válida:
  ✅ Sync funciona normalmente (push only)
   ✅ Auto-sync em horários específicos (ex: [08:00, 17:00] = 2x/dia)
   🔇 Sucesso = SILENCIOSO (sem notificação)
   
3️⃣ API Key configurada MAS inválida:
   ⚠️ Tenta sync com retry (5 tentativas)
   ⚠️ Se todas falharem → Notifica usuário
   🔔 "API Key inválida. Reconfigure se desejar sync."
   ✅ Extension continua funcionando (modo local)

IMPORTANTE: API Key é OPCIONAL, não obrigatória!
```

---

## 🎯 Objetivos da Implementação

### Objetivo Principal
Permitir que a extensão VS Code sincronize `time_entries` de forma unidirecional:
1. **Push:** Enviar entries locais (SQLite) → Servidor (PostgreSQL)
2. **Registro:** Registrar device no servidor
3. **Status:** Verificar status de sincronização

### Fluxo Completo
```
┌─────────────────────────────────────────────────────────┐
│ 1. USUÁRIO: Cria conta na plataforma web               │
│    → Recebe API_KEY: "mtt_abc123xyz"                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 2. VS CODE PC A: Configura API_KEY                     │
│    → Comando: "MyTimeTrace: Set API Key"               │
│    → Salva em SecretStorage (criptografado)            │
│    → Gera device_key: "uuid-pc-a"                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 3. VS CODE PC A: Registra device no servidor           │
│    → POST /sync/register                                │
│    → Headers: X-API-Key                                 │
│    → Body: { deviceKey, deviceName, hostname, ... }    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 4. VS CODE PC A: Trabalha normalmente                  │
│    → Gera 100 time_entries no SQLite local             │
│    → synced = 0 (não sincronizadas)                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 5. VS CODE PC A: Auto-sync (horários configurados)     │
│    → POST /sync/push (100 entries)                     │
│    → Response: { savedCount: 100, conflicts: [] }      │
│    → Marca entries como synced = 1                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 6. VS CODE: reenvia apenas o que ficou pendente       │
│    → Não há mais etapa de pull                         │
│    → Recebe 100 entries de PC A                        │
│    → Insere no SQLite local com synced = 1             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 7. RESULTADO: Ambos PCs têm os mesmos dados!           │
│    → PC A: 100 entries (enviadas)                      │
│    → PC B: 100 entries (recebidas de PC A)             │
│    → Servidor: 100 entries (userId, deviceId=PC A)     │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Estrutura de Arquivos (Referência para Extensão VS Code)

**⚠️ ATENÇÃO:** Esta estrutura é para o **repositório MyTimeTrace VS Code** (NÃO este repo).

```
# Estrutura sugerida para o repositório da extensão:
src/
├── modules/
│   ├── syncManager.ts          # 🆕 CRIAR - Gerencia sync
│   ├── apiKeyManager.ts        # 🆕 CRIAR - Gerencia API_KEY
│   └── deviceInfo.ts           # ✅ JÁ EXISTE - Sem mudanças
├── commands/
│   ├── syncCommands.ts         # 🆕 CRIAR - Comandos de sync
│   └── commands.ts             # ✏️ MODIFICAR - Registrar novos comandos
├── database/
│   └── database.ts             # ✏️ MODIFICAR - Adicionar coluna client_id
└── extension.ts                # ✏️ MODIFICAR - Inicializar SyncManager
```

**📌 Nota:** Toda implementação de código neste documento é **referência** para o time da extensão.

---

## 🔨 Referência de Implementação (Para Repositório da Extensão)

**⚠️ OS PASSOS ABAIXO SÃO PARA O REPOSITÓRIO MyTimeTrace VS Code (NÃO ESTE REPO)**

Este guia serve como **especificação** para o time que mantém a extensão.

---

### **PASSO 1: Modificar Schema SQLite (Adicionar `client_id`)**

**⚠️ Implementar no repositório da extensão VS Code**

**Arquivo:** `src/database/database.ts`

#### 1.1. Adicionar coluna `client_id` à tabela `time_entries`

```typescript
// src/database/database.ts

// MIGRATION EXISTENTE (não mexer)
await db.exec(`
  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    project TEXT,
    file TEXT,
    duration_seconds INTEGER NOT NULL,
    is_idle INTEGER DEFAULT 0,
    synced INTEGER DEFAULT 0,
    deleted_at TEXT DEFAULT NULL,
    device_name TEXT DEFAULT NULL
  )
`);

// 🆕 ADICIONAR NOVA MIGRATION (versão 2)
await db.exec(`
  -- Migration v2: Adicionar client_id para sincronização
  ALTER TABLE time_entries 
  ADD COLUMN client_id TEXT DEFAULT NULL;
`);

// 🆕 Criar índice para client_id (performance)
await db.exec(`
  CREATE INDEX IF NOT EXISTS idx_time_entries_client_id 
  ON time_entries(client_id);
`);

// 🆕 Criar índice para synced (buscar não sincronizadas)
await db.exec(`
  CREATE INDEX IF NOT EXISTS idx_time_entries_synced 
  ON time_entries(synced);
`);
```

#### 1.2. Atualizar método `insert()` para gerar `client_id`

```typescript
// src/database/database.ts

import { v4 as uuidv4 } from 'uuid'; // npm install uuid @types/uuid

async insert(entry: TimeEntry): Promise<void> {
  const db = await this.getDatabase();
  
  // 🆕 Gerar client_id se não existir
  const clientId = uuidv4();
  
  await db.run(
    `INSERT INTO time_entries (
      client_id, timestamp, project, file, 
      duration_seconds, is_idle, synced, device_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clientId,                      // 🆕 NOVO campo
      entry.timestamp,
      entry.project,
      entry.file,
      entry.durationSeconds,
      entry.isIdle ? 1 : 0,
      0,                             // synced = 0 (não sincronizado)
      os.hostname(),
    ]
  );
}
```

---

### **PASSO 2: Criar API Key Manager**

**Arquivo:** `src/modules/apiKeyManager.ts` (NOVO)

```typescript
// src/modules/apiKeyManager.ts
import * as vscode from 'vscode';

/**
 * ApiKeyManager - Gerencia API_KEY usando SecretStorage
 * 
 * SecretStorage é criptografado pelo SO:
 * - Windows: Credential Manager
 * - macOS: Keychain
 * - Linux: libsecret
 * 
 * NÃO sincroniza entre PCs (segurança)
 */
export class ApiKeyManager {
  private static readonly API_KEY_SECRET = 'mytimetrace.apiKey';
  private static readonly DEVICE_KEY_SECRET = 'mytimetrace.deviceKey';

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Salvar API_KEY (fornecida pelo usuário da plataforma web)
   */
  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.startsWith('mtt_')) {
      throw new Error('Invalid API Key format. Must start with "mtt_"');
    }

    await this.context.secrets.store(ApiKeyManager.API_KEY_SECRET, apiKey);
    vscode.window.showInformationMessage('✅ API Key saved successfully!');
  }

  /**
   * Recuperar API_KEY salva
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ApiKeyManager.API_KEY_SECRET);
  }

  /**
   * Verificar se API_KEY está configurada
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  /**
   * Remover API_KEY (logout)
   */
  async clearApiKey(): Promise<void> {
    await this.context.secrets.delete(ApiKeyManager.API_KEY_SECRET);
    await this.context.secrets.delete(ApiKeyManager.DEVICE_KEY_SECRET);
    vscode.window.showInformationMessage('🔓 API Key cleared');
  }

  /**
   * Gerar/recuperar device_key (UUID v4 único por instalação)
   */
  async getDeviceKey(): Promise<string> {
    let deviceKey = await this.context.secrets.get(ApiKeyManager.DEVICE_KEY_SECRET);

    if (!deviceKey) {
      // Gerar novo device_key (UUID v4)
      deviceKey = this.generateUUID();
      await this.context.secrets.store(ApiKeyManager.DEVICE_KEY_SECRET, deviceKey);
    }

    return deviceKey;
  }

  /**
   * Gerar UUID v4 (compatível com backend)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Prompt para usuário inserir API_KEY
   */
  async promptForApiKey(): Promise<void> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your MyTimeTrace API Key',
      placeHolder: 'mtt_abc123xyz...',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'API Key is required';
        }
        if (!value.startsWith('mtt_')) {
          return 'Invalid format. API Key must start with "mtt_"';
        }
        return null;
      },
    });

    if (apiKey) {
      await this.setApiKey(apiKey);
    }
  }
}
```

---

### **PASSO 3: Criar Sync Manager**

**Arquivo:** `src/modules/syncManager.ts` (NOVO)

```typescript
// src/modules/syncManager.ts
import * as vscode from 'vscode';
import * as os from 'os';
import { ApiKeyManager } from './apiKeyManager';
import { getDeviceInfo } from './deviceInfo';
import { Database } from '../database/database';

interface TimeEntryDto {
  clientId: string;
  timestamp: string;
  project: string;
  file: string;
  durationSeconds: number;
  isIdle: boolean;
}

interface PushResponse {
  savedCount: number;
  conflictsCount: number;
  conflicts: Array<{ clientId: string; reason: string }>;
  syncedAt: string;
}

interface PullResponse {
  entries: TimeEntryDto[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  syncedAt: string;
}

/**
 * SyncManager - Gerencia sincronização push-only
 * 
 * Responsabilidades:
 * - Registrar device no servidor
 * - Push: Enviar entries locais → servidor
 * - Pull: legado / não usado no fluxo atual
 * - Auto-sync em background (5 em 5 min)
 * 
 * ⚠️ COMPORTAMENTO DE NOTIFICAÇÕES:
 * - API Key nunca configurada → SILENCIOSO (sem mensagens)
 * - Sync com sucesso → SILENCIOSO (sem mensagens)
 * - Sync com falha (após 5 retries) → Notifica usuário
 */
export class SyncManager {
  private apiUrl: string;
  private syncInterval?: NodeJS.Timeout;
  private isSyncing = false;
  private readonly MAX_RETRIES = 5; // Número de tentativas em caso de erro
  private readonly RETRY_DELAY = 10000; // 10 segundos entre tentativas
  
  // Horários de auto-sync (dinâmico via backend)
  // Padrão: 3x por dia (08:00, 12:00, 17:00)
  // Exemplos: [08:00] = 1x/dia | [08:00, 17:00] = 2x/dia | [08:00, 12:00, 17:00, 22:00] = 4x/dia
  private SYNC_TIMES: Array<{ hour: number; minute: number }> = [
    { hour: 8, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 17, minute: 0 },
  ];

  constructor(
    private apiKeyManager: ApiKeyManager,
    private database: Database,
    private outputChannel: vscode.OutputChannel
  ) {
    // Backend URL (ajustar conforme ambiente)
    this.apiUrl = process.env.MYTIMETRACE_API_URL || 'http://localhost:8989/api';
  }

  /**
   * Inicializar SyncManager e registrar device
   * 
   * ⚠️ COMPORTAMENTO:
   * 1. Se API Key NUNCA foi configurada → SILENCIOSO (não notifica)
   * 2. Se API Key existe → Tenta registrar (com retry)
   * 3. Se registro falhar após retries → Notifica usuário
   */
  async initialize(): Promise<void> {
    const hasApiKey = await this.apiKeyManager.hasApiKey();

    if (!hasApiKey) {
      // ✅ API Key nunca configurada → Modo local SILENCIOSO
      this.log('ℹ️ API Key not configured. Running in local mode (sync disabled).');
      return; // SEM notificação ao usuário
    }

    // ✅ API Key existe → Tentar registrar device (com retry)
    const registered = await this.registerDeviceWithRetry();

    if (registered) {
      this.log('✅ Sync initialized successfully');
      // Iniciar auto-sync
      this.startAutoSync();
    } else {
      // ❌ Falhou após 5 tentativas → Notificar usuário
      this.log('❌ Sync initialization failed after retries');
      
      vscode.window.showErrorMessage(
        'MyTimeTrace: Falha ao conectar com servidor. Verifique API Key ou conexão.',
        'Reconfigurar API Key'
      ).then((action) => {
        if (action === 'Reconfigurar API Key') {
          vscode.commands.executeCommand('my-time-trace-vscode.setApiKey');
        }
      });
    }
  }

  /**
   * Registrar device com retry (5 tentativas)
   * @returns true se sucesso, false se falhar após todas tentativas
   */
  private async registerDeviceWithRetry(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.log(`🔄 Registering device (attempt ${attempt}/${this.MAX_RETRIES})...`);
        await this.registerDevice();
        return true; // ✅ Sucesso
      } catch (error) {
        this.log(`⚠️ Registration attempt ${attempt} failed: ${error}`);
        
        if (attempt < this.MAX_RETRIES) {
          // Aguardar antes de próxima tentativa
          await this.sleep(this.RETRY_DELAY);
        }
      }
    }
    
    return false; // ❌ Falhou após todas tentativas
  }

  /**
   * Sleep helper para retry
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Registrar device no servidor
   * POST /sync/register
   */
  private async registerDevice(): Promise<void> {
    try {
      const apiKey = await this.apiKeyManager.getApiKey();
      const deviceKey = await this.apiKeyManager.getDeviceKey();
      const deviceInfo = getDeviceInfo();

      const response = await fetch(`${this.apiUrl}/sync/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey!,
        },
        body: JSON.stringify({
          deviceKey,
          deviceName: deviceInfo.hostname,
          deviceHostname: deviceInfo.hostname,
          devicePlatform: deviceInfo.platform,
          deviceArch: deviceInfo.arch,
          deviceType: deviceInfo.type,
          deviceRelease: deviceInfo.release,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Registration failed: ${error}`);
      }

      const data = await response.json();
      this.log(`✅ Device registered: ${data.message}`);
    } catch (error) {
      this.log(`❌ Device registration failed: ${error}`);
      throw error;
    }
  }

  /**
   * Push: Enviar entries locais → servidor
   * POST /sync/push
   * 
   * ⚠️ COMPORTAMENTO:
   * - Tenta 5 vezes em caso de erro
   * - Sucesso → SILENCIOSO (sem notificação)
   * - Falha após retries → Notifica usuário
   */
  async push(): Promise<PushResponse | null> {
    if (this.isSyncing) {
      this.log('⏳ Sync already in progress...');
      return null;
    }

    this.isSyncing = true;

    try {
      const apiKey = await this.apiKeyManager.getApiKey();
      const deviceKey = await this.apiKeyManager.getDeviceKey();

      if (!apiKey) {
        this.log('ℹ️ Push skipped: API Key not configured (local mode)');
        return null; // SEM notificação
      }

      // Buscar entries não sincronizadas (max 500)
      const db = await this.database.getDatabase();
      const entriesToSync = await db.all<any[]>(
        `SELECT * FROM time_entries 
         WHERE synced = 0 AND deleted_at IS NULL 
         LIMIT 500`
      );

      if (entriesToSync.length === 0) {
        this.log('✅ No entries to sync');
        return null;
      }

      this.log(`📤 Pushing ${entriesToSync.length} entries...`);

      // Converter para formato do backend
      const entries: TimeEntryDto[] = entriesToSync.map((e) => ({
        clientId: e.client_id,
        timestamp: e.timestamp,
        project: e.project || '',
        file: e.file || '',
        durationSeconds: e.duration_seconds,
        isIdle: e.is_idle === 1,
      }));

      // Tentar push com retry
      const result = await this.pushWithRetry(apiKey, deviceKey, entries);

      if (!result) {
        // ❌ Falhou após retries → Notificar usuário
        vscode.window.showErrorMessage(
          'MyTimeTrace: Falha ao enviar dados. Verifique conexão ou API Key.',
          'Reconfigurar API Key'
        ).then((action) => {
          if (action === 'Reconfigurar API Key') {
            vscode.commands.executeCommand('my-time-trace-vscode.setApiKey');
          }
        });
        return null;
      }

      // Marcar entries como sincronizadas (exceto conflitos)
      const conflictClientIds = result.conflicts.map((c) => c.clientId);
      const successClientIds = entries
        .map((e) => e.clientId)
        .filter((id) => !conflictClientIds.includes(id));

      if (successClientIds.length > 0) {
        const placeholders = successClientIds.map(() => '?').join(',');
        await db.run(
          `UPDATE time_entries SET synced = 1 WHERE client_id IN (${placeholders})`,
          successClientIds
        );
      }

      this.log(`✅ Push complete: ${result.savedCount} saved, ${result.conflictsCount} conflicts`);
      // ✅ SUCESSO = SILENCIOSO (sem notificação ao usuário)
      return result;
    } catch (error) {
      this.log(`❌ Push failed: ${error}`);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push com retry (5 tentativas)
   */
  private async pushWithRetry(
    apiKey: string,
    deviceKey: string,
    entries: TimeEntryDto[]
  ): Promise<PushResponse | null> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.log(`🔄 Push attempt ${attempt}/${this.MAX_RETRIES}...`);

        const response = await fetch(`${this.apiUrl}/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ deviceKey, entries }),
        });

        if (!response.ok) {
          const error = await response.text();
          
          // HTTP 401 = API Key inválida (não fazer retry)
          if (response.status === 401) {
            this.log('❌ Push failed: Invalid API Key (401)');
            throw new Error('Invalid API Key');
          }
          
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        // ✅ Sucesso
        return await response.json();
      } catch (error) {
        this.log(`⚠️ Push attempt ${attempt} failed: ${error}`);
        
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY);
        }
      }
    }

    return null; // ❌ Falhou após todas tentativas
  }

  /**
   * Pull: legado / não usado no fluxo atual
   * 
   * ⚠️ COMPORTAMENTO:
   * - Tenta 5 vezes em caso de erro
   * - Sucesso → SILENCIOSO (sem notificação)
   * - Falha após retries → Notifica usuário
   */
  async pull(since?: string): Promise<PullResponse | null> {
    try {
      const apiKey = await this.apiKeyManager.getApiKey();
      const deviceKey = await this.apiKeyManager.getDeviceKey();

      if (!apiKey) {
        this.log('ℹ️ Pull skipped: API Key not configured (local mode)');
        return null; // SEM notificação
      }

      // Construir query params
      const params = new URLSearchParams({
        deviceKey,
        limit: '100',
      });

      if (since) {
        params.append('since', since);
      }

      this.log(`📥 Pulling entries from server...`);

      // Tentar pull com retry
      const result = await this.pullWithRetry(apiKey, params);

      if (!result) {
        // ❌ Falhou após retries → Notificar usuário
        vscode.window.showErrorMessage(
          'MyTimeTrace: Falha ao receber dados. Verifique conexão ou API Key.',
          'Reconfigurar API Key'
        ).then((action) => {
          if (action === 'Reconfigurar API Key') {
            vscode.commands.executeCommand('my-time-trace-vscode.setApiKey');
          }
        });
        return null;
      }

      if (result.entries.length === 0) {
        this.log('✅ No new entries from other devices');
        return result;
      }

      this.log(`📥 Received ${result.entries.length} entries from other devices`);

      // Inserir entries no SQLite local
      const db = await this.database.getDatabase();

      for (const entry of result.entries) {
        await db.run(
          `INSERT OR IGNORE INTO time_entries (
            client_id, timestamp, project, file,
            duration_seconds, is_idle, synced, device_name
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            entry.clientId,
            entry.timestamp,
            entry.project,
            entry.file,
            entry.durationSeconds,
            entry.isIdle ? 1 : 0,
            'from-other-device',
          ]
        );
      }

      this.log(`✅ Pull complete: ${result.entries.length} entries imported`);
      // ✅ SUCESSO = SILENCIOSO (sem notificação ao usuário)

      // Se hasMore, fazer pull recursivo
      if (result.hasMore) {
        this.log(`🔄 More entries available, fetching next page...`);
        await this.pull(since);
      }

      return result;
    } catch (error) {
      this.log(`❌ Pull failed: ${error}`);
      return null;
    }
  }

  /**
   * Pull com retry (5 tentativas)
   */
  private async pullWithRetry(
    apiKey: string,
    params: URLSearchParams
  ): Promise<PullResponse | null> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.log(`🔄 Pull attempt ${attempt}/${this.MAX_RETRIES}...`);

        const response = await fetch(`${this.apiUrl}/sync/pull?${params}`, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          
          // HTTP 401 = API Key inválida (não fazer retry)
          if (response.status === 401) {
            this.log('❌ Pull failed: Invalid API Key (401)');
            throw new Error('Invalid API Key');
          }
          
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        // ✅ Sucesso
        return await response.json();
      } catch (error) {
        this.log(`⚠️ Pull attempt ${attempt} failed: ${error}`);
        
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY);
        }
      }
    }

    return null; // ❌ Falhou após todas tentativas
  }

  /**
   * Sync completo: Push + Pull
   * 
   * ⚠️ COMPORTAMENTO:
   * - Se API Key não existe → SILENCIOSO (sem mensagem)
   * - Sucesso → SILENCIOSO (sem mensagem)
   * - Falha após retries → Notifica usuário
   */
  async syncNow(): Promise<void> {
    const hasApiKey = await this.apiKeyManager.hasApiKey();
    
    if (!hasApiKey) {
      // ✅ API Key nunca configurada → SILENCIOSO
      this.log('ℹ️ Sync skipped: API Key not configured (local mode)');
      return; // SEM notificação
    }

    this.log('🔄 Starting full sync...');

    // 1. Push entries locais
    await this.push();

    // 2. Pull entries de outros devices
    await this.pull();

    this.log('✅ Full sync complete');
    // ✅ SUCESSO = SILENCIOSO (sem notificação ao usuário)
  }

  /**
   * Auto-sync em background (horários configuráveis)
   * 
   * ⚠️ COMPORTAMENTO:
   * - Só inicia se API Key for válida (validado no initialize())
   * - Sucesso → SILENCIOSO
   * - Falha → Notifica usuário (após 5 retries)
   * - Horários configuráveis via backend (superadmin)
   * 
   * Exemplos:
   * - [08:00] → 1 sync por dia
   * - [08:00, 17:00] → 2 sync por dia
   * - [08:00, 12:00, 17:00, 22:00] → 4 sync por dia
   */
  private startAutoSync(): void {
    const times = this.SYNC_TIMES.map(t => `${t.hour}:${t.minute}`).join(', ');
    this.log(`🚀 Auto-sync enabled (${this.SYNC_TIMES.length}x daily: ${times})`);
    
    // Sync imediato ao iniciar (já validou API Key no initialize())
    this.syncNow(); // SILENCIOSO em caso de sucesso

    // Verificar horário de sync a cada 1 minuto
    this.syncInterval = setInterval(() => {
      this.checkAndSync();
    }, 60 * 1000); // Verifica a cada 1 minuto
  }

  /**
   * Verificar se está na hora de sincronizar
   */
  private checkAndSync(): void {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Verificar se está em um dos horários de sync (com tolerância de 1 minuto)
    const shouldSync = this.SYNC_TIMES.some(
      (time) => time.hour === currentHour && time.minute === currentMinute
    );

    if (shouldSync) {
      this.log(`⏰ Scheduled sync triggered at ${currentHour}:${currentMinute}`);
      this.syncNow();
    }
  }

  /**
   * Parar auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      this.log('🛑 Auto-sync stopped');
    }
  }

  /**
   * Log interno
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Dispose (cleanup)
   */
  dispose(): void {
    this.stopAutoSync();
  }
}
```

---

### **PASSO 4: Criar Comandos de Sync**

**Arquivo:** `src/commands/syncCommands.ts` (NOVO)

```typescript
// src/commands/syncCommands.ts
import * as vscode from 'vscode';
import { ApiKeyManager } from '../modules/apiKeyManager';
import { SyncManager } from '../modules/syncManager';

/**
 * Registrar todos os comandos de sincronização
 */
export function registerSyncCommands(
  context: vscode.ExtensionContext,
  apiKeyManager: ApiKeyManager,
  syncManager: SyncManager
): void {
  // Comando: Configurar API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.setApiKey', async () => {
      await apiKeyManager.promptForApiKey();
      
      // Reinicializar SyncManager após configurar API Key
      await syncManager.initialize();
    })
  );

  // Comando: Ver API Key atual
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.viewApiKey', async () => {
      const apiKey = await apiKeyManager.getApiKey();
      
      if (apiKey) {
        // Mostrar apenas primeiros/últimos caracteres (segurança)
        const masked = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
        vscode.window.showInformationMessage(`API Key: ${masked}`);
      } else {
        vscode.window.showWarningMessage('No API Key configured');
      }
    })
  );

  // Comando: Remover API Key (logout)
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.clearApiKey', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Remove API Key? This will stop sync.',
        { modal: true },
        'Remove'
      );

      if (confirm === 'Remove') {
        await apiKeyManager.clearApiKey();
        syncManager.stopAutoSync();
      }
    })
  );

  // Comando: Sincronizar agora (manual)
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.syncNow', async () => {
      const hasApiKey = await apiKeyManager.hasApiKey();
      
      if (!hasApiKey) {
        // API Key nunca configurada → Oferecer configuração
        const action = await vscode.window.showWarningMessage(
          'MyTimeTrace: API Key não configurada. Deseja configurar agora?',
          'Configurar API Key',
          'Cancelar'
        );
        
        if (action === 'Configurar API Key') {
          vscode.commands.executeCommand('my-time-trace-vscode.setApiKey');
        }
        return;
      }
      
      // API Key existe → Tentar sync (com retry, SILENCIOSO se sucesso)
      await syncManager.syncNow();
    })
  );

  // Comando: Ver status de sincronização
  context.subscriptions.push(
    vscode.commands.registerCommand('my-time-trace-vscode.viewSyncStatus', async () => {
      const hasApiKey = await apiKeyManager.hasApiKey();
      const deviceKey = await apiKeyManager.getDeviceKey();

      if (!hasApiKey) {
        vscode.window.showWarningMessage('Sync disabled: No API Key configured');
        return;
      }

      vscode.window.showInformationMessage(
        `Sync Status:\n` +
        `✅ API Key configured\n` +
        `📱 Device Key: ${deviceKey.substring(0, 8)}...`
      );
    })
  );
}
```

---

### **PASSO 5: Modificar extension.ts**

**Arquivo:** `src/extension.ts` (MODIFICAR)

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { Database } from './database/database';
import { ApiKeyManager } from './modules/apiKeyManager';
import { SyncManager } from './modules/syncManager';
import { registerSyncCommands } from './commands/syncCommands';

export async function activate(context: vscode.ExtensionContext) {
  console.log('MyTimeTrace extension activated');

  // Output channel para logs
  const outputChannel = vscode.window.createOutputChannel('MyTimeTrace');
  context.subscriptions.push(outputChannel);

  // Database
  const database = new Database(context);

  // 🆕 API Key Manager
  const apiKeyManager = new ApiKeyManager(context);

  // 🆕 Sync Manager
  const syncManager = new SyncManager(apiKeyManager, database, outputChannel);

  // 🆕 Registrar comandos de sync
  registerSyncCommands(context, apiKeyManager, syncManager);

  // 🆕 Inicializar SyncManager (registrar device + auto-sync)
  try {
    await syncManager.initialize();
  } catch (error) {
    outputChannel.appendLine(`⚠️ Sync initialization failed: ${error}`);
  }

  // ... resto dos comandos existentes ...

  // Cleanup ao desativar
  context.subscriptions.push({
    dispose: () => {
      syncManager.dispose();
    },
  });
}

export function deactivate() {
  console.log('MyTimeTrace extension deactivated');
}
```

---

### **PASSO 6: Atualizar package.json (Comandos)**

**Arquivo:** `package.json` (MODIFICAR)

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
        "command": "my-time-trace-vscode.clearApiKey",
        "title": "MyTimeTrace: Clear API Key (Logout)",
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
    ]
  },
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

---

## 🧪 Guia de Testes (Para Time da Extensão VS Code)

**⚠️ Testes abaixo devem ser executados no repositório da extensão**

### Teste 1: Configurar API Key

1. Abrir Command Palette (`Ctrl+Shift+P`)
2. Executar: `MyTimeTrace: Set API Key`
3. Inserir API Key da plataforma web: `mtt_abc123xyz`
4. Verificar mensagem: `✅ API Key saved successfully!`

### Teste 2: Registrar Device

1. Verificar Output Channel: `MyTimeTrace`
2. Ver log: `✅ Device registered: Device registered successfully`

### Teste 3: Push de Entries

1. Trabalhar no VS Code (gerar time_entries)
2. Aguardar 5 minutos (auto-sync) ou executar: `MyTimeTrace: Sync Now`
3. Verificar Output Channel:
   ```
   📤 Pushing 10 entries...
   ✅ Push complete: 10 saved, 0 conflicts
   ```

### Teste 4: Pull de Entries (outro PC)

1. Em outro PC com mesma API_KEY
2. Executar: `MyTimeTrace: Sync Now`
3. Verificar Output Channel:
   ```
   📥 Pulling entries from server...
   📥 Received 10 entries from other devices
   ✅ Pull complete: 10 entries imported
   ```

### Teste 5: Verificar SQLite

```sql
-- Verificar entries sincronizadas
SELECT * FROM time_entries WHERE synced = 1;

-- Verificar entries de outros devices
SELECT * FROM time_entries WHERE device_name = 'from-other-device';
```

---

## 📊 Checklist de Integração

**⚠️ Para o repositório MyTimeTrace VS Code (NÃO este repo)**

### Backend MyTimeTraceCloud (Este Repo) ✅ COMPLETO

- [x] **Schema Prisma:** Models User, Device, TimeEntry, SyncLog, SyncConfig
- [x] **Endpoints:** POST /sync/register, POST /sync/push, GET /sync/status
- [x] **DTOs:** TimeEntryDto, PushDto, PullQueryDto (legado), PushResponseDto, etc
- [x] **Guards:** ApiKeyGuard para validação de API_KEY
- [x] **Service:** SyncService com lógica de push-only
- [x] **Docs:** Swagger disponível em /api/docs
- [x] **Config Admin:** GET/PUT /sync/config (superadmin)

### Extensão VS Code (Repositório Separado) ⏳ PENDENTE

**Obrigatório (MVP)**

- [ ] **Database:** Adicionar coluna `client_id` ao SQLite
- [ ] **Database:** Criar índices (`client_id`, `synced`)
- [ ] **Database:** Gerar `client_id` no método `insert()`
- [ ] **ApiKeyManager:** Criar classe completa
- [ ] **SyncManager:** Criar classe completa
- [ ] **SyncCommands:** Criar arquivo com 5 comandos
- [ ] **extension.ts:** Inicializar ApiKeyManager + SyncManager
- [ ] **package.json:** Adicionar 5 novos comandos
- [ ] **package.json:** Adicionar dependência `uuid`

### Opcional (Melhorias Futuras)

- [ ] **UI:** Status bar item mostrando status de sync
- [ ] **UI:** Webview para histórico de sync
- [ ] **Conflitos:** Modal para resolver conflitos manualmente
- [ ] **Retry:** Lógica de retry automático em falhas de rede
- [ ] **Offline:** Queue de sync quando offline
- [ ] **Settings:** Configurar intervalo de auto-sync
- [ ] **Settings:** Desabilitar auto-sync (apenas manual)

---

## 🚨 Pontos de Atenção

### 1. **API Key é OPCIONAL (Não Obrigatória)**

```typescript
⚠️ REGRA DE OURO: API Key é OPCIONAL para usar a extensão

Comportamento por cenário:

1️⃣ API Key NUNCA configurada:
   ✅ Extension funciona 100% normal (modo local)
   ✅ time_entries rastreadas no SQLite
   ✅ Sync NÃO tenta executar
   🔇 NENHUMA mensagem ao usuário (silencioso)

2️⃣ API Key configurada E válida:
   ✅ Sync funciona (push-only com retry)
   ✅ Auto-sync a cada 5 minutos
   🔇 Sucesso = SILENCIOSO (sem notificação)
   🔔 Falha após 5 retries = Notifica usuário

3️⃣ API Key configurada MAS inválida:
   ⚠️ Tenta sync com 5 retries (2s entre cada)
   ⚠️ Se todas falharem → Notifica usuário
   🔔 "Falha ao conectar. Verifique API Key."
   ✅ Extension continua normal (modo local)
```

### 2. **SecretStorage vs GlobalState**

✅ **CORRETO:** Usar `context.secrets` (criptografado)
```typescript
await context.secrets.store('apiKey', 'mtt_abc123');
```

❌ **ERRADO:** Usar `globalState` (plain text)
```typescript
await context.globalState.update('apiKey', 'mtt_abc123');
```

### 3. **device_key é por Instalação**

- Cada instalação gera UUID único
- NÃO sincroniza entre PCs
- Permanece igual após reinstalar extensão

### 4. **client_id é por Entry**

- Gerado ao criar entry no SQLite
- Usado para identificar entry na sincronização
- Previne duplicatas via `INSERT OR IGNORE`

### 5. **synced Flag**

- `synced = 0`: Não sincronizada (precisa push)
- `synced = 1`: Já sincronizada (skip)
- Entries recebidas via pull já vêm com `synced = 1`

### 6. **device_name para Entries Externas**

- Entries locais: `device_name = os.hostname()`
- Entries de outros PCs: `device_name = 'from-other-device'`

### 7. **Retry Logic (5 Tentativas)**

```typescript
MAX_RETRIES = 5
RETRY_DELAY = 10000ms (10 segundos)

Operações com retry:
- registerDevice() → 5 tentativas
- push() → 5 tentativas
- pull() → 5 tentativas

HTTP 401 (Invalid API Key) → NÃO faz retry (erro imediato)
Outros erros (rede, timeout) → Retry com delay de 10s
```

### 8. **Auto-Sync Scheduling (3x ao Dia)**

```typescript
Horários padrão:
- 08:00 (manhã)
- 12:00 (meio-dia)
- 17:00 (tarde)

Configuração:
- Verificação a cada 1 minuto
- Tolerância de 1 minuto
- Configurável via backend (superadmin)

Benefícios:
✅ Reduz uso de rede/bateria
✅ Sincroniza em horários estratégicos
✅ Usuário pode fazer sync manual quando quiser
```

### 9. **Política de Notificações**

```typescript
🔇 SILENCIOSO (sem notificação):
- API Key nunca configurada
- Sync com sucesso (push-only OK)
- Auto-sync rodando em background

🔔 NOTIFICA USUÁRIO:
- API Key inválida (após 5 retries)
- Erro de conexão (após 5 retries)
- Comando manual sem API Key configurada
```

---

## 📈 Timeline Sugerida (Para Time da Extensão)

**⚠️ Cronograma para implementação no repositório MyTimeTrace VS Code**

### Semana 1: Core (MVP)
- **Dia 1-2:** Database migration + ApiKeyManager
- **Dia 3-4:** SyncManager (push, pull, register)
- **Dia 5:** Comandos + extension.ts integration
- **Dia 6:** Testes locais com backend MyTimeTraceCloud
- **Dia 7:** Documentação

### Semana 2: Testes & Refinamento
- **Dia 1-2:** Testes com 2 PCs reais (integração com Cloud)
- **Dia 3-4:** Correção de bugs
- **Dia 5:** Melhorias de UX
- **Dia 6-7:** Deploy beta

---

## 🎯 Resultado Esperado

Após implementação completa:

### ✅ Cenário 1: Sem API Key (Modo Local)
1. ✅ Extension funciona 100% normal
2. ✅ time_entries rastreadas no SQLite
3. ✅ Sync NÃO tenta executar
4. 🔇 NENHUMA notificação ao usuário (silencioso)
5. ⚙️ Usuario pode continuar trabalhando normalmente

### ✅ Cenário 2: Com API Key Válida
1. ✅ Usuário configura API_KEY (uma vez por PC)
2. ✅ Backend valida API Key → HTTP 200 OK
3. ✅ Extension auto-registra device no servidor
4. ✅ Auto-sync em horários configurados (ex: [08:00, 17:00] = 2x/dia)
5. ✅ Push: Envia entries locais → servidor (5 retries, 10s delay)
6. ✅ Pull: Recebe entries de outros PCs (5 retries, 10s delay)
7. ✅ SQLite local tem dados de TODOS os PCs do usuário
8. 🔇 Sucesso = SILENCIOSO (sem notificação)

### ⚠️ Cenário 3: API Key Inválida ou Erro de Conexão
1. ⚠️ Sync tenta 5 vezes (10s entre cada)
2. ⚠️ Após 5 falhas → Notifica usuário
3. 🔔 Modal: "Falha ao conectar. Verifique API Key ou conexão."
4. ✅ Extension continua funcionando (modo local)
5. ✅ time_entries continuam sendo rastreadas
6. ⚙️ Usuário pode reconfigurar API Key quando quiser

### 🔔 Cenário 4: Comando Manual Sem API Key
1. ⚙️ Usuário executa: "MyTimeTrace: Sync Now"
2. ⚠️ API Key não configurada
3. 🔔 Modal: "API Key não configurada. Deseja configurar?"
4. ✅ Botão "Configurar API Key" → Abre prompt
5. ✅ Botão "Cancelar" → Fecha modal

---

**📝 Nota Final:** 

✅ **Backend MyTimeTraceCloud:** 100% completo e documentado

📋 **Extensão VS Code:** Este guia serve como **especificação de integração** para o time da extensão.

🔗 **Próximos passos:**
1. Levar este documento para o repositório MyTimeTrace VS Code
2. Implementar integração seguindo os passos deste guia
3. Testar com backend em `http://localhost:8989/api`
4. Consultar Swagger em `http://localhost:8989/api/docs`

---

## 🔧 Configurações do Backend (Superadmin)

### Endpoint de Configuração de Sync

**Para permitir que superadmin ajuste as configurações de sincronização:**

#### **1. Criar Model de Config no Prisma**

```prisma
// prisma/schema.prisma

model SyncConfig {
  id        String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  
  // Configurações de Retry
  maxRetries      Int      @default(5) @map("max_retries")
  retryDelayMs    Int      @default(10000) @map("retry_delay_ms")
  
  // Configurações de Auto-Sync (array de horários em formato ["HH:MM", "HH:MM", ...])
  // Exemplos: ["08:00"] = 1x/dia | ["08:00", "17:00"] = 2x/dia | ["08:00", "12:00", "17:00", "22:00"] = 4x/dia
  syncTimes       Json     @default("[\"08:00\",\"12:00\",\"17:00\"]") @map("sync_times") @db.JsonB
  
  // Metadados
  updatedBy       String?  @map("updated_by") @db.Uuid
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  @@map("sync_config")
}
```

#### **2. Endpoint para Superadmin (Backend)**

```typescript
// src/sync/sync.controller.ts

/**
 * GET /sync/config - Obter configurações de sync
 * Apenas superadmin
 */
@Get('config')
@UseGuards(SuperAdminGuard)
@ApiOperation({ summary: 'Obter configurações de sincronização' })
async getConfig(): Promise<SyncConfigDto> {
  return this.syncService.getConfig();
}

/**
 * PUT /sync/config - Atualizar configurações de sync
 * Apenas superadmin
 */
@Put('config')
@UseGuards(SuperAdminGuard)
@ApiOperation({ summary: 'Atualizar configurações de sincronização' })
async updateConfig(
  @Body() dto: UpdateSyncConfigDto,
  @ApiKey() userId: string
): Promise<SyncConfigDto> {
  return this.syncService.updateConfig(dto, userId);
}
```

#### **3. DTOs de Configuração**

```typescript
// src/sync/dto/sync-config.dto.ts

export class SyncConfigDto {
  @ApiProperty({ example: 5, description: 'Número máximo de tentativas de retry' })
  maxRetries!: number;

  @ApiProperty({ example: 10000, description: 'Delay entre retries em milissegundos' })
  retryDelayMs!: number;

  @ApiProperty({ 
    example: ['08:00', '17:00'], 
    description: 'Array de horários de auto-sync (HH:MM). Exemplos: ["08:00"] = 1x/dia | ["08:00", "12:00", "17:00", "22:00"] = 4x/dia' 
  })
  syncTimes!: string[];
}

export class UpdateSyncConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  retryDelayMs?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1) // Mínimo 1 horário
  @ArrayMaxSize(24) // Max 1 sync por hora (24h/dia)
  @IsString({ each: true })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { each: true })
  syncTimes?: string[];
}

// 📦 Imports necessários:
// import { IsOptional, IsInt, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize, IsString, Matches } from 'class-validator';
```

#### **4. Service com Configurações**

```typescript
// src/sync/sync.service.ts

async getConfig(): Promise<SyncConfigDto> {
  let config = await this.prisma.syncConfig.findFirst();
  
  if (!config) {
    // Criar config padrão se não existir (3 syncs por dia)
    config = await this.prisma.syncConfig.create({
      data: {
        maxRetries: 5,
        retryDelayMs: 10000,
        syncTimes: ['08:00', '12:00', '17:00'], // Padrão: 3x/dia
      },
    });
  }
  
  return {
    maxRetries: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
    syncTimes: config.syncTimes as string[], // Cast JSONB para string[]
  };
}

async updateConfig(dto: UpdateSyncConfigDto, userId: string): Promise<SyncConfigDto> {
  const config = await this.prisma.syncConfig.findFirst();
  
  const updated = await this.prisma.syncConfig.update({
    where: { id: config!.id },
    data: {
      ...dto,
      updatedBy: userId,
    },
  });
  
  return {
    maxRetries: updated.maxRetries,
    retryDelayMs: updated.retryDelayMs,
    syncTimes: updated.syncTimes as string[],
  };
}
```

#### **5. Extension Buscar Config do Backend**

```typescript
// src/modules/syncManager.ts

/**
 * Buscar configurações do servidor e atualizar localmente
 */
private async fetchConfigFromServer(): Promise<void> {
  try {
    const apiKey = await this.apiKeyManager.getApiKey();
    
    if (!apiKey) {
      return;
    }

    const response = await fetch(`${this.apiUrl}/sync/config`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (response.ok) {
      const config = await response.json();
      
      // Atualizar configurações locais
      this.MAX_RETRIES = config.maxRetries;
      this.RETRY_DELAY = config.retryDelayMs;
      this.SYNC_TIMES = config.syncTimes.map((time: string) => this.parseTime(time));
      
      this.log(`✅ Config updated: retries=${config.maxRetries}, delay=${config.retryDelayMs}ms, times=${config.syncTimes.join(', ')}`);
    }
  } catch (error) {
    this.log(`⚠️ Failed to fetch config: ${error}`);
  }
}

/**
 * Parse time string "HH:MM" to { hour, minute }
 */
private parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
}

/**
 * Chamar fetchConfigFromServer() no initialize()
 */
async initialize(): Promise<void> {
  const hasApiKey = await this.apiKeyManager.hasApiKey();

  if (!hasApiKey) {
    this.log('ℹ️ API Key not configured. Running in local mode (sync disabled).');
    return;
  }

  const registered = await this.registerDeviceWithRetry();

  if (registered) {
    this.log('✅ Sync initialized successfully');
    
    // 🆕 Buscar configurações do servidor
    await this.fetchConfigFromServer();
    
    this.startAutoSync();
  } else {
    // ... resto do código
  }
}
```

---

### ⚙️ Painel de Administração (Frontend)

**Criar página de admin para configurar sync:**

```tsx
// packages/frontend-admin/src/pages/AdminSyncConfigPage.tsx

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

export default function AdminSyncConfigPage() {
  const [config, setConfig] = useState({
    maxRetries: 5,
    retryDelayMs: 10000,
    syncTimes: ['08:00', '12:00', '17:00'], // Array dinâmico
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/sync/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await api.put('/sync/config', config);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Erro ao salvar configurações');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Configurações de Sincronização</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Retry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="maxRetries">Número de Tentativas (1-10)</Label>
            <Input
              id="maxRetries"
              type="number"
              min={1}
              max={10}
              value={config.maxRetries}
              onChange={(e) => setConfig({ ...config, maxRetries: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="retryDelayMs">Delay entre Retries (ms)</Label>
            <Input
              id="retryDelayMs"
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={config.retryDelayMs}
              onChange={(e) => setConfig({ ...config, retryDelayMs: Number(e.target.value) })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Atual: {config.retryDelayMs / 1000} segundos
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Horários de Auto-Sync (Flexível)</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Exemplos: [08:00] = 1x/dia | [08:00, 17:00] = 2x/dia | [08:00, 12:00, 17:00, 22:00] = 4x/dia
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.syncTimes.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <Label htmlFor={`syncTime${index}`}>Horário {index + 1}</Label>
              <Input
                id={`syncTime${index}`}
                type="time"
                value={time}
                onChange={(e) => {
                  const newTimes = [...config.syncTimes];
                  newTimes[index] = e.target.value;
                  setConfig({ ...config, syncTimes: newTimes });
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const newTimes = config.syncTimes.filter((_, i) => i !== index);
                  setConfig({ ...config, syncTimes: newTimes });
                }}
                disabled={config.syncTimes.length === 1}
              >
                Remover
              </Button>
            </div>
          ))}
          
          <Button
            variant="outline"
            onClick={() => {
              setConfig({ ...config, syncTimes: [...config.syncTimes, '12:00'] });
            }}
            disabled={config.syncTimes.length >= 24}
          >
            + Adicionar Horário
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Total: {config.syncTimes.length} sincronização(ões) por dia
          </p>
        </CardContent>
      </Card>

      <Button onClick={saveConfig} className="mt-6">
        Salvar Configurações
      </Button>
    </div>
  );
}
```

---

**🔗 Referências:**
- Backend API: http://localhost:8989/api/docs (Swagger)
- VS Code SecretStorage: https://code.visualstudio.com/api/references/vscode-api#SecretStorage
- Prisma Schema: `packages/backend/prisma/schema.prisma`
- Admin Panel: `/admin/sync-config` (requer superadmin)
