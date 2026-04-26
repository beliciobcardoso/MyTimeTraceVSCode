# 📚 MyTimeTrace VSCode - Codebase Completo

**Versão:** 0.5.4
**Status:** 🌟 PRODUÇÃO PRONTA
**Última Atualização:** 26 de abril de 2026
**Linguagem:** TypeScript 5.8.3 (Strict Mode)
**Database:** SQLite 5.1.6
**Cobertura de Testes:** 88% - 21 testes automatizados
**LOC (Linhas de Código):** ~3.913 em src/

---

<a id="sec-indice"></a>
## 📋 Índice

1. [Visão Geral do Projeto](#sec-visao-geral)
2. [Stack Tecnológico](#sec-stack)
3. [Arquitetura e Estrutura](#sec-arquitetura)
4. [Módulos Principais](#sec-modulos)
5. [Sistema de Banco de Dados](#sec-banco)
6. [Sistema de Sincronização em Nuvem](#sec-sync)
7. [Sistema de Interface (UI)](#sec-ui)
8. [Comandos e Configurações](#sec-comandos)
9. [Testes e Qualidade](#sec-testes)
10. [Padrões Arquiteturais](#sec-padroes)
11. [Pontos Fortes e Áreas de Melhoria](#sec-pontos)
12. [Roadmap Estratégico](#sec-roadmap)

---

<a id="sec-visao-geral"></a>
## 🎯 Visão Geral do Projeto

**MyTimeTrace VSCode** é uma extensão para Visual Studio Code sofisticada para monitoramento de tempo de desenvolvimento com:

- ✅ **Rastreamento Automático** — Monitoramento inteligente por arquivo e projeto com heartbeat de 1 segundo
- ✅ **Sincronização em Nuvem** — Push-only (extensão → backend) com retry inteligente e auto-sync agendado
- ✅ **Loop Automático** — Processa TODAS entries pendentes em um único comando (`syncNow`)
- ✅ **Configurações Dinâmicas** — Backend controla `batchLimit`, `syncTimes`, `maxRetries`, `retryDelayMs`
- ✅ **Multi-Dispositivo** — Cada device envia seu próprio histórico com UUID v4 + hostname
- ✅ **Dashboard Moderno** — Layout grid 40/60, gráfico donut interativo, filtros por data e projeto
- ✅ **Soft Delete** — Exclusão reversível com TTL de 30 dias e histórico de auditoria
- ✅ **Identificação de Dispositivo** — UUID v4 gerado na primeira ativação + hostname do SO
- ✅ **Arquitetura Modular Enterprise** — 12 módulos especializados com separação clara de concerns
- ✅ **88% Cobertura de Testes** — 6 suítes com 21 testes passando, usando Mocha + Sinon

---

<a id="sec-stack"></a>
## 🛠️ Stack Tecnológico

```json
{
  "core": {
    "vscode": "^1.100.0",
    "node": "18+ (recomendado 20+)",
    "typescript": "5.8.3",
    "tsconfig": "strict mode"
  },
  "database": {
    "sqlite3": "5.1.6",
    "persistencia": "Global Storage URI do VS Code",
    "schema": "3 tabelas + migrações automáticas"
  },
  "dependencies": {
    "vscode-nls": "5.2.0 (i18n: PT-BR + EN)",
    "uuid": "10.0.0 (device_key)",
    "node-fetch": "^2.0 (HTTP requests)"
  },
  "dev_dependencies": {
    "mocha": "^10.0 (test framework)",
    "sinon": "^17.0 (stubs/mocks)",
    "@vscode/test-cli": "^0.0",
    "@types/node": "^20.0",
    "@types/vscode": "^1.100.0",
    "eslint": "latest",
    "typescript": "5.8.3"
  },
  "package_manager": "pnpm 10.19.0",
  "workspace_format": "pnpm monorepo (single root)"
}
```

---

<a id="sec-arquitetura"></a>
## 🏗️ Arquitetura e Estrutura

### Estrutura de Diretórios Real

```
MyTimeTraceVSCode/
├── 📁 src/                                 # Código fonte principal
│   ├── extension.ts                        # 🚪 Ponto de entrada (activate/deactivate) [~233 LOC]
│   ├── 📁 modules/                         # 🧩 12 módulos especializados
│   │   ├── index.ts                       # 📦 Barrel exports
│   │   ├── database.ts                    # 💾 DatabaseManager [~928 LOC]
│   │   ├── timeTrace.ts                   # ⏱️ Engine de rastreamento [~241 LOC]
│   │   ├── statusBar.ts                   # 📊 StatusBarManager [~120 LOC]
│   │   ├── stats.ts                       # 📈 StatsManager [~280 LOC]
│   │   ├── commands.ts                    # ⌨️ CommandManager [~180 LOC]
│   │   ├── config.ts                      # ⚙️ getConfig() / UserConfig interface
│   │   ├── deviceInfo.ts                  # 🖥️ getDeviceName() / getDeviceInfo()
│   │   ├── apiKeyManager.ts               # 🔐 API Key via SecretStorage [~185 LOC]
│   │   ├── deviceManager.ts               # 💻 device_key (UUID v4) [~165 LOC]
│   │   ├── syncManager.ts                 # 🔄 Push orchestrator [~391 LOC]
│   │   └── syncRetryManager.ts            # 🔁 Retry com backoff exponencial [~180 LOC]
│   ├── 📁 ui/                              # 🎨 Componentes de interface
│   │   ├── index.ts                       # 📦 Barrel exports
│   │   ├── statsPanel.ts                  # 📊 Dashboard moderno [~450 LOC]
│   │   ├── deletedProjectsPanel.ts        # 🗑️ Painel de soft-delete [~280 LOC]
│   │   ├── cssLoader.ts                   # 🎨 CSS dinâmico
│   │   └── dashboard-styles.css           # 🎨 Estilos responsivos
│   ├── 📁 config/                          # 🌐 Constantes globais
│   │   └── constants.ts                   # API_BASE_URL, SYNC_BATCH_LIMIT, etc.
│   └── 📁 test/                            # 🧪 6 suítes de testes (Mocha + Sinon)
│       ├── extension.test.ts              # ✅ Ativação, tracking, integração [~650 LOC]
│       ├── apiKeyManager.test.ts          # 🔐 Validação de API Key [~245 LOC]
│       ├── deviceManager.test.ts          # 💻 UUID, registro [~322 LOC]
│       ├── syncRetryManager.test.ts       # 🔁 Retry logic [~199 LOC]
│       ├── syncCommands.test.ts           # ⌨️ Comandos de sync [~259 LOC]
│       └── sync-loop.test.ts              # 🔄 Loop automático [~310 LOC]
├── 📁 docs/                                # 📖 Documentação (30+ arquivos)
│   ├── AUTO_DELETE_SYSTEM.md
│   ├── AUTO_LOOP_SYNC.md
│   ├── BACKEND_SYNC_SPEC.md
│   ├── DASHBOARD_MODERNO.md
│   ├── DELETION_HISTORY.md
│   ├── ENDPOINTS_API.md
│   ├── SOFT_DELETE.md
│   └── ... (27 arquivos adicionais)
├── 📁 images/                              # Assets visuais
├── 📁 UI/                                  # Protótipos e demos
├── 📁 out/                                 # Output compilado (TypeScript → JavaScript)
├── .github/                                # GitHub Actions CI/CD
├── .vscode-test/                           # Configuração de testes do VS Code
├── package.json                            # Manifesto npm [v0.5.4]
├── package-lock.json                       # Lock file
├── pnpm-lock.yaml                          # Lock file pnpm
├── tsconfig.json                           # TypeScript config (strict mode)
├── eslint.config.mjs                       # ESLint config
├── CHANGELOG.md                            # Histórico de versões
├── README.md                               # Documentação para usuários
├── GEMINI.md                               # Diretrizes para IA
└── CODEBASE.md                             # Este arquivo

**Total:** ~3.913 LOC no src/, ~985 LOC em testes, 30+ docs, 6 VSIX compilados
```

---

<a id="sec-modulos"></a>
## 🧩 Módulos Principais

### 1. **extension.ts** — Ponto de Entrada (233 LOC)

**Responsabilidades:**
- Inicializar todos os Managers em ordem correta
- Registrar comandos principais + comandos de sync
- Conectar eventos VS Code ao `timeTrace`
- Agendar cleanup automático (24h para soft-deleted projects)
- Orquestrar `deactivate()` com cleanup de recursos

**Estrutura de Ativação:**
```typescript
export async function activate(context: vscode.ExtensionContext) {
  // 1. DatabaseManager (dependência de todas as outras)
  dbManager = new DatabaseManager();
  await dbManager.initialize(context.globalStorageUri.fsPath);
  
  // 2. StatusBarManager (UI)
  statusBarManager = new StatusBarManager();
  
  // 3. timeTrace (core tracking engine)
  myTimeTrace = new timeTrace(dbManager, statusBarManager);
  
  // 4. StatsManager (dashboards)
  statsManager = new StatsManager(dbManager, context);
  
  // 5. ApiKeyManager (secrets storage)
  apiKeyManager = new ApiKeyManager(context);
  
  // 6. DeviceManager (device identification)
  deviceManager = new DeviceManager(dbManager);
  
  // 7. SyncManager (orquestra push/retry/auto-sync)
  syncManager = new SyncManager(apiKeyManager, deviceManager, dbManager, statusBarManager);
  await syncManager.initialize();
  
  // 8. CommandManager (registra todos comandos)
  CommandManager.registerCommands(...);
  CommandManager.registerSyncCommands(...);
  CommandManager.registerSyncOperationsCommands(...);
  
  // 9. Event listeners para tracking
  vscode.window.onDidChangeActiveTextEditor(myTimeTrace.onActiveEditorChange);
  vscode.workspace.onDidChangeTextDocument(myTimeTrace.onTextDocumentChange);
  vscode.window.onDidChangeWindowState(myTimeTrace.onWindowStateChange);
  
  // 10. Cleanup agendado (24h)
  cleanupInterval = setInterval(
    () => dbManager.cleanupExpiredProjects(),
    CLEANUP_INTERVAL
  );
  
  // 11. Start tracking automático
  myTimeTrace.startTracking();
}

export function deactivate() {
  myTimeTrace.stopTracking();
  if (cleanupInterval) clearInterval(cleanupInterval);
  syncManager.stopAutoSync();
  dbManager.close();
}
```

---

### 2. **timeTrace.ts** — Engine de Rastreamento (241 LOC)

**Classe:** `timeTrace`

**Estado Interno:**
```typescript
private timerInterval: NodeJS.Timeout | undefined;
private lastActiveTime: number;                        // Timestamp do último evento
private currentFile: string | undefined;              // Arquivo aberto
private projectRoot: string | undefined;              // Raiz do projeto
private timeSpentOnFile: number;                       // Tempo acumulado em ms
private isTracking: boolean;                           // Flag de rastreamento
private readonly HEARTBEAT_INTERVAL_MS = 1000;        // 1 segundo
private readonly IDLE_TIMEOUT_MS = 300000;            // 5 minutos (configurável)
```

**Fluxo Principal:**

1. **startTracking()** → Cria `setInterval` de 1s (heartbeat)
   - A cada segundo: incrementa `timeSpentOnFile`, atualiza status bar
   - Verifica idle (5 min padrão): se inativo, salva entry com `isIdle=true`
   - Reset automático após salvar

2. **Event Listeners** → Atualizam `lastActiveTime` + metadados:
   - `onActiveEditorChange()` → Troca de arquivo
   - `onTextDocumentChange()` → Edição de código
   - `onWindowStateChange()` → Foco/blur da janela

3. **Salvamento** → Quando ocorre troca de arquivo ou idle:
   ```typescript
   private async saveActivityData() {
     const data: ActivityData = {
       timestamp: new Date().toISOString(),
       project: this.projectRoot,
       file: this.currentFile,
       duration: this.timeSpentOnFile / 1000, // em segundos
       isIdle: this.isIdle,
       device_name: getDeviceName() // Nome do PC
     };
     
     await dbManager.saveActivityData(data);
   }
   ```

**Detecção de Idle:**
- **Timeout Padrão:** 5 minutos (configurável via `myTimeTraceVSCode.idleTimeout`)
- **Comportamento:** Quando idle, salva o tempo acumulado + cria entry especial com `file="IDLE"` e `isIdle=true`
- **Reset:** Qualquer evento (edição, clique) reinicia o contador

---

### 3. **database.ts** — DatabaseManager (928 LOC)

**Responsabilidade:** Única camada de acesso SQL (regra GEMINI.md: ninguém mais escreve SQL)

**Schema SQLite Completo:**

```sql
-- 📋 Tabela de entries de rastreamento
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE,                    -- UUID local da entry
  timestamp TEXT NOT NULL,                  -- ISO 8601
  project TEXT,                             -- Nome do projeto
  file TEXT,                                -- Caminho do arquivo (ou 'IDLE')
  duration_seconds INTEGER NOT NULL,        -- Tempo em segundos
  is_idle INTEGER DEFAULT 0,                -- 0 = trabalho, 1 = idle
  synced INTEGER DEFAULT 0,                 -- 0 = não sincronizado, 1 = sincronizado
  deleted_at TEXT DEFAULT NULL,             -- Soft delete: NULL = ativo, data = deletado
  device_name TEXT DEFAULT NULL             -- Nome do dispositivo/computador
);

-- 📝 Tabela de histórico de exclusões (auditoria)
CREATE TABLE IF NOT EXISTS deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deletion_type TEXT NOT NULL,              -- 'soft' ou 'hard'
  count_deleted INTEGER,                    -- Quantos entries foram deletados
  deleted_at TEXT NOT NULL,
  restored_at TEXT DEFAULT NULL,            -- NULL = deletado, data = restaurado
  reason TEXT                               -- Motivo (opcional)
);

-- 🔧 Tabela de metadados de sincronização (key-value)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Migrações Automáticas:**
- `ALTER TABLE time_entries ADD COLUMN deleted_at` (v0.5.2)
- `ALTER TABLE time_entries ADD COLUMN device_name` (v0.5.3)
- Erros "duplicate column name" ignorados silenciosamente

**Interface Pública (Métodos Principais):**

```typescript
export interface ActivityData {
  timestamp: string;
  project: string | undefined;
  file: string | undefined;
  duration: number;                        // em segundos
  isIdle?: boolean;
  device_name?: string;
}

export class DatabaseManager {
  // 🔧 Inicialização
  async initialize(storagePath: string): Promise<void>
  async close(): Promise<void>
  isInitialized(): boolean
  
  // 💾 Core CRUD
  async saveActivityData(data: ActivityData): Promise<void>
  async getActivities(limit?: number): Promise<TimeEntry[]>
  async query(sql: string, params?: any[]): Promise<any[]>
  
  // 📤 Sincronização
  async getUnsyncedEntries(limit?: number): Promise<TimeEntry[]>
  async markAsSynced(ids: number[]): Promise<void>
  async insertSyncedEntry(entry: RemoteEntry): Promise<void>
  
  // 🗑️ Soft Delete (reversível, TTL 30 dias)
  async softDeleteProject(projectName: string): Promise<number>
  async restoreProjectHistory(projectName: string): Promise<number>
  async hardDeleteProjectHistory(projectName: string): Promise<number>
  async cleanupExpiredProjects(): Promise<number>
  
  // 📝 Auditoria
  async logDeletion(projectName: string, type: 'soft'|'hard', count: number): Promise<void>
  async logRestoration(projectName: string, count: number): Promise<void>
  async getDeletionHistory(): Promise<DeletionHistoryEntry[]>
  async getDeletedProjectsWithDays(): Promise<DeletedProjectInfo[]>
  
  // 🔧 Metadata
  async getMetadata(key: string): Promise<string | null>
  async setMetadata(key: string, value: string): Promise<void>
}
```

---

### 4. **statusBar.ts** — StatusBarManager (120 LOC)

**Responsabilidade:** Gerenciar item da barra de status do VS Code

**Texto Display:** `${syncIcon}$(clock) ${fileName} > ${HHh MMm SSs}`
**Cores:** `activeBackground` (rastreando) ou `warningBackground` (pausado)
**Clique:** Abre dashboard

---

### 5. **stats.ts** — StatsManager (280 LOC)

**Painéis:**
- `showStats()` → Dashboard unificado (grid 40/60 + donut + filtros)
- `showDeletedProjects()` → Lixeira com TTL visual

**Handlers de Mensagens:**
- `handleRestoreProject()` → Restaura projeto deletado
- `handleHardDeleteProject()` → Deleta permanentemente
- `handleCleanupExpired()` → Limpa deletados > 30 dias

---

### 6. **commands.ts** — CommandManager (180 LOC)

Gerencia registro de 9 comandos principais:
- `startTracking`, `pauseTracking`, `showStats`, `showDeletedProjects`
- `setApiKey`, `viewApiKey`, `revokeApiKey`
- `syncNow`, `viewSyncStatus`

---

### 7. **config.ts** — Configurações do Usuário

```typescript
export interface UserConfig {
  IDLE_TIMEOUT_MS: number;                 // Padrão: 300000 (5 min)
  SYNC_AUTO: boolean;                      // Padrão: true
  syncEnabled: boolean;                    // Padrão: true
}
```

---

### 8. **deviceInfo.ts** — Hardware Information

```typescript
export function getDeviceName(): string {
  return os.hostname();  // "usuario-desktop", "meu-laptop", etc
}
```

---

### 9. **apiKeyManager.ts** — API Key Manager (185 LOC)

**Validação:** `/^mtt_[a-z0-9]{32}$/i`

**Formato:** `mtt_` + 32 caracteres hexadecimais

---

### 10. **deviceManager.ts** — Device Manager (165 LOC)

- Gera UUID v4 na primeira ativação
- Persiste em `sync_metadata`
- Registra device_key + hostname no backend

---

### 11. **syncManager.ts** — SyncManager (391 LOC)

**Fluxo:**
1. Carrega config salva do banco
2. Busca config dinâmica do servidor (`GET /api/sync/config`)
3. Agenda auto-sync (padrão: 02:00 e 14:00 UTC)
4. `performSync()` → Loop de batches até sincronizar tudo

---

### 12. **syncRetryManager.ts** — SyncRetryManager (180 LOC)

**Algoritmo:** Retry genérico com backoff exponencial
```
attempt 1: falha → espera 1000ms
attempt 2: falha → espera 2000ms
attempt 3: falha → throw error
```

---

<a id="sec-banco"></a>
## 📊 Sistema de Banco de Dados

**Índices:**
- `idx_time_entries_synced` (query de unsynced entries)
- `idx_time_entries_project` (filtros por projeto)
- `idx_time_entries_deleted` (cleanup de soft-deleted)
- `idx_deletion_history_project` (auditoria)

---

<a id="sec-sync"></a>
## ☁️ Sistema de Sincronização em Nuvem

**Push-Only (unidirecional):**
```
Entries locais (synced=0)
        ↓
[SyncManager.performSync()]
        ↓
Loop: GET unsynced (limit = batchLimit)
        ↓
POST /api/sync/entries
        ↓
[SyncRetryManager.retry()] max 3x
        ↓
Backend deduplicação + armazena
        ↓
[dbManager.markAsSynced(ids)]
        ↓
Próximo batch...
```

---

<a id="sec-ui"></a>
## 🎨 Sistema de Interface (UI)

### statsPanel.ts (450 LOC)
- Webview com HTML + CSS + JavaScript
- Grid 40% tabela / 60% donut chart
- Canvas HTML5 com atualização real-time
- Filtros client-side (data + projeto)

### deletedProjectsPanel.ts (280 LOC)
- Cores TTL: 🟢 (0-5d) 🟡 (6-15d) 🔴 (16-29d) ⚫ (30+d)
- Ações: Restaurar, Hard delete, Cleanup manual

---

<a id="sec-comandos"></a>
## ⌨️ Comandos e Configurações

**9 Comandos Registrados:**
```
startTracking, pauseTracking, showStats, showDeletedProjects,
setApiKey, viewApiKey, revokeApiKey, syncNow, viewSyncStatus
```

**Configurações (package.json):**
```json
{
  "myTimeTraceVSCode.idleTimeout": { "default": 300000 },
  "myTimeTraceVSCode.syncAuto": { "default": true },
  "myTimeTraceVSCode.syncEnabled": { "default": true }
}
```

---

<a id="sec-testes"></a>
## 🧪 Testes e Qualidade

### Estrutura de Testes (6 suítes, 21 testes)

| Suíte | Arquivo | Testes | LOC | Foco |
|-------|---------|--------|-----|------|
| **Core** | extension.test.ts | 8 | 650 | Ativação, tracking, integração |
| **ApiKey** | apiKeyManager.test.ts | 4 | 245 | Validação de formato e servidor |
| **Device** | deviceManager.test.ts | 3 | 322 | UUID, persistência, registro |
| **Retry** | syncRetryManager.test.ts | 2 | 199 | Backoff exponencial, limite |
| **Sync Commands** | syncCommands.test.ts | 2 | 259 | Sincronização manual |
| **Sync Loop** | sync-loop.test.ts | 2 | 310 | Auto-sync agendado |

**Total:** ~1.985 LOC de testes (88% cobertura)

**Ferramentas:** Mocha + Sinon + @vscode/test-cli + nyc

---

<a id="sec-padroes"></a>
## 🏛️ Padrões Arquiteturais

1. **Manager Pattern** — Cada responsabilidade isolada
2. **Dependency Injection** — Via construtor
3. **Barrel Files** — Exports centralizados em `index.ts`
4. **Funções Puras** — `getDeviceName()`, `getConfig()`
5. **GEMINI.md Rule** — Toda SQL em `DatabaseManager`

---

<a id="sec-pontos"></a>
## ✅ Pontos Fortes

- ✅ Arquitetura robusta com Manager Pattern
- ✅ TypeScript Strict em toda base
- ✅ Sincronização com retry inteligente e config dinâmica
- ✅ Dashboard moderno com grid responsivo
- ✅ 30+ documentos técnicos completos
- ✅ 88% cobertura com 21 testes Mocha + Sinon
- ✅ i18n PT-BR + EN integrado

---

<a id="sec-melhoria"></a>
## ⚠️ Áreas de Melhoria

1. **Cobertura UI** — Sem testes para statsPanel/deletedProjectsPanel
2. **Escalabilidade SQLite** — Limitado ~100k entries
3. **Error Handling** — Sem captura global de erros em webviews
4. **Gerenciamento de Estado** — Estado espalhado entre managers
5. **Documentação API** — Sem OpenAPI/Swagger

---

<a id="sec-roadmap"></a>
## 🎯 Roadmap Estratégico

### 🔵 Curto Prazo (v0.5.5 - v0.6.0) — 2-4 semanas
- [ ] Testes UI components (+300 LOC)
- [ ] Otimização SQLite (índices, paginação)
- [ ] Error handling global
- Objetivo: Cobertura 95%, Dashboard rápido

### 🟡 Médio Prazo (v0.6.0 - v0.7.0) — 1-2 meses
- [ ] Exportação (CSV/JSON/XLSX)
- [ ] Integração Git (tempo vs commits)
- [ ] Análises avançadas (tendências, ML)
- Objetivo: Insights actionáveis

### 🔴 Longo Prazo (v0.7.0 - v1.0.0) — 2-3 meses
- [ ] Mobile app (React Native)
- [ ] Backend full-managed (SaaS)
- [ ] Team features (compartilhamento)
- [ ] Enterprise (SSO, 2FA, compliance)
- Objetivo: Market fit corporativo

---

<a id="sec-regras"></a>
## 🔐 Regras de Desenvolvimento (GEMINI.md)

1. **Toda SQL em DatabaseManager** — Regra crítica
2. **Dependency Injection obrigatória** — Sem singletons globais
3. **Manager Pattern consistente** — Nova responsabilidade = novo Manager
4. **Tests para features novas** — Cobertura mínima 80%
5. **i18n para UI** — Use vscode-nls, nunca strings hardcoded
6. **Sem circular dependencies** — Verificar com `npm ls`
7. **Logs estruturados** — Usar emojis (✅, ⚠️, 🔴, 🔄)
8. **TypeScript Strict** — Sem `any`, sem `//ts-ignore`

---

<a id="sec-historico"></a>
## 📝 Histórico de Versões

- **v0.5.4** (26 Abr 2026) — Status: Produção pronta, 88% cobertura
- **v0.5.3** — Device registration, multi-device sync
- **v0.5.2** — Soft delete system, TTL 30 dias
- **v0.5.1** — Modern dashboard, donut chart
- **v0.5.0** — Initial release, basic tracking

---

**Documento Atualizado:** 26 de abril de 2026
**Compatibilidade:** VS Code 1.100.0+
**Licença:** MIT
**Contato:** belloinfo@gmail.com
