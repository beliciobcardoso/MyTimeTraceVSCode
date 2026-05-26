# 📚 MyTimeTrace VSCode - Codebase Completo

**Versão:** 0.6.1
**Status:** 🌟 PRODUÇÃO PRONTA
**Última Atualização:** 26 de maio de 2026
**Linguagem:** TypeScript 5.8.3 (Strict Mode)
**Database:** SQLite ^5.1.6
**Cobertura de Testes:** 139 testes automatizados passando
**LOC (Linhas de Código):** 12.602 em src/ (7.685 produção + 4.917 testes)

---

<a id="sec-indice"></a>
## 📋 Índice

1. [Visão Geral do Projeto](#sec-visao-geral)
2. [Stack Tecnológico](#sec-stack)
3. [Arquitetura e Estrutura](#sec-arquitetura)
4. [Módulos Principais](#sec-modulos)
5. [Sistema de Banco de Dados](#sec-banco)
6. [Sistema de Sincronização em Nuvem](#sec-sync)
7. [Sistema de Backup Automático](#sec-backup)
8. [Sistema de Interface (UI)](#sec-ui)
9. [Comandos e Configurações](#sec-comandos)
10. [Testes e Qualidade](#sec-testes)
11. [Padrões Arquiteturais](#sec-padroes)
12. [Pontos Fortes e Áreas de Melhoria](#sec-pontos)

---

<a id="sec-visao-geral"></a>
## 🎯 Visão Geral do Projeto

**MyTimeTrace VSCode** é uma extensão para Visual Studio Code sofisticada para monitoramento de tempo de desenvolvimento com:

- ✅ **Rastreamento Automático** — Monitoramento inteligente por arquivo e projeto com heartbeat de 1 segundo
- ✅ **Sincronização em Nuvem** — Push-only (extensão → backend) com retry inteligente e auto-sync agendado
- ✅ **Loop Automático** — Processa TODAS entries pendentes em um único comando (`syncNow`)
- ✅ **Configurações Dinâmicas** — Backend controla `batchLimit`, `syncTimes`, `maxRetries`, `retryDelayMs`
- ✅ **Multi-Dispositivo** — Cada device envia seu próprio histórico com UUID v4 via SecretStorage
- ✅ **Dashboard Moderno** — Layout grid 40/60, gráfico donut interativo, filtros por data e projeto
- ✅ **Soft Delete** — Exclusão reversível com TTL de 30 dias e histórico de auditoria
- ✅ **Identificação de Dispositivo** — UUID v4 gerado na primeira ativação + hostname do SO
- ✅ **Detecção Automática de IDE** — Identifica VS Code, Cursor, Windsurf, Code-Insiders, Google Antigravity com 3 camadas de fallback
- ✅ **Backup Automático** — Cópia agendada do SQLite com wizard de configuração, retenção e restauração
- ✅ **Arquitetura Modular Enterprise** — 15 módulos especializados com separação clara de concerns
- ✅ **139 Testes Automatizados** — 9 suítes passando, usando Mocha + Sinon
- ✅ **i18n Custom** — PT-BR + EN via JSON bundle sem dependência de vscode-nls em runtime

---

<a id="sec-stack"></a>
## 🛠️ Stack Tecnológico

```json
{
  "core": {
    "vscode": ">=1.100.0",
    "typescript": "^5.8.3",
    "tsconfig": "strict mode"
  },
  "database": {
    "sqlite3": "^5.1.6",
    "persistencia": "Global Storage URI do VS Code",
    "schema": "3 tabelas + migrações automáticas"
  },
  "dependencies": {
    "vscode-nls": "5.2.0 (tipos i18n)",
    "uuid": "^10.0.0 (device_key)",
    "dotenv": "^17.4.2 (carrega .env empacotado no VSIX)"
  },
  "devDependencies": {
    "mocha": "^10.0 (test framework, via @types/mocha ^10.0.10)",
    "sinon": "20.0.0 (stubs/mocks)",
    "@vscode/test-cli": "^0.0.10",
    "@vscode/test-electron": "^2.5.2",
    "@types/node": "20.x",
    "@types/vscode": "^1.100.0",
    "eslint": "^9.25.1",
    "typescript": "^5.8.3",
    "vscode-nls-dev": "4.0.4"
  },
  "package_manager": "pnpm@10.19.0",
  "workspace_format": "single root"
}
```

---

<a id="sec-arquitetura"></a>
## 🏗️ Arquitetura e Estrutura

### Estrutura de Diretórios Real

```
MyTimeTraceVSCode/
├── 📁 src/                                     # Código fonte (12.602 LOC total)
│   ├── extension.ts                            # 🚪 Ponto de entrada (activate/deactivate) [283 LOC]
│   ├── env-loader.ts                           # 🌐 Carrega .env antes de qualquer import [5 LOC]
│   ├── i18n.ts                                 # 🌍 i18n customizado (bundle JSON) [37 LOC]
│   ├── 📁 config/                              # 🌐 Constantes globais
│   │   └── constants.ts                        # API_BASE_URL, SYNC_*, BACKUP_*, etc. [78 LOC]
│   ├── 📁 modules/                             # 🧩 15 módulos especializados
│   │   ├── index.ts                            # 📦 Barrel exports [11 LOC]
│   │   ├── database.ts                         # 💾 DatabaseManager [978 LOC]
│   │   ├── timeTrace.ts                        # ⏱️ Engine de rastreamento [246 LOC]
│   │   ├── statusBar.ts                        # 📊 StatusBarManager [132 LOC]
│   │   ├── stats.ts                            # 📈 StatsManager [416 LOC]
│   │   ├── commands.ts                         # ⌨️ CommandManager [573 LOC]
│   │   ├── config.ts                           # ⚙️ getConfig() / UserConfig [26 LOC]
│   │   ├── deviceInfo.ts                       # 🖥️ getDeviceName() / getIdeName() / getIdeVersion() [138 LOC]
│   │   ├── apiKeyManager.ts                    # 🔐 API Key via SecretStorage [195 LOC]
│   │   ├── deviceManager.ts                    # 💻 device_key (UUID v4) via SecretStorage [277 LOC]
│   │   ├── syncManager.ts                      # 🔄 Push orchestrator [401 LOC]
│   │   ├── syncRetryManager.ts                 # 🔁 Retry com backoff configurável [167 LOC]
│   │   ├── backupManager.ts                    # 🗄️ BackupManager + wizard + scheduler [586 LOC]
│   │   ├── backupCommands.ts                   # ⌨️ 7 comandos de backup [99 LOC]
│   │   └── backupRetryManager.ts               # 🔁 Retry de backup (3 tentativas fixas) [47 LOC]
│   ├── 📁 ui/                                  # 🎨 Componentes de interface
│   │   ├── index.ts                            # 📦 Barrel exports [14 LOC]
│   │   ├── statsPanel.ts                       # 📊 Dashboard moderno [1.474 LOC]
│   │   ├── deletedProjectsPanel.ts             # 🗑️ Painel de soft-delete [941 LOC]
│   │   ├── backupPanel.ts                      # 🗄️ Painel WebView de backups [489 LOC]
│   │   ├── cssLoader.ts                        # 🎨 CSS dinâmico [72 LOC]
│   │   └── dashboard-styles.css                # 🎨 Estilos responsivos
│   └── 📁 test/                                # 🧪 9 suítes de testes (Mocha + Sinon) [4.917 LOC]
│       ├── extension.test.ts                   # ✅ Ativação, tracking, integração [2.665 LOC]
│       ├── apiKeyManager.test.ts               # 🔐 Validação de API Key [246 LOC]
│       ├── deviceManager.test.ts               # 💻 UUID, registro, IDE cache [543 LOC]
│       ├── syncRetryManager.test.ts            # 🔁 Config dinâmica, retry [186 LOC]
│       ├── syncCommands.test.ts                # ⌨️ Comandos de sync [259 LOC]
│       ├── sync-loop.test.ts                   # 🔄 Loop automático de batches [310 LOC]
│       ├── backupManager.test.ts               # 🗄️ Backup, retenção, mutex [347 LOC]
│       ├── backupPanel.test.ts                 # 🖼️ Painel WebView de backups [263 LOC]
│       └── backupRetryManager.test.ts          # 🔁 Retry de backup [98 LOC]
├── 📁 docs/                                    # 📖 Documentação (35 arquivos)
├── 📁 images/                                  # Assets visuais
├── 📁 UI/                                      # Protótipos e demos
├── 📁 out/                                     # Output compilado (TypeScript → JavaScript)
├── .github/                                    # GitHub Actions CI/CD
├── package.json                                # Manifesto npm [v0.6.1]
├── tsconfig.json                               # TypeScript config (strict mode)
├── eslint.config.mjs                           # ESLint config
├── CHANGELOG.md                                # Histórico de versões
├── README.md                                   # Documentação para usuários
└── CODEBASE.md                                 # Este arquivo
```

---

<a id="sec-modulos"></a>
## 🧩 Módulos Principais

### 1. **extension.ts** — Ponto de Entrada (283 LOC)

**Responsabilidades:**
- Inicializar todos os Managers em ordem correta
- Registrar comandos principais + sync + backup
- Conectar eventos VS Code ao `timeTrace`
- Agendar cleanup automático (5 min inicial + 24h periódico)
- Orquestrar `deactivate()` com cleanup de recursos

**Imports externos:** `./env-loader` (primeiro), `./i18n`, `vscode`, módulos internos

**Ordem de inicialização:**
```typescript
export async function activate(context: vscode.ExtensionContext) {
  // 1. DatabaseManager (dependência de todos)
  dbManager = new DatabaseManager();
  await dbManager.initialize(context.globalStorageUri.fsPath);

  // 2. StatusBarManager (UI)
  statusBarManager = new StatusBarManager();

  // 3. timeTrace recebe callback de IDE: () => currentIdeName
  myTimeTrace = new timeTrace(dbManager, statusBarManager, () => currentIdeName);

  // 4. StatsManager (dashboards)
  statsManager = new StatsManager(dbManager, context);

  // 5. ApiKeyManager e DeviceManager recebem ExtensionContext
  apiKeyManager = new ApiKeyManager(context);
  deviceManager = new DeviceManager(context);

  // 6. Detecta e cacheia IDE na ativação
  currentIdeName = deviceManager.getIdeName();
  currentIdeVersion = deviceManager.getIdeVersion();

  // 7. SyncManager
  syncManager = new SyncManager(apiKeyManager, deviceManager, dbManager, statusBarManager);

  // 8. StatusBar criada e IDE exibida
  statusBarManager.create();
  statusBarManager.setIdeInfo(currentIdeName, currentIdeVersion);

  // 9. Comandos registrados (core + sync + syncOps)
  CommandManager.registerCommands(...);
  CommandManager.registerSyncCommands(context, apiKeyManager, deviceManager, syncManager);
  CommandManager.registerSyncOperationsCommands(context, apiKeyManager, deviceManager, syncManager, dbManager);

  // 10. Events listeners para tracking
  vscode.window.onDidChangeActiveTextEditor(myTimeTrace.onActiveEditorChange)
  vscode.workspace.onDidChangeTextDocument(myTimeTrace.onTextDocumentChange)
  vscode.window.onDidChangeWindowState((ws) => {
    myTimeTrace.onWindowStateChange(ws);
    backupManager?.checkMissedBackup(); // verifica backup atrasado
  })
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('myTimeTraceVSCode.backup')) backupManager?.onConfigChange();
  })

  // 11. Auto-start se configurado
  if (userConfig.autoStart) setTimeout(() => startTracking(), 100);

  // 12. SyncManager inicializa (busca config + agenda auto-sync)
  await syncManager.initialize();

  // 13. BackupManager inicializa com delay (BACKUP_INITIAL_DELAY = 5s)
  setBackupPanelRef(BackupPanel);
  BackupCommands.registerBackupCommands(context, () => backupManager);
  setTimeout(async () => { backupManager = new BackupManager(dbManager, myTimeTrace, outputChannel); ... }, BACKUP_INITIAL_DELAY);

  // 14. Cleanup de projetos expirados (5 min inicial + 24h periódico)
  setTimeout(() => dbManager.cleanupExpiredProjects(), CLEANUP_INITIAL_DELAY);
  cleanupInterval = setInterval(() => dbManager.cleanupExpiredProjects(), CLEANUP_INTERVAL);
}

export function deactivate() {
  myTimeTrace.dispose();
  statusBarManager.dispose();
  if (cleanupInterval) clearInterval(cleanupInterval);
  dbManager.close();
}
```

---

### 2. **env-loader.ts** — Carregador de Variáveis de Ambiente (5 LOC)

**Responsabilidade:** Carregar `.env` da raiz da extensão antes de qualquer módulo ler `process.env`.
Deve ser o **primeiro import** em `extension.ts`.

```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
```

---

### 3. **i18n.ts** — Internacionalização Customizada (37 LOC)

**Responsabilidade:** Resolver strings localizadas a partir de arquivos JSON de bundle (`package.nls.{locale}.json`).

```typescript
export function localize(key: string, defaultMessage: string, ...args: (string | number)[]): string
```

**Comportamento:** Carrega bundle de `package.nls.{vscode.env.language}.json` na raiz da extensão. Se não encontrar, usa `defaultMessage`. Substitui `{0}`, `{1}`, etc. pelos argumentos.

---

### 4. **config/constants.ts** — Constantes Globais (78 LOC)

```typescript
// URL da API via .env (produção) ou localhost (sem .env)
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api';

export const REQUEST_TIMEOUT = 30000;           // 30 segundos
export const SYNC_BATCH_LIMIT = 200;            // entries por batch
export const SYNC_DEFAULT_TIMES = ['08:00', '12:00', '17:00']; // auto-sync padrão

export const SECRET_KEYS = {
  API_KEY: 'mytimetrace.apiKey',
  DEVICE_KEY: 'mytimetrace.deviceKey'
} as const;

export const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;  // 24h em ms
export const CLEANUP_INITIAL_DELAY = 5 * 60 * 1000;   // 5 min em ms

// Backup
export const BACKUP_MIN_RETENTION = 3;
export const BACKUP_DEFAULT_INTERVAL_HOURS = 24;
export const BACKUP_MAX_RETRIES = 3;
export const BACKUP_RETRY_DELAY_MS = 30_000;    // 30 segundos
export const BACKUP_INITIAL_DELAY = 5_000;      // 5 segundos
export const BACKUP_ALERT_GAP_DAYS = 7;
```

---

### 5. **timeTrace.ts** — Engine de Rastreamento (246 LOC)

**Classe:** `timeTrace`

**Constructor:**
```typescript
constructor(
  private dbManager: DatabaseManager,
  private statusBarManager: StatusBarManager,
  getIdeName: () => string = () => 'unknown'
)
```

**Estado Interno:**
```typescript
private timerInterval: ReturnType<typeof setInterval> | undefined;
private lastActiveTime: number = Date.now();
private currentFile: string | undefined;
private projectRoot: string | undefined;
private timeSpentOnFile: number = 0; // em ms
private isTracking: boolean = false;
private getIdeName: () => string;     // callback injetado da extension
```

**Métodos Públicos:**
```typescript
startTracking(): void         // Cria setInterval de 1s (heartbeat)
pauseTracking(): void         // Para timer, salva tempo atual
onActiveEditorChange(editor: vscode.TextEditor | undefined): void
onTextDocumentChange(event: vscode.TextDocumentChangeEvent): void
onWindowStateChange(windowState: vscode.WindowState): void
isCurrentlyTracking(): boolean
dispose(): void
```

**Fluxo de Heartbeat (1 segundo):**
1. Verifica idle: `now - lastActiveTime > IDLE_TIMEOUT_MS` → salva entry + cria entry `file="IDLE"` → limpa estado
2. Se arquivo ativo: incrementa `timeSpentOnFile += 1000`, atualiza status bar
3. Se sem arquivo mas editor ativo: reinicia tracking (voltou da inatividade)

---

### 6. **database.ts** — DatabaseManager (978 LOC)

**Responsabilidade:** Única camada de acesso SQL (regra GEMINI.md: ninguém mais escreve SQL)

**Interface ActivityData:**
```typescript
export interface ActivityData {
  timestamp: string;
  project: string | undefined;
  file: string | undefined;
  duration: number;           // em segundos
  isIdle?: boolean;
  device_name?: string;
  ide_name?: string;
}
```

**Métodos Públicos:**
```typescript
// Inicialização
async initialize(storagePath: string): Promise<void>
async close(): Promise<void>
isInitialized(): boolean
getDbPath(): string

// Core CRUD
async saveActivityData(data: ActivityData): Promise<void>
query(sql: string, params?: any[]): Promise<any[]>

// Soft Delete e Auditoria
async deleteProjectHistory(projectName: string): Promise<number>   // soft delete
async hardDeleteProjectHistory(projectName: string): Promise<number>
async restoreProjectHistory(projectName: string): Promise<number>
async cleanupExpiredProjects(): Promise<number>                     // TTL 30 dias
async getDeletedProjects(): Promise<string[]>
async getDeletedProjectsWithDays(): Promise<Array<{project, deleted_at, records_count, days_since_deletion}>>
async getDeletionHistory(includeRestored?: boolean): Promise<any[]>

// Sincronização
async getUnsyncedEntries(limit?: number): Promise<any[]>
async getTotalEntriesCount(): Promise<number>
async markAsSynced(entryIds: number[]): Promise<void>
async insertSyncedEntry(entry: {clientId, timestamp, project, file, durationSeconds, isIdle, deviceKey?}): Promise<void>   // @deprecated — não chamado desde v0.5.2; mantido para dedup local

// Metadata key-value
async getMetadata(key: string): Promise<string | null>
async setMetadata(key: string, value: string): Promise<void>

// Backup
checkIntegrity(): Promise<void>                // PRAGMA quick_check
vacuumInto(destPath: string): Promise<void>    // VACUUM INTO para backup
```

---

### 7. **statusBar.ts** — StatusBarManager (132 LOC)

**Item principal (prioridade 1000):** `${syncIcon}$(clock) ${fileName} > ${HHh MMm SSs}`
**Item de IDE (prioridade 999):** `$(code) ${ideName} (v${ideVersion})`
**Visibilidade:** controlada por `myTimeTraceVSCode.showInStatusBar`
**Cores:** `activeBackground` (rastreando) ou `warningBackground` (pausado)
**Clique:** Abre dashboard

```typescript
create(): void
setIdeInfo(ideName: string, ideVersion: string): void
update(currentFile: string | undefined, timeSpentOnFile: number, isTracking: boolean): void
setSyncStatus(syncing: boolean): void
dispose(): void
```

---

### 8. **stats.ts** — StatsManager (416 LOC)

**Classe:** `StatsManager`
**Constructor:** `(dbManager: DatabaseManager, context: vscode.ExtensionContext)`

**Métodos Públicos:**
```typescript
async showStats(): Promise<void>           // Abre dashboard principal (delega a showSimpleStats)
async showSimpleStats(): Promise<void>     // Carrega dados do DB e cria o WebviewPanel com filtros
async showDeletedProjects(): Promise<void> // Abre painel lixeira
```

**Handlers Privados:**
```typescript
private async handleDeleteProject(projectName, panel): Promise<void>
private async loadStatsData(): Promise<{projectsData, rawData}>
private async handleRestoreProject(projectName, panel): Promise<void>
private async handleHardDeleteProject(projectName, panel): Promise<void>
private async handleCleanupExpired(panel): Promise<void>
private async refreshDeletedProjectsPanel(panel): Promise<void>
```

**Mensagens Webview Suportadas:**
`deleteProject`, `restoreProject`, `hardDeleteProject`, `cleanupExpiredProjects`, `refreshDeletedProjects`

---

### 9. **commands.ts** — CommandManager (573 LOC)

**Classe:** `CommandManager` (estática)

**Métodos Públicos:**
```typescript
static safeRegisterCommand(commandId: string, handler: (...args: any[]) => any): vscode.Disposable

static registerCommands(
  startTracking: () => void,
  pauseTracking: () => void,
  showStats: () => void,
  showDeletedProjects?: () => void
): vscode.Disposable[]

static registerSyncCommands(
  context: vscode.ExtensionContext,
  apiKeyManager: ApiKeyManager,
  deviceManager: DeviceManager,
  syncManager?: SyncManager
): vscode.Disposable[]   // setApiKey, viewApiKey, revokeApiKey

static registerSyncOperationsCommands(
  context: vscode.ExtensionContext,
  apiKeyManager: ApiKeyManager,
  deviceManager: DeviceManager,
  syncManager: SyncManager,
  dbManager: DatabaseManager
): vscode.Disposable[]   // syncNow (com progress), viewSyncStatus (painel webview)
```

`viewSyncStatus` gera HTML inline via `generateSyncStatusHTML()` (private).

---

### 10. **config.ts** — Configurações do Usuário (26 LOC)

```typescript
export interface UserConfig {
  IDLE_TIMEOUT_MS: number;    // idleTimeout (minutos) × 60000
  autoStart: boolean;
  showInStatusBar: boolean;
  syncEnabled: boolean;
}

export function getConfig(): UserConfig
```

**Nota:** `idleTimeout` é lido em **minutos** (padrão: 5) e convertido para ms internamente.

---

### 11. **deviceInfo.ts** — Hardware & IDE Information (138 LOC)

```typescript
// Dispositivo
export function getDeviceName(): string       // os.hostname()
export function getDeviceInfo(): { hostname, platform, arch, type, release, userInfo, version }

// Detecção de IDE (3 camadas de fallback)
export function getIdeName(globalStorageUriPath: string): string
  // Camada 1: analisa globalStorageUri.fsPath (segmentos: Code/, Cursor/, Windsurf/, ...)
  // Camada 2: variáveis de ambiente (VSCODE_RELEASE)
  // Camada 3: process.execPath
  // Fallback: 'unknown'

export function getIdeVersion(ideName: string): string
  // VS Code / Code-Insiders: vscode.version (API nativa)
  // Forks: lê resources/app/package.json da instalação
  // Fallback: `${vscode.version}-base`

// @internal — expostos para testes
export function _detectIdeFromEnv(): string | null
export function _detectIdeFromProcess(): string | null
```

**IDEs detectadas:** VS Code, Code - Insiders, Cursor, Windsurf, Google Antigravity

---

### 12. **apiKeyManager.ts** — API Key Manager (195 LOC)

**Validação:** `/^mtt_[a-z0-9]{32}$/i`
**Storage:** `vscode.SecretStorage` (criptografado pelo SO)

```typescript
async setApiKey(apiKey: string): Promise<void>   // valida formato antes de salvar
async getApiKey(): Promise<string | undefined>
async revokeApiKey(): Promise<void>
async testConnection(): Promise<boolean>          // GET /sync/status
async getMaskedApiKey(): Promise<string>          // "mtt_1a2...6p"
async hasApiKey(): Promise<boolean>
```

---

### 13. **deviceManager.ts** — Device Manager (277 LOC)

**Constructor:** `(context: vscode.ExtensionContext)`
**Storage:** `vscode.SecretStorage` para `device_key` (não mais `sync_metadata`)

```typescript
getIdeName(): string         // usa deviceInfo.getIdeName; cacheia em this._ideName
getIdeVersion(): string      // usa deviceInfo.getIdeVersion; cacheia em this._ideVersion
async getOrCreateDeviceKey(): Promise<string>   // gera UUID v4 se não existe
async revokeDeviceKey(): Promise<void>
async hasDeviceKey(): Promise<boolean>
getDeviceInfo(): object
getDeviceName(): string
async registerDevice(apiKey: string): Promise<boolean>  // POST /sync/register
async getSyncStatus(apiKey: string): Promise<any | null> // GET /sync/status?deviceKey=...
```

---

### 14. **syncManager.ts** — SyncManager (401 LOC)

**Constructor:** `(apiKeyManager, deviceManager, dbManager, statusBarManager?)`

```typescript
async initialize(): Promise<void>         // verifica API Key, carrega config, agenda auto-sync
scheduleAutoSync(): void                  // timer a cada 1 min, compara hora com syncTimes
async performSync(): Promise<boolean>     // loop de batches até não ter mais entries pendentes
dispose(): void                           // limpa timer de auto-sync
getStatus(): { isSyncing, syncTimes, batchLimit, retryConfig }
```

**Config dinâmica:** obtida de `GET /sync/config`, persistida em `sync_metadata`.
**Payload push:** `{ deviceKey, entries: [{ clientId, timestamp, project, file, durationSeconds, isIdle, ide_name?, ide_version? }] }`

---

### 15. **syncRetryManager.ts** — SyncRetryManager (167 LOC)

**Padrão:** Retry genérico com delay configurável
**Defaults:** `maxRetries = 5`, `retryDelayMs = 10000` (10s)

```typescript
updateConfig(maxRetries: number, retryDelayMs: number): void
async execute<T>(operation: () => Promise<T>): Promise<T | null>
getConfig(): { maxRetries: number; retryDelayMs: number }
```

**Limites validados:** `maxRetries` em [1, 10], `retryDelayMs` em [1000, 60000].

---

### 16. **backupManager.ts** — BackupManager (586 LOC)

**Exports:** `BackupState` (tipo), `BackupStatus` (interface), `BackupManager`, `setBackupPanelRef`

**Constructor:** `(databaseManager: DatabaseManager, myTimeTrace: timeTrace, outputChannel: vscode.OutputChannel)`

**API Pública:**
```typescript
async initialize(): Promise<void>                          // lê config, verifica backup perdido, agenda
async triggerManualBackup(): Promise<void>                // dispara backup via retryManager
getStatus(): BackupStatus                                 // { state, isBacking, lastBackupAt, nextBackupAt, lastError, destinationPath }
async openConfigWizard(): Promise<void>                   // wizard de 4 passos
scheduleNext(intervalMs: number): void                    // agenda próximo backup
async checkMissedBackup(): Promise<void>                  // verifica gap e executa se necessário
onConfigChange(): void                                    // debounce 500ms ao mudar settings
pauseScheduler(): void
validateBackupFile(filePath: string): Promise<void>       // PRAGMA quick_check no arquivo
async restoreFromBackup(backupFilePath: string): Promise<void>  // copia e recarrega VS Code
dispose(): void
```

**Fluxo de Backup:**
1. Valida path de destino (proíbe `..`, `'`, `\0`, paths relativos)
2. `PRAGMA quick_check` na origem
3. Cria pasta de destino se necessário
4. Limpa arquivos `.tmp` órfãos
5. Verifica espaço em disco (via `fs.promises.statfs`, se disponível)
6. `VACUUM INTO tmpPath` → rename atômico `.tmp → .sqlite`
7. Valida integridade do backup gerado
8. Aplica política de retenção (remove mais antigos se exceder `maxBackups`)
9. Atualiza `sync_metadata` com `backup.lastTimestamp`

---

### 17. **backupCommands.ts** — BackupCommands (99 LOC)

Registra 7 comandos de backup usando `CommandManager.safeRegisterCommand`:
`backupNow`, `configureBackup`, `manageBackups`, `openBackupFolder`, `editBackupSettings`, `pauseBackup`, `resumeBackup`

---

### 18. **backupRetryManager.ts** — BackupRetryManager (47 LOC)

**Config:** imutável, lida de `constants.ts` (`BACKUP_MAX_RETRIES=3`, `BACKUP_RETRY_DELAY_MS=30s`)
`updateConfig()` é no-op (config via VS Code settings, não via servidor)

```typescript
async execute<T>(operation: () => Promise<T>): Promise<T | null>
```

---

<a id="sec-banco"></a>
## 📊 Sistema de Banco de Dados

**Arquivo:** `time_tracker.sqlite` em `context.globalStorageUri.fsPath`
**Journal mode:** WAL (verificado via PRAGMA journal_mode na abertura)

### Schema SQLite Completo

```sql
-- 📋 Tabela de entries de rastreamento
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE,                    -- UUID local ('local-{uuid}')
  timestamp TEXT NOT NULL,                  -- ISO 8601
  project TEXT,                             -- Nome do projeto
  file TEXT,                                -- Caminho do arquivo (ou 'IDLE')
  duration_seconds INTEGER NOT NULL,        -- Tempo em segundos
  is_idle INTEGER DEFAULT 0,                -- 0 = trabalho, 1 = idle
  synced INTEGER DEFAULT 0,                 -- 0 = não sincronizado, 1 = sincronizado
  deleted_at TEXT DEFAULT NULL,             -- Soft delete: NULL = ativo, data = deletado
  device_name TEXT DEFAULT NULL,            -- hostname do dispositivo
  ide_name TEXT DEFAULT NULL                -- IDE detectada (VS Code, Cursor, Windsurf…)
);

-- 📝 Tabela de histórico de exclusões (auditoria)
CREATE TABLE IF NOT EXISTS deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  records_count INTEGER NOT NULL,
  deletion_type TEXT NOT NULL,              -- 'soft' ou 'hard'
  restored_at TEXT DEFAULT NULL             -- NULL = deletado, data = restaurado
);

-- 🔧 Tabela de metadados de sincronização (key-value)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Migrações Automáticas (ordem de aplicação)

1. `ADD COLUMN deleted_at TEXT DEFAULT NULL` (v0.5.2)
2. `ADD COLUMN device_name TEXT DEFAULT NULL` (v0.5.3)
3. `ADD COLUMN client_id TEXT` + backfill `'local-' || id` + índice único (v0.5.x)
4. `ADD COLUMN ide_name TEXT` (v0.5.5)
5. Erros "duplicate column name" ignorados silenciosamente

### Índices

- `idx_time_entries_client_id_unique` — deduplicação de inserts (UNIQUE)
- `idx_time_entries_synced` — query de unsynced entries
- `idx_time_entries_project` — filtros por projeto
- `idx_time_entries_deleted` — cleanup de soft-deleted

### Chaves de sync_metadata

| Chave | Descrição |
|-------|-----------|
| `sync_times` | JSON array de horários de auto-sync |
| `sync_batch_limit` | Limite de entries por batch |
| `max_retries` | Máximo de retries |
| `retry_delay_ms` | Delay entre retries |
| `backup.lastTimestamp` | ISO do último backup |
| `backup.nextScheduled` | ISO do próximo backup agendado |
| `backup.state` | Estado do backup ('active', 'paused', 'failed') |
| `backup.lastError` | Mensagem do último erro de backup |

---

<a id="sec-sync"></a>
## ☁️ Sistema de Sincronização em Nuvem

**Push-Only (unidirecional):**
```
Entries locais (synced=0, deleted_at IS NULL)
        ↓
[SyncManager.performSync()]
        ↓
Loop: getUnsyncedEntries(batchLimit)
        ↓
POST /api/sync/push  ← { deviceKey, entries[{ clientId, timestamp, project, file, durationSeconds, isIdle, ide_name?, ide_version? }] }
        ↓
[SyncRetryManager.execute()] max 5x (configurável via /sync/config)
        ↓
Backend deduplicação + armazena
        ↓
[dbManager.markAsSynced(ids)]  ← marca TODOS enviados como synced=1
        ↓
hasMoreEntries = syncedCount > 0  → próximo batch ou finaliza
```

**Auto-sync:** Timer a cada 60s compara hora atual com `syncTimes` (padrão: `['08:00', '12:00', '17:00']`).

**Config dinâmica:** `GET /api/sync/config` retorna `{ syncTimes, batchLimit, maxRetries, retryDelayMs }`. Persistida em `sync_metadata` como fallback.

---

<a id="sec-backup"></a>
## 🗄️ Sistema de Backup Automático

**Tecnologia:** `VACUUM INTO` para snapshot atômico + validação `PRAGMA quick_check`.

**Fluxo de agendamento:**
1. `initialize()`: lê config, verifica backup perdido (`checkMissedBackup`), chama `scheduleNext`
2. `scheduleNext(intervalMs)`: calcula delay = `intervalMs - elapsed` desde último backup
3. Após delay: executa backup e agenda `setInterval` para repetições
4. `onConfigChange()`: debounce 500ms → re-agenda ou pausa

**Nomenclatura de arquivos:** `time_tracker_YYYY-MM-DD_HH-mm-ss[_N].sqlite`

**Política de retenção:** mantém os `maxBackups` mais recentes; mínimo sempre `BACKUP_MIN_RETENTION = 3`.

**Validações de path:** proibido `..`, `'`, `\0`, paths relativos; aviso para pastas de nuvem/rede.

**Configuração** via `myTimeTraceVSCode.backup.*` (scope: `machine`).

---

<a id="sec-ui"></a>
## 🎨 Sistema de Interface (UI)

### statsPanel.ts (1.474 LOC)

**Exports:** `FileTimeData`, `ProjectTimeData`, `ProjectsData` (type), `TimeEntry`, `StatsFilters`, `StatsPanel`

**Métodos Estáticos:**
```typescript
static createStatsPanel(projectsData, context, rawData): vscode.WebviewPanel
static generateStatsHtml(projectsData, context, rawData): string
```

**Funcionalidades:**
- Grid 40% tabela / 60% donut chart (Canvas HTML5)
- Filtros client-side por data e projeto
- Botão de exclusão de projeto (mensagem para backend)
- Atualização de dados em tempo real via postMessage

### deletedProjectsPanel.ts (941 LOC)

**Exports:** `DeletedProject` (interface), `DeletedProjectsPanel`

```typescript
interface DeletedProject {
  project: string; deleted_at: string; records_count: number; days_since_deletion: number;
}

class DeletedProjectsPanel {
  public static generateDeletedProjectsHtml(deletedProjects, styleUri): string
}
```

**Cores TTL:** 🟢 (0–5d) 🟡 (6–15d) 🔴 (16–29d) ⚫ (30+d)
**Ações:** Restaurar, Hard delete, Cleanup manual, Refresh

### backupPanel.ts (489 LOC)

**Classe:** `BackupPanel`

```typescript
static createOrShow(backupManager: BackupManager): void
static currentPanel: BackupPanel | undefined
refresh(): void   // re-renderiza HTML
```

**Funcionalidades:** Tabela de arquivos de backup com checkboxes, badges de "atual", status do agendador, botão Backup Now, Configure, Open Folder, Delete Selected, Restore. FileSystemWatcher atualiza automaticamente ao criar/deletar backups.

### cssLoader.ts (72 LOC)

```typescript
class CssLoader {
  static loadCssFile(cssFileName: string, extensionPath: string): string
  static loadDashboardStyles(extensionPath: string): string
  static formatCssForHtml(cssContent: string): string
}
```

---

<a id="sec-comandos"></a>
## ⌨️ Comandos e Configurações

### 16 Comandos Registrados

**Core (9):**
```
startTracking     — Inicia rastreamento
pauseTracking     — Pausa rastreamento
showStats         — Abre dashboard principal
showDeletedProjects — Abre painel lixeira
setApiKey         — Configura API Key (com validação de formato)
viewApiKey        — Exibe API Key mascarada + opção de teste
revokeApiKey      — Remove API Key e device_key
syncNow           — Sincronização manual (progress notification)
viewSyncStatus    — Painel webview com status de sincronização
```

**Backup (7):**
```
backupNow         — Backup manual imediato (progress notification)
configureBackup   — Abre wizard de 4 passos
manageBackups     — Abre BackupPanel (tabela de arquivos)
openBackupFolder  — Abre pasta de backup no explorador
editBackupSettings — Abre configurações myTimeTraceVSCode.backup
pauseBackup       — Pausa agendamento + seta backup.enabled=false
resumeBackup      — Retoma agendamento + seta backup.enabled=true + initialize()
```

### Configurações (package.json)

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `myTimeTraceVSCode.idleTimeout` | number | 5 | Timeout de idle em **minutos** |
| `myTimeTraceVSCode.autoStart` | boolean | true | Iniciar rastreamento automaticamente |
| `myTimeTraceVSCode.showInStatusBar` | boolean | true | Exibir itens na status bar |
| `myTimeTraceVSCode.syncEnabled` | boolean | true | Habilitar sincronização em nuvem |
| `myTimeTraceVSCode.syncInterval` | number | 60 | Intervalo de verificação de auto-sync (min) |
| `myTimeTraceVSCode.backup.enabled` | boolean | false | Habilitar backup automático |
| `myTimeTraceVSCode.backup.destinationPath` | string | "" | Pasta de destino dos backups |
| `myTimeTraceVSCode.backup.intervalHours` | number | 24 | Intervalo entre backups (horas, mín. 1) |
| `myTimeTraceVSCode.backup.maxBackups` | number | 7 | Máximo de backups a manter (mín. 3) |
| `myTimeTraceVSCode.backup.notifyOnSuccess` | boolean | false | Notificar ao concluir backup |
| `myTimeTraceVSCode.backup.showInStatusBar` | boolean | false | Mostrar status de backup na status bar |

---

<a id="sec-testes"></a>
## 🧪 Testes e Qualidade

### Estrutura de Testes (9 suítes, 139 testes passando)

| Suíte | Arquivo | LOC | Foco |
|-------|---------|-----|------|
| **Core** | extension.test.ts | 2.665 | Ativação, tracking, migração `ide_name` |
| **ApiKey** | apiKeyManager.test.ts | 246 | Validação de formato e servidor |
| **Device** | deviceManager.test.ts | 543 | UUID, persistência, `getIdeName` cache, `getIdeVersion` |
| **Retry** | syncRetryManager.test.ts | 186 | Config dinâmica, retry, delays, limites |
| **Sync Commands** | syncCommands.test.ts | 259 | Sincronização manual |
| **Sync Loop** | sync-loop.test.ts | 310 | Auto-sync: batches de 100+100+50, loop de 80 entries |
| **Backup** | backupManager.test.ts | 347 | Backup, retenção, mutex, colisão de nome |
| **Backup Panel** | backupPanel.test.ts | 263 | Tabela, estado vazio, exclusão, watcher |
| **Backup Retry** | backupRetryManager.test.ts | 98 | Retry, notificação de falha |

**Ferramentas:** Mocha + Sinon 20.0.0 + @vscode/test-cli + @vscode/test-electron

---

<a id="sec-padroes"></a>
## 🏛️ Padrões Arquiteturais

1. **Manager Pattern** — Cada responsabilidade isolada em sua própria classe
2. **Dependency Injection** — Via construtor (sem singletons globais)
3. **Barrel Files** — Exports centralizados em `src/modules/index.ts` e `src/ui/index.ts`. Nota: `ApiKeyManager`, `DeviceManager`, `SyncManager` e `SyncRetryManager` são importados diretamente (não passam pelo barrel)
4. **Funções Puras** — `getDeviceName()`, `getConfig()`, `getIdeName()`, `localize()`
5. **GEMINI.md Rule** — Toda SQL em `DatabaseManager`; outros módulos usam apenas métodos públicos
6. **Lazy Init** — `BackupManager` inicializa após `BACKUP_INITIAL_DELAY` (5s) para não atrasar startup
7. **SecretStorage** — API Key e device_key criptografados nativamente (nunca em texto claro)
8. **Callback de IDE** — `timeTrace` recebe `() => currentIdeName` para evitar dependência circular

---

<a id="sec-pontos"></a>
## ✅ Pontos Fortes e Áreas de Melhoria

### Pontos Fortes
- ✅ Arquitetura robusta com Manager Pattern e DI
- ✅ TypeScript Strict em toda base
- ✅ Sincronização com retry inteligente e config dinâmica
- ✅ Detecção automática de IDE com 3 camadas de fallback
- ✅ Dashboard moderno com grid responsivo
- ✅ Backup automático com validação de integridade e política de retenção
- ✅ 35 documentos técnicos
- ✅ 139 testes automatizados (Mocha + Sinon)
- ✅ i18n PT-BR + EN integrado

### Áreas de Melhoria
1. **Cobertura UI** — Sem testes para statsPanel/deletedProjectsPanel (1.474 + 941 LOC)
2. **Aninhamento em database.ts** — Callbacks de migração muito profundos (pyramid of doom)
3. **Escalabilidade SQLite** — Limitado a ~100k entries sem índices adicionais
4. **Error Handling** — Sem captura global de erros em webviews
5. **Documentação API** — Sem OpenAPI/Swagger

---

<a id="sec-regras"></a>
## 🔐 Regras de Desenvolvimento (GEMINI.md)

1. **Toda SQL em DatabaseManager** — Regra crítica
2. **Dependency Injection obrigatória** — Sem singletons globais
3. **Manager Pattern consistente** — Nova responsabilidade = novo Manager
4. **Tests para features novas** — Cobertura mínima 80%
5. **i18n para UI** — Use `localize()`, nunca strings hardcoded
6. **Sem circular dependencies** — Verificar com `npm ls`
7. **Logs estruturados** — Usar emojis (✅, ⚠️, 🔴, 🔄)
8. **TypeScript Strict** — Sem `any`, sem `//ts-ignore`

---

<a id="sec-historico"></a>
## 📝 Histórico de Versões

- **v0.6.1** (23 Mai 2026) — Backup automático com wizard + agendamento + retenção; hardening de path validation; `ide_version` no payload de push; publicação em Open VSX
- **v0.5.5** (20 Mai 2026) — Detecção automática de IDE, status bar de IDE, `ide_name` no DB e sync
- **v0.5.4** (26 Abr 2026) — URL de produção da API via `.env`
- **v0.5.3** — Device registration, multi-device sync
- **v0.5.2** — Soft delete system, TTL 30 dias
- **v0.5.1** — Modern dashboard, donut chart
- **v0.5.0** — Initial release, basic tracking

---

**Documento Atualizado:** 26 de maio de 2026
**Compatibilidade:** VS Code 1.100.0+
**Licença:** MIT
**Contato:** belloinfo@gmail.com
