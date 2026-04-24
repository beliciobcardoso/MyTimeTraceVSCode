# 📚 MyTimeTrace VSCode - Codebase Completo

**Versão:** 0.5.3
**Status:** Beta - Produção
**Última Atualização:** 23 de novembro de 2025
**Linguagem:** TypeScript + SQLite

---

## 📋 Índice

1. [Visão Geral do Projeto](#-visão-geral-do-projeto)
2. [Arquitetura e Estrutura](#-arquitetura-e-estrutura)
3. [Módulos Principais](#-módulos-principais)
4. [Sistema de Sincronização em Nuvem](#-sistema-de-sincronização-em-nuvem)
5. [Sistema de Interface (UI)](#-sistema-de-interface-ui)
6. [Gerenciamento de Dados](#-gerenciamento-de-dados)
7. [Comandos e Configurações](#-comandos-e-configurações)
8. [Testes e Qualidade](#-testes-e-qualidade)
9. [Padrões e Convenções](#-padrões-e-convenções)
10. [Roadmap](#-roadmap-e-próximos-passos)

---

## 🎯 Visão Geral do Projeto

**MyTimeTrace VSCode** é uma extensão para Visual Studio Code que monitora automaticamente o tempo gasto em arquivos e projetos, com **sincronização bidirecional em nuvem** e dashboard unificado para análise.

### Características Principais

- ✅ **Rastreamento Automático** — Monitoramento inteligente por arquivo e projeto
- ✅ **Sincronização em Nuvem** — Push/Pull bidirecional com backend via API Key
- ✅ **Loop Automático de Sync** — Processa TODAS entries pendentes em um único comando
- ✅ **Configurações Dinâmicas** — Servidor controla `syncTimes`, `batchLimit`, `maxRetries`, `retryDelayMs`
- ✅ **Multi-Dispositivo** — Identificação única via `device_key` (UUID v4) + `device_name` (hostname)
- ✅ **Dashboard Moderno** — Layout grid 40/60, donut interativo, filtros por data e projeto
- ✅ **Soft Delete** — Exclusão reversível com auto-limpeza após 30 dias
- ✅ **Histórico de Auditoria** — Rastreamento completo de soft/hard deletes e restaurações
- ✅ **Arquitetura Manager Pattern** — Separação clara de responsabilidades
- ✅ **88% Cobertura de Testes** — Suítes dedicadas para cada Manager de sync

### Tecnologias Core

```json
{
  "engine": "vscode ^1.100.0",
  "linguagem": "TypeScript 5.8.3",
  "database": "SQLite3 5.1.6",
  "uuid": "uuid 10.0.0",
  "i18n": "vscode-nls 5.2.0 (PT-BR + EN)",
  "testes": "Mocha + Sinon (@vscode/test-cli)",
  "packageManager": "pnpm 10.19.0"
}
```

---

## 🏗️ Arquitetura e Estrutura

### Estrutura de Diretórios

```
MyTimeTraceVSCode/
├── 📁 src/                           # Código fonte principal
│   ├── extension.ts                  # 🚪 Ponto de entrada (activate/deactivate)
│   ├── 📁 modules/                   # 🧩 Módulos especializados
│   │   ├── index.ts                 # 📦 Barrel exports
│   │   ├── database.ts              # 💾 DatabaseManager (SQLite)
│   │   ├── timeTrace.ts             # ⏱️ Engine de rastreamento
│   │   ├── statusBar.ts             # 📊 StatusBarManager
│   │   ├── stats.ts                 # 📈 StatsManager
│   │   ├── commands.ts              # ⌨️ CommandManager
│   │   ├── config.ts                # ⚙️ getConfig / UserConfig
│   │   ├── deviceInfo.ts            # 🖥️ getDeviceName / getDeviceInfo
│   │   ├── apiKeyManager.ts         # 🔐 API Key via SecretStorage
│   │   ├── deviceManager.ts         # 💻 device_key (UUID v4)
│   │   ├── syncManager.ts           # 🔄 Push/Pull orchestrator
│   │   └── syncRetryManager.ts      # 🔁 Retry com config dinâmica
│   ├── 📁 ui/                        # 🎨 Componentes de interface
│   │   ├── index.ts                 # 📦 Barrel exports
│   │   ├── statsPanel.ts            # 📊 Dashboard moderno
│   │   ├── deletedProjectsPanel.ts  # 🗑️ Painel de projetos deletados
│   │   ├── cssLoader.ts             # 🎨 Loader de CSS
│   │   └── dashboard-styles.css     # 🎨 Estilos dashboard
│   ├── 📁 config/                    # 🌐 Constantes globais
│   │   └── constants.ts             # API_BASE_URL, SYNC_BATCH_LIMIT, etc.
│   └── 📁 test/                      # 🧪 Testes automatizados
│       ├── extension.test.ts        # ✅ Suíte principal
│       ├── apiKeyManager.test.ts    # 🔐 ApiKeyManager
│       ├── deviceManager.test.ts    # 💻 DeviceManager
│       ├── syncRetryManager.test.ts # 🔁 Retry logic
│       ├── syncCommands.test.ts     # ⌨️ Comandos de sync
│       └── sync-loop.test.ts        # 🔄 Loop automático
├── 📁 docs/                          # 📖 Documentação (30+ arquivos)
├── 📁 images/                        # Assets visuais
├── 📁 UI/                            # Demos e protótipos
├── package.json                      # Config npm (v0.5.3)
├── tsconfig.json                     # Config TypeScript
├── eslint.config.mjs                 # Config ESLint
├── CHANGELOG.md                      # Histórico de mudanças
├── README.md                         # Documentação principal
└── GEMINI.md                         # Diretrizes para IA
```

### Padrões Arquiteturais

#### 1. **Manager Pattern**
Cada responsabilidade tem seu próprio Manager:
- `DatabaseManager` — acesso SQLite (SQL apenas aqui)
- `StatusBarManager` — item da barra de status
- `StatsManager` — painéis de relatório
- `CommandManager` — registro centralizado
- `ApiKeyManager` — SecretStorage da chave
- `DeviceManager` — device_key e info do hardware
- `SyncManager` — orquestra push/pull
- `SyncRetryManager` — retry com backoff configurável

#### 2. **Dependency Injection**
Managers recebem dependências via construtor em `extension.ts`:
```typescript
const syncManager = new SyncManager(
  apiKeyManager,
  deviceManager,
  dbManager,
  statusBarManager
);
```

#### 3. **Barrel Files**
Exports centralizados em `modules/index.ts` e `ui/index.ts`.

---

## 🧩 Módulos Principais

### 1. **extension.ts** — Ponto de Entrada

**Responsabilidades:**
- Inicializar todos os Managers em ordem correta
- Registrar comandos principais + comandos de sync
- Conectar eventos do VS Code ao `timeTrace`
- Agendar cleanup automático de projetos expirados (24h)
- Orquestrar `deactivate()` com cleanup de recursos

**Fluxo resumido:**
```typescript
export async function activate(context) {
  dbManager = new DatabaseManager();
  await dbManager.initialize(context.globalStorageUri.fsPath);

  statusBarManager = new StatusBarManager();
  myTimeTrace = new timeTrace(dbManager, statusBarManager);
  statsManager = new StatsManager(dbManager, context);

  apiKeyManager = new ApiKeyManager(context);
  deviceManager = new DeviceManager(context);
  syncManager = new SyncManager(apiKeyManager, deviceManager, dbManager, statusBarManager);

  statusBarManager.create();
  CommandManager.registerCommands(...);
  CommandManager.registerSyncCommands(...);
  CommandManager.registerSyncOperationsCommands(...);

  // Eventos VS Code
  vscode.window.onDidChangeActiveTextEditor(...);
  vscode.workspace.onDidChangeTextDocument(...);
  vscode.window.onDidChangeWindowState(...);

  if (userConfig.autoStart) { /* startTracking */ }
  await syncManager.initialize();

  // Cleanup automático (24h)
  setInterval(() => dbManager.cleanupExpiredProjects(), CLEANUP_INTERVAL);
}
```

---

### 2. **timeTrace.ts** — Engine de Rastreamento

**Classe:** `timeTrace`

**Estado interno:**
```typescript
private timerInterval: NodeJS.Timeout | undefined;
private lastActiveTime: number;
private currentFile: string | undefined;
private projectRoot: string | undefined;
private timeSpentOnFile: number; // ms
private isTracking: boolean;
```

**Fluxo principal:**
- `startTracking()` — cria `setInterval` de 1s (heartbeat)
- A cada segundo: incrementa `timeSpentOnFile`, atualiza status bar
- Se `(now - lastActiveTime) > IDLE_TIMEOUT_MS` → salva entry + registra IDLE
- `onActiveEditorChange` / `onTextDocumentChange` / `onWindowStateChange` atualizam `lastActiveTime` e trocam de arquivo
- Cada salvamento captura `device_name` via `getDeviceName()`

**Detecção de Idle:**
- Timeout padrão: **5 minutos** (configurável via `myTimeTraceVSCode.idleTimeout`)
- Quando idle: salva o tempo acumulado e cria registro `file="IDLE"` com `isIdle=true`

---

### 3. **database.ts** — Gerenciamento SQLite

**Classe:** `DatabaseManager`

**Schema do Banco:**

```sql
-- Entries de rastreamento
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  project TEXT,
  file TEXT,
  duration_seconds INTEGER NOT NULL,
  is_idle INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0,           -- 0 local / 1 na cloud
  deleted_at TEXT DEFAULT NULL,       -- Soft delete
  device_name TEXT DEFAULT NULL       -- Hostname do PC
);

-- Histórico de exclusões
CREATE TABLE IF NOT EXISTS deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  records_count INTEGER NOT NULL,
  deletion_type TEXT NOT NULL,        -- 'soft' ou 'hard'
  restored_at TEXT DEFAULT NULL
);

-- Metadados de sincronização (key-value)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TEXT
);
```

**Migrações automáticas:**
- `ALTER TABLE ... ADD COLUMN deleted_at` — compatibilidade com bancos antigos
- `ALTER TABLE ... ADD COLUMN device_name` — introduzida na v0.5.2
- Erros do tipo `duplicate column name` são ignorados silenciosamente

**Métodos principais:**

```typescript
// Core
initialize(storagePath: string): Promise<void>
saveActivityData(data: ActivityData): Promise<void>
query(sql: string, params?: any[]): Promise<any[]>
isInitialized(): boolean
close(): Promise<void>

// Soft delete
softDeleteProject(projectName: string): Promise<number>
restoreProjectHistory(projectName: string): Promise<number>
hardDeleteProjectHistory(projectName: string): Promise<number>
cleanupExpiredProjects(): Promise<number>

// Histórico
logDeletion(projectName: string, type: 'soft'|'hard', count: number): Promise<void>
logRestoration(projectName: string, count: number): Promise<void>
getDeletionHistory(): Promise<DeletionHistoryEntry[]>
getDeletedProjectsWithDays(): Promise<DeletedProjectInfo[]>

// Sincronização
getUnsyncedEntries(limit?: number): Promise<TimeEntry[]>  // limite dinâmico
markAsSynced(ids: number[]): Promise<void>
insertSyncedEntry(entry: RemoteEntry): Promise<void>      // INSERT OR IGNORE
getMetadata(key: string): Promise<string | null>
setMetadata(key: string, value: string): Promise<void>
```

**Regra crítica (GEMINI.md):** *toda* consulta SQL deve viver dentro do `DatabaseManager`. Nenhum outro módulo escreve SQL cru.

---

### 4. **statusBar.ts** — StatusBarManager

**Classe:** `StatusBarManager`

**Estado:** `isSyncing: boolean` controla o ícone animado `$(sync~spin)` no status bar.

**Comportamento:**
- Texto: `${syncIcon}$(clock) ${fileName} > ${HHh MMm SSs}`
- Cor de fundo: `activeBackground` (rastreando) ou `warningBackground` (pausado)
- Comando ao clicar: `my-time-trace-vscode.showStats`
- `setSyncStatus(true/false)` é chamado pelo `SyncManager` antes/depois do `performSync`

---

### 5. **stats.ts** — StatsManager

**Classe:** `StatsManager`

**Painéis gerados:**
- `showStats()` → dashboard moderno unificado (grid 40/60 + donut + filtros)
- `showDeletedProjects()` → painel de lixeira com auto-delete 30 dias

**Handlers de mensagens (webview ↔ extension):**
- Restaurar projeto → `handleRestoreProject`
- Hard delete → `handleHardDeleteProject`
- Cleanup manual → `handleCleanupExpired`
- Refresh do painel → `refreshDeletedProjectsPanel`

---

### 6. **commands.ts** — CommandManager

Classe estática com três métodos de registro:

```typescript
CommandManager.registerCommands(startTracking, pauseTracking, showStats, showDeletedProjects)
CommandManager.registerSyncCommands(context, apiKeyManager, deviceManager, syncManager)
CommandManager.registerSyncOperationsCommands(context, apiKeyManager, deviceManager, syncManager, dbManager)
```

Inclui `safeRegisterCommand` para evitar erro "command already exists" em re-ativações (útil em testes e reloads).

---

### 7. **config.ts** — Configurações do Usuário

```typescript
export interface UserConfig {
  IDLE_TIMEOUT_MS: number;
  autoStart: boolean;
  showInStatusBar: boolean;
  syncEnabled: boolean;
}
```

Lê de `vscode.workspace.getConfiguration("myTimeTraceVSCode")`.

---

### 8. **deviceInfo.ts** — Hardware Info

Exporta funções puras:
- `getDeviceName()` → `os.hostname()`
- `getDeviceInfo()` → `{ hostname, platform, arch, type, release }`

---

## ☁️ Sistema de Sincronização em Nuvem

### Arquitetura dos Managers

```
┌─────────────────────────────────────────────────────┐
│                    extension.ts                     │
│  (injeta dependências e chama syncManager.init)     │
└──────────────────────┬──────────────────────────────┘
                       │
     ┌─────────────────┼─────────────────┬────────────┐
     ▼                 ▼                 ▼            ▼
┌──────────┐   ┌──────────────┐   ┌────────────┐  ┌──────────┐
│  ApiKey  │   │   Device     │   │   Sync     │  │   Retry  │
│ Manager  │   │   Manager    │   │  Manager   │◄─│ Manager  │
└────┬─────┘   └──────┬───────┘   └──────┬─────┘  └──────────┘
     │                │                  │
     │ SecretStorage  │ SecretStorage    │ fetch(API_BASE_URL)
     │ (mtt_xxx…)     │ (UUID v4)        │
     ▼                ▼                  ▼
  API Key          device_key      POST /sync/push
  (32 chars        (UUID único     GET  /sync/pull
   + prefixo        por PC)        GET  /sync/config
   mtt_)                           GET  /sync/status
                                   POST /sync/register
```

### 1. **ApiKeyManager**

Armazena API Key no `vscode.context.secrets` (criptografado pelo SO: Keychain, Credential Manager, libsecret).

**Formato validado:** regex `/^mtt_[a-z0-9]{32}$/i`

**Métodos:** `setApiKey`, `getApiKey`, `revokeApiKey`, `hasApiKey`, `getMaskedApiKey`, `testConnection`.

### 2. **DeviceManager**

Gera UUID v4 único por instalação e o armazena no SecretStorage. Também registra hardware no backend via `POST /sync/register`.

**Métodos:** `getOrCreateDeviceKey`, `revokeDeviceKey`, `hasDeviceKey`, `getDeviceInfo`, `getDeviceName`, `registerDevice`, `getSyncStatus`.

### 3. **SyncManager**

Orquestra toda a sincronização bidirecional:

**Ciclo `performSync()`:**
1. Verifica se já existe sync em andamento (`isSyncing` guard)
2. Ativa ícone `$(sync~spin)` na status bar
3. **Loop:** enquanto `result.syncedCount > 0`:
   - `pushEntries(apiKey)` — envia batch via `POST /sync/push`
   - `pullEntries(apiKey)` — recebe batch via `GET /sync/pull?since=...`
   - `retryManager.execute(...)` encapsula as chamadas
4. Marca TODAS entries enviadas como `synced=1` (inclusive conflitos — já estão na cloud)
5. Atualiza `sync_metadata.last_pull_timestamp` com `syncedAt` do servidor

**Config dinâmica (`GET /sync/config`):**
- `syncTimes: string[]` → horários de auto-sync (ex: `["08:00", "17:00"]`)
- `batchLimit: number` → entries por request
- `maxRetries: number` → passado ao `SyncRetryManager`
- `retryDelayMs: number` → delay entre tentativas

Config é persistida em `sync_metadata` para uso offline (fallback: `constants.ts`).

**Auto-sync:** `setInterval` de 60s compara `HH:MM` atual com `syncTimes`.

### 4. **SyncRetryManager**

Wrapper genérico de retry:
```typescript
await retryManager.execute(async () => {
  const r = await syncManager.pushEntries(...);
  await syncManager.pullEntries(...);
  return r;
});
```

- `maxRetries` clamp `[1, 10]`, `retryDelayMs` clamp `[1000, 60000]`
- Após falha total: `vscode.window.showWarningMessage` com ações "Tentar Novamente" e "Ver Detalhes"

### Constantes (`src/config/constants.ts`)

```typescript
API_BASE_URL = 'http://localhost:8989';   // Desenvolvimento
REQUEST_TIMEOUT = 30000;                   // 30s
SYNC_BATCH_LIMIT = 200;                    // Entries por batch
SYNC_DEFAULT_TIMES = ['08:00', '17:00'];   // Auto-sync padrão
SECRET_KEYS = {
  API_KEY: 'mytimetrace.apiKey',
  DEVICE_KEY: 'mytimetrace.deviceKey'
};
CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;    // 24h
CLEANUP_INITIAL_DELAY = 5 * 60 * 1000;     // 5min
```

---

## 🎨 Sistema de Interface (UI)

### 1. **statsPanel.ts** — Dashboard Moderno

- Layout **grid 40/60** responsivo
- **Gráfico donut** (Canvas HTML5) com tooltips e atualização dinâmica
- **Filtros:** data inicial/final + seleção múltipla de projetos
- **Tabela expansível** com ordenação por nome, tempo ou nº de arquivos
- **Cards** de estatísticas (Total, Hoje, Arquivos, Esta Semana)
- **Paleta de 50 cores** — `getProjectColor()` garante cor estável por projeto independente de filtros
- Tema integrado com variáveis CSS do VS Code

### 2. **deletedProjectsPanel.ts** — Lixeira

Sistema de cores por urgência:

| Dias restantes | Badge          | Cor     | Animação |
|----------------|---------------|---------|----------|
| 15–30          | ✅ RECUPERÁVEL | Verde   | —        |
| 8–14           | ⚠️ EXPIRANDO  | Amarelo | —        |
| 1–7            | 🚨 CRÍTICO    | Vermelho | Pulse 2s |
| ≤ 0            | ❌ EXPIRADO   | Cinza   | Opacidade 60% |

Refresh automático a cada 60s. Ações por card: **Restaurar**, **Deletar permanentemente**.

### 3. **cssLoader.ts** + **dashboard-styles.css**

Loader de CSS usado pelos painéis — copiado para `out/ui/` pelo script `copy-assets`.

---

## 💾 Gerenciamento de Dados

### Fluxo de Soft Delete

```
1. Usuário deleta projeto → softDeleteProject()
2. time_entries.deleted_at = datetime('now')
3. INSERT em deletion_history (type='soft')
4. Projeto aparece no painel de lixeira
5. 30 dias de janela de restauração
6. Após 30 dias → cleanupExpiredProjects() (24h em 24h)
   → DELETE FROM time_entries WHERE project=? AND deleted_at IS NOT NULL
   → INSERT em deletion_history (type='hard')
```

Restauração: `UPDATE time_entries SET deleted_at = NULL` + `UPDATE deletion_history SET restored_at = datetime('now')`.

### Interação com Sync

- Entries com `deleted_at IS NOT NULL` **não** são enviadas em `getUnsyncedEntries`
- Pull recebe entries de outros devices com `INSERT OR IGNORE` (evita duplicatas)
- `sync_metadata.last_pull_timestamp` define o ponto `since` da próxima sincronização

---

## ⌨️ Comandos e Configurações

### Comandos Principais

| Comando | Título | Ícone |
|---------|--------|-------|
| `my-time-trace-vscode.startTracking` | Iniciar Rastreamento | `$(play)` |
| `my-time-trace-vscode.pauseTracking` | Pausar Rastreamento | `$(debug-pause)` |
| `my-time-trace-vscode.showStats` | Exibir Estatísticas | `$(graph)` |
| `my-time-trace-vscode.showDeletedProjects` | Projetos Deletados | `$(trash)` |

### Comandos de Sincronização

| Comando | Título | Ícone |
|---------|--------|-------|
| `my-time-trace-vscode.setApiKey` | Configurar API Key | `$(key)` |
| `my-time-trace-vscode.viewApiKey` | Ver API Key (mascarada) | `$(eye)` |
| `my-time-trace-vscode.revokeApiKey` | Revogar API Key | `$(trash)` |
| `my-time-trace-vscode.syncNow` | Sincronizar Agora | `$(sync)` |
| `my-time-trace-vscode.viewSyncStatus` | Status de Sincronização | `$(dashboard)` |

### Configurações (settings.json)

```json
{
  "myTimeTraceVSCode.idleTimeout": 5,           // min (padrão 5)
  "myTimeTraceVSCode.autoStart": true,
  "myTimeTraceVSCode.showInStatusBar": true,
  "myTimeTraceVSCode.syncEnabled": true,        // precisa de API Key
  "myTimeTraceVSCode.syncInterval": 60          // min, 5-1440
}
```

---

## 🧪 Testes e Qualidade

### Suítes de Teste

| Arquivo | Foco |
|---------|------|
| `extension.test.ts` | Ativação, tracking, idle, status bar, stats, integração |
| `apiKeyManager.test.ts` | Validação de formato, SecretStorage, testConnection |
| `deviceManager.test.ts` | UUID, registro no backend, status |
| `syncRetryManager.test.ts` | Retry logic, clamp de config, notificação de falha |
| `syncCommands.test.ts` | Comandos `syncNow`, `viewSyncStatus`, integração status bar |
| `sync-loop.test.ts` | Loop automático processando todas entries pendentes |

**Cobertura declarada:** **88%** (módulos de sync com foco dedicado).

### Execução

```bash
npm test               # compila + lint + executa vscode-test
npm run compile        # tsc -p ./ && copy-assets
npm run watch          # tsc -watch
npm run lint           # eslint src
npm run package        # vsce package → .vsix
```

---

## 📏 Padrões e Convenções

### TypeScript

- **Tipagem estrita** em todas as interfaces (`UserConfig`, `ActivityData`, etc.)
- **async/await** em vez de callbacks onde possível (exceção: SQLite API interna)
- **Named exports** — nenhum `export default`
- **Barrel files** centralizam re-exports

### Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Classes | PascalCase | `DatabaseManager`, `SyncManager` |
| Métodos/variáveis | camelCase | `startTracking`, `lastActiveTime` |
| Constantes globais | UPPER_SNAKE_CASE | `SYNC_BATCH_LIMIT` |
| Arquivos TS | camelCase | `apiKeyManager.ts` |
| Arquivos CSS | kebab-case | `dashboard-styles.css` |

### Logs Estruturados

Prefixos emoji para categorização rápida em Output:
- `🚀` start, `✅` ok, `⚠️` warning, `❌` error, `🔄` sync, `📊` stats, `🧹` cleanup, `🔐` secret, `💻` device, `📤` push, `📥` pull

### Error Handling

Try/catch em operações async que tocam I/O (DB, HTTP). Notificações do usuário via `vscode.window.showWarningMessage` apenas no nível de orquestração (SyncRetryManager, extension.ts).

### Regras Importantes

- **SQL apenas em `DatabaseManager`** (GEMINI.md §2)
- **Nunca usar `confirm()`/`alert()`/`prompt()`** em webviews — sandbox do VS Code bloqueia. Criar modais customizados em HTML ou usar `vscode.window.showInformationMessage` no backend.
- **i18n obrigatório** para strings visíveis ao usuário via `vscode-nls` + `package.nls.json` / `package.nls.pt-br.json`.

### Design System

Variáveis CSS do VS Code para garantir aderência aos temas:
```css
var(--vscode-editor-background)
var(--vscode-editor-foreground)
var(--vscode-button-background)
var(--vscode-panel-border)
var(--vscode-focusBorder)
```

---

## 🔮 Roadmap e Próximos Passos

### ✅ Concluído (v0.5.2)
- Sincronização bidirecional com backend
- Loop automático processando todas entries pendentes
- Config dinâmica via `/sync/config`
- Persistência local de config (modo offline)
- Retry configurável com clamp
- Comandos: setApiKey, viewApiKey, revokeApiKey, syncNow, viewSyncStatus
- Indicador visual `$(sync~spin)` no status bar
- Auto-sync em horários configurados (padrão 08:00 e 17:00)

### 🚧 Planejado

- **Exportação de dados** — CSV / JSON / Excel
- **Relatórios personalizados** por período e projeto
- **Integração Git** — correlacionar tempo com commits/branches
- **Backup automático** do banco SQLite
- **Dashboard web** — consumir dados sincronizados na plataforma

---

## 📚 Documentação Relacionada

Consulte [`docs/`](./docs/) para detalhamento:

- **Sync:** `BACKEND_SYNC_SPEC.md`, `BACKEND_SYNC_VALIDATION.md`, `PLANO_SYNC_VSCODE.md`, `VSCODE_SYNC_IMPLEMENTATION.md`, `AUTO_LOOP_SYNC.md`, `ENDPOINTS_API.md`
- **Dashboard:** `DASHBOARD_MODERNO.md`, `UI_COMPONENTS.md`, `VSCODE_COLORS_REFERENCE.md`
- **Soft Delete:** `SOFT_DELETE.md`, `DELETION_HISTORY.md`, `DELETED_PROJECTS_PANEL.md`, `AUTO_DELETE_SYSTEM.md`, `UNDO_GUIDE.md`
- **Qualidade:** `COVERAGE_REPORT.md`, `CSS_SEPARATION_REPORT.md`

### Links

- Repositório: https://github.com/beliciobcardoso/MyTimeTraceVSCode
- Issues: https://github.com/beliciobcardoso/MyTimeTraceVSCode/issues

---

## 🎓 Como Começar

### Desenvolvedor

```bash
git clone https://github.com/beliciobcardoso/MyTimeTraceVSCode.git
cd MyTimeTraceVSCode
pnpm install          # ou npm install
npm run compile
npm test
code .
# F5 para debug em nova janela do VS Code
```

### Usuário

1. Instale o `.vsix` gerado via `npm run package`
2. (Opcional) Configure a API Key via `MyTimeTrace: Set API Key`
3. Monitoramento inicia automaticamente (`autoStart=true`)
4. Veja estatísticas com `MyTimeTrace: Show Statistics`

---

**🎉 v0.5.2 — Sincronização em Nuvem pronta para produção!**

*Documentação alinhada ao código em 23 de novembro de 2025.*
