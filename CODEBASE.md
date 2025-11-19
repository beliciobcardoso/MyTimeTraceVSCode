# 📚 MyTimeTrace VSCode - Codebase Completo

**Versão:** 0.3.1  
**Status:** Beta - Produção  
**Última Atualização:** 17 de novembro de 2025  
**Linguagem:** TypeScript + SQLite

---

## 📋 Índice

1. [Visão Geral do Projeto](#-visão-geral-do-projeto)
2. [Arquitetura e Estrutura](#-arquitetura-e-estrutura)
3. [Módulos Principais](#-módulos-principais)
4. [Sistema de Interface (UI)](#-sistema-de-interface-ui)
5. [Funcionalidades Core](#-funcionalidades-core)
6. [Sistema Pomodoro](#-sistema-pomodoro)
7. [Gerenciamento de Dados](#-gerenciamento-de-dados)
8. [Comandos e Configurações](#-comandos-e-configurações)
9. [Testes e Qualidade](#-testes-e-qualidade)
10. [Padrões e Convenções](#-padrões-e-convenções)

---

## 🎯 Visão Geral do Projeto

**MyTimeTrace VSCode** é uma extensão profissional para Visual Studio Code que implementa um sistema avançado de rastreamento de tempo de desenvolvimento com funcionalidades de produtividade Pomodoro integradas.

### Características Principais

- ✅ **Rastreamento Automático** - Monitoramento inteligente de tempo por arquivo e projeto
- ✅ **Sistema Pomodoro** - Técnica Pomodoro integrada com alertas e configurações
- ✅ **Dashboard Moderno** - Interface responsiva com filtros avançados e gráficos interativos
- ✅ **Soft Delete** - Exclusão reversível de projetos com auto-limpeza após 30 dias
- ✅ **Histórico de Auditoria** - Rastreamento completo de todas as operações
- ✅ **88% Cobertura de Testes** - 23 testes automatizados passando
- ✅ **Arquitetura Modular** - 7 módulos especializados com padrão Singleton

### Tecnologias Core

```json
{
  "engine": "vscode ^1.100.0",
  "linguagem": "TypeScript 5.8.3",
  "database": "SQLite3 5.1.6",
  "testes": "Mocha + Sinon",
  "i18n": "vscode-nls (PT-BR + EN)"
}
```

---

## 🏗️ Arquitetura e Estrutura

### Estrutura de Diretórios

```
MyTimeTraceVSCode/
├── 📁 src/                           # Código fonte principal
│   ├── extension.ts                  # 🚪 Ponto de entrada
│   ├── 📁 modules/                   # 🧩 Módulos especializados
│   │   ├── timeTrace.ts             # ⏱️ Engine de rastreamento
│   │   ├── database.ts              # 💾 Gerenciamento SQLite
│   │   ├── statusBar.ts             # 📊 Interface barra de status
│   │   ├── stats.ts                 # 📈 Geração de relatórios
│   │   ├── commands.ts              # ⌨️ Registro de comandos
│   │   ├── config.ts                # ⚙️ Configurações
│   │   ├── deviceInfo.ts            # 🖥️ Informações do dispositivo
│   │   ├── modal.ts                 # 🔲 Sistema de modais
│   │   ├── pomodoro.ts              # 🍅 Sistema Pomodoro
│   │   ├── desktopNotifications.ts  # 🔔 Notificações desktop
│   │   ├── soundManager.ts          # 🔊 Gerenciador de áudio
│   │   ├── visualEffectsManager.ts  # 🎨 Efeitos visuais
│   │   ├── audioFilePlayer.ts       # 🎵 Player de arquivos WAV
│   │   ├── webAudioPlayer.ts        # 🌐 Web Audio API
│   │   ├── simpleSoundPlayer.ts     # 🔔 Beeps do sistema
│   │   ├── syntheticSoundGenerator.ts # 🎹 Sons sintéticos
│   │   └── index.ts                 # 📦 Barrel exports
│   ├── 📁 ui/                        # 🎨 Componentes de interface
│   │   ├── statsPanel.ts            # 📊 Painel de estatísticas
│   │   ├── deletedProjectsPanel.ts  # 🗑️ Painel de projetos deletados
│   │   ├── focusCompleteModal.ts    # 🍅 Modal de foco completo
│   │   ├── pomodoroSettingsModal.ts # ⚙️ Configurações Pomodoro
│   │   ├── cssLoader.ts             # 🎨 Loader de CSS
│   │   ├── dashboard-styles.css     # 🎨 Estilos dashboard
│   │   ├── modal-styles.css         # 🎨 Estilos modais
│   │   └── index.ts                 # 📦 Barrel exports
│   └── 📁 test/                      # 🧪 Testes automatizados
│       ├── extension.test.ts        # ✅ Testes principais (1625 linhas)
│       ├── pomodoro.test.ts         # 🍅 Testes Pomodoro
│       ├── tarefa1.3.test.ts        # 🔔 Testes eventos Pomodoro
│       ├── focusCompleteModal.test.ts
│       ├── modal-system.test.ts
│       ├── pomodoro-events.test.ts
│       └── pomodoro-integration.test.ts
├── 📁 docs/                          # 📖 Documentação completa
│   ├── README.md                    # Índice geral
│   ├── POMODORO_CONSOLIDADO_TAREFAS.md
│   ├── DASHBOARD_MODERNO.md
│   ├── DELETED_PROJECTS_PANEL.md
│   ├── COVERAGE_REPORT.md
│   ├── UI_COMPONENTS.md
│   └── ... (19 arquivos)
├── 📁 images/                        # Assets visuais
│   └── my-time-trace-logo.png
├── 📁 sounds/                        # Arquivos de áudio
│   ├── classic/                     # Sons clássicos
│   ├── modern/                      # Sons eletrônicos
│   ├── minimal/                     # Tons simples
│   └── natural/                     # Harmônicos naturais
├── 📁 UI/                            # Demos e protótipos
├── 📁 test-temp/                     # Testes temporários
├── 📁 vsix/                          # Pacotes gerados
├── package.json                      # Configuração npm
├── tsconfig.json                     # Configuração TypeScript
├── eslint.config.mjs                 # Configuração ESLint
├── CHANGELOG.md                      # Histórico de mudanças
└── README.md                         # Documentação principal
```

### Padrões Arquiteturais

#### 1. **Singleton Pattern**
Gerenciamento global de estado e recursos:
```typescript
export class DatabaseManager {
  private static instance: DatabaseManager;
  
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }
}
```

#### 2. **Module Pattern**
Separação clara de responsabilidades:
- **timeTrace** - Lógica de rastreamento
- **database** - Persistência de dados
- **statusBar** - Interface visual
- **stats** - Geração de relatórios
- **commands** - Registro de comandos
- **config** - Gerenciamento de configurações
- **modal** - Sistema de modais

#### 3. **Observer Pattern**
Sistema de eventos para comunicação entre módulos:
```typescript
interface PomodoroEvents {
  onFocusStart?: (duration: number) => void;
  onFocusComplete?: () => void;
  onBreakStart?: (duration: number, type: 'short' | 'long') => void;
  onBreakComplete?: () => void;
}
```

---

## 🧩 Módulos Principais

### 1. **extension.ts** - Ponto de Entrada

**Responsabilidades:**
- Inicialização da extensão (`activate()`)
- Registro de comandos e eventos
- Coordenação entre módulos
- Cleanup de recursos (`deactivate()`)

**Estrutura:**
```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Inicialização de módulos
  const dbManager = new DatabaseManager();
  const statusBarManager = new StatusBarManager();
  const statsManager = new StatsManager(dbManager);
  const myTimeTrace = new timeTrace(dbManager, statusBarManager);
  const pomodoroManager = new PomodoroManager(dbManager, statusBarManager);
  
  // 2. Inicialização assíncrona
  await dbManager.initialize(context);
  
  // 3. Registro de comandos (33 comandos)
  const commands = CommandManager.registerCommands(...);
  
  // 4. Configuração de eventos do Pomodoro
  pomodoroManager.setEvents({...});
  
  // 5. Auto-start se configurado
  if (config.autoStart) {
    myTimeTrace.startTracking();
  }
}
```

**Comandos Registrados:** 33 comandos (4 principais + 29 de desenvolvimento)

---

### 2. **timeTrace.ts** - Engine de Rastreamento

**Classe:** `timeTrace`  
**Padrão:** Singleton  
**Cobertura:** 95%

**Funcionalidades Core:**
```typescript
export class timeTrace {
  // Estado
  private currentFile: string | null;
  private isTracking: boolean;
  private idleTimer: NodeJS.Timeout | null;
  
  // Métodos principais
  startTracking(): void
  pauseTracking(): void
  onActiveEditorChange(editor: vscode.TextEditor | undefined): void
  onTextDocumentChange(event: vscode.TextDocumentChangeEvent): void
  onWindowStateChange(state: vscode.WindowState): void
  
  // Métodos auxiliares
  isActivelyCoding(): boolean
  getCurrentFile(): string | null
  getCurrentProject(): string | null
  isCurrentlyTracking(): boolean
}
```

**Detecção de Idle Time:**
- **Timeout padrão:** 5 minutos (configurável)
- **Eventos monitorados:** Mudança de editor, alteração de texto, foco de janela
- **Reinício automático:** Após atividade detectada

**Integração com Pomodoro:**
- Verifica se usuário está codificando ativamente
- Detecta extensões de arquivo de código (25+ tipos)
- Fornece contexto de projeto/arquivo para sessões

---

### 3. **database.ts** - Gerenciamento SQLite

**Classe:** `DatabaseManager`  
**Padrão:** Singleton  
**Cobertura:** 95%

**Schema do Banco:**

```sql
-- Tabela principal de rastreamento
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  project TEXT NOT NULL,
  file TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  is_idle INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0,
  deleted_at TEXT,
  device_name TEXT DEFAULT NULL, -- Nome do dispositivo/computador
  UNIQUE(timestamp, project, file)
);

-- Tabela de configurações Pomodoro
CREATE TABLE IF NOT EXISTS pomodoro_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focusDuration INTEGER DEFAULT 45,
  shortBreakDuration INTEGER DEFAULT 15,
  longBreakDuration INTEGER DEFAULT 30,
  sessionsUntilLongBreak INTEGER DEFAULT 4,
  autoStartBreaks INTEGER DEFAULT 1,
  autoStartFocus INTEGER DEFAULT 0,
  enableSoundAlerts INTEGER DEFAULT 1,
  enableDesktopNotifications INTEGER DEFAULT 1,
  enableStatusBarTimer INTEGER DEFAULT 1,
  dailyGoalSessions INTEGER DEFAULT 8,
  updated_at TEXT NOT NULL
);

-- Tabela de sessões Pomodoro
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startTime TEXT NOT NULL,
  endTime TEXT,
  type TEXT NOT NULL,
  duration INTEGER NOT NULL,
  actualDuration INTEGER,
  wasCompleted INTEGER DEFAULT 0,
  wasInterrupted INTEGER DEFAULT 0,
  interruptionReason TEXT,
  project TEXT,
  file TEXT
);

-- Tabela de histórico de exclusões
CREATE TABLE IF NOT EXISTS deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deletion_type TEXT NOT NULL,
  records_count INTEGER NOT NULL,
  deleted_at TEXT NOT NULL,
  restored_at TEXT
);
```

**Métodos Principais:**

```typescript
class DatabaseManager {
  // Inicialização
  async initialize(context: vscode.ExtensionContext): Promise<void>
  
  // Operações CRUD
  async saveActivityData(data: ActivityData): Promise<void>
  async query(sql: string, params?: any[]): Promise<any[]>
  
  // Soft Delete
  async softDeleteProject(projectName: string): Promise<number>
  async restoreProjectHistory(projectName: string): Promise<number>
  async hardDeleteProjectHistory(projectName: string): Promise<number>
  
  // Histórico
  async logDeletion(projectName: string, type: 'soft' | 'hard', count: number): Promise<void>
  async getDeletionHistory(): Promise<DeletionHistoryEntry[]>
  
  // Projetos Deletados
  async getDeletedProjectsWithDays(): Promise<DeletedProjectInfo[]>
  async cleanupExpiredProjects(): Promise<number>
  
  // Pomodoro
  async savePomodoroConfig(config: PomodoroConfig): Promise<void>
  async getPomodoroConfig(): Promise<PomodoroConfig | null>
  async savePomodoroSession(session: PomodoroSession): Promise<void>
  async getPomodoroSessions(filters?: SessionFilters): Promise<PomodoroSession[]>
}
```

**Auto-Delete de Projetos:**
- **Prazo:** 30 dias após soft delete
- **Processo:** `cleanupExpiredProjects()` remove permanentemente
- **Auditoria:** Registra em `deletion_history` antes de deletar

---

### 4. **statusBar.ts** - Interface de Status

**Classe:** `StatusBarManager`  
**Padrão:** Singleton  
**Cobertura:** 95%

**Funcionalidades:**
```typescript
class StatusBarManager {
  // Criação e atualização
  create(): void
  update(timeInSeconds: number, file: string): void
  formatTime(timeInSeconds: number): string
  
  // Efeitos visuais
  applyVisualEffect(state: VisualState): void
  
  // Limpeza
  dispose(): void
}
```

**Formatação de Tempo:**
```typescript
formatTime(3665) // "1h 1m 5s"
formatTime(65)   // "1m 5s"
formatTime(5)    // "5s"
```

**Estados Visuais:**
- IDLE (neutro)
- FOCUS_ACTIVE (azul pulsante)
- FOCUS_ENDING (amarelo alerta)
- BREAK_ACTIVE (verde)
- PAUSED (roxo)
- NOTIFICATION (ciano)

---

### 5. **stats.ts** - Geração de Relatórios

**Classe:** `StatsManager`  
**Padrão:** Singleton  
**Cobertura:** 95%

**Métodos Principais:**
```typescript
class StatsManager {
  // Painéis
  async showStats(): Promise<void>
  async showSimpleStats(): Promise<void>
  async showStatsWithFilters(): Promise<void>
  async showDeletedProjects(): Promise<void>
  
  // Gerenciamento de projetos deletados
  private async handleRestoreProject(projectName: string, panel: vscode.WebviewPanel): Promise<void>
  private async handleHardDeleteProject(projectName: string, panel: vscode.WebviewPanel): Promise<void>
  private async handleCleanupExpired(panel: vscode.WebviewPanel): Promise<void>
  private async refreshDeletedProjectsPanel(panel: vscode.WebviewPanel): Promise<void>
}
```

**Tipos de Painéis:**
1. **Simple Stats** - Estatísticas básicas sem filtros
2. **Stats with Filters** - Dashboard moderno com filtros avançados
3. **Deleted Projects** - Painel de projetos deletados com auto-delete

---

### 6. **commands.ts** - Registro de Comandos

**Classe:** `CommandManager`  
**Padrão:** Static Class  
**Cobertura:** 90%

**Métodos:**
```typescript
class CommandManager {
  // Registro seguro (previne duplicação)
  static safeRegisterCommand(commandId: string, handler: Function): vscode.Disposable
  
  // Registro em lote
  static registerCommands(
    startTracking: () => void,
    pauseTracking: () => void,
    showStats: () => void,
    showDeletedProjects: () => void
  ): vscode.Disposable[]
}
```

**Comandos Principais:**
- `my-time-trace-vscode.startTracking` - Inicia rastreamento
- `my-time-trace-vscode.pauseTracking` - Pausa rastreamento
- `my-time-trace-vscode.showStats` - Exibe estatísticas
- `my-time-trace-vscode.showDeletedProjects` - Painel de deletados

---

### 7. **modal.ts** - Sistema de Modais

**Classe:** `ModalManager`  
**Padrão:** Singleton  
**Cobertura:** 80%

**Funcionalidades:**
```typescript
class ModalManager {
  // Gerenciamento de modais
  async showModal(config: ModalConfig): Promise<void>
  async closeModal(id: string): Promise<void>
  async closeAllModals(): Promise<void>
  
  // Comunicação
  async sendMessageToModal(id: string, message: any): Promise<boolean>
  async updateModalContent(id: string, content: string): Promise<boolean>
  
  // Estado
  isModalActive(id: string): boolean
}
```

**Interface ModalConfig:**
```typescript
interface ModalConfig {
  id: string;
  title: string;
  content?: string;
  customContent?: string;
  buttons?: ModalButton[];
  size?: 'small' | 'medium' | 'large';
  width?: string;
  height?: string;
}
```

---

## 🎨 Sistema de Interface (UI)

### 1. **statsPanel.ts** - Painel de Estatísticas

**Funcionalidades:**
- ✅ **Dashboard Moderno** - Layout grid 40/60 responsivo
- ✅ **Gráficos Donut** - Canvas HTML5 com cores dinâmicas
- ✅ **Filtros Avançados** - Data inicial/final + seleção múltipla de projetos
- ✅ **Projetos Expansíveis** - Interface colapsável para organização
- ✅ **Temas VS Code** - Integração completa com variáveis CSS

**Métodos Principais:**
```typescript
class StatsPanel {
  // Geração de painéis
  static createStatsPanel(projectsData: ProjectsData): vscode.WebviewPanel
  static createStatsWithFiltersPanel(rawData: TimeEntry[], availableProjects: string[]): vscode.WebviewPanel
  
  // Filtragem de dados
  static filterData(data: TimeEntry[], filters: StatsFilters): TimeEntry[]
  static convertToProjectsData(entries: TimeEntry[]): ProjectsData
  
  // Formatação
  static formatTime(timeInSeconds: number): string
  static formatFilePath(filePath: string, projectName: string): string
}
```

**Paleta de Cores (Gráfico Donut):**
```javascript
const colors = [
  '#1a7f37', // Verde
  '#4A90E2', // Azul
  '#F5A623', // Laranja
  '#7ED321', // Verde claro
  '#BD10E0', // Roxo
  '#50E3C2', // Ciano
  '#F8E71C'  // Amarelo
];
```

---

### 2. **deletedProjectsPanel.ts** - Painel de Projetos Deletados

**Funcionalidades:**
- ✅ **Visualização Intuitiva** - Cards com informações detalhadas
- ✅ **Restauração 1 Clique** - Botão "Restaurar Projeto"
- ✅ **Auto-Delete 30 Dias** - Limpeza automática
- ✅ **Alertas Visuais** - Cores por urgência (verde/amarelo/vermelho)
- ✅ **Estatísticas em Tempo Real** - Dashboard resumido
- ✅ **Refresh Automático** - Atualização a cada 60 segundos

**Sistema de Cores por Urgência:**

| Urgência | Dias Restantes | Badge | Cor Barra | Animação |
|----------|---------------|-------|-----------|----------|
| 🟢 Normal | 15-30 | ✅ RECUPERÁVEL | Verde | - |
| 🟡 Warning | 8-14 | ⚠️ EXPIRANDO | Amarelo | - |
| 🔴 Critical | 1-7 | 🚨 CRÍTICO | Vermelho | Pulse 2s |
| ⚫ Expired | ≤0 | ❌ EXPIRADO | Cinza | Opacidade 60% |

**Estrutura do Painel:**
```
┌────────────────────────────────────────┐
│ 🗑️ Projetos Deletados [🔄] [🧹]        │
├────────────────────────────────────────┤
│ Stats: 3 Recuperáveis | 0 Expirados    │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │ MeuProjeto [✅ RECUPERÁVEL]      │   │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ (50%) │   │
│ │ 15 dias | 15 restantes          │   │
│ │ [♻️ Restaurar] [💥 Deletar]     │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

### 3. **focusCompleteModal.ts** - Modal de Foco Completo

**Funcionalidades:**
- ✅ Modal responsivo ao completar sessão de foco
- ✅ 3 botões de ação: Fazer Pausa, Continuar Foco, Configurações
- ✅ Sistema de callbacks integrado
- ✅ Animações e feedback visual
- ✅ Suporte à internacionalização

**Interface:**
```typescript
interface FocusCompleteOptions {
  focusDuration: number;
  canContinue: boolean;
  continueMinutes?: number;
}
```

---

### 4. **pomodoroSettingsModal.ts** - Configurações Pomodoro

**Funcionalidades:**
- ✅ Interface completa com 764 linhas
- ✅ 4 presets predefinidos (Clássico, Foco Profundo, Sprint, Personalizado)
- ✅ Controles avançados: sliders + campos numéricos
- ✅ Sistema de validação em tempo real
- ✅ Persistência automática no SQLite

**Presets:**
```typescript
const presets = {
  classic: { focus: 25, shortBreak: 5, longBreak: 15 },
  deepFocus: { focus: 45, shortBreak: 15, longBreak: 30 },
  sprint: { focus: 15, shortBreak: 3, longBreak: 10 },
  custom: { /* valores do usuário */ }
};
```

---

## 🍅 Sistema Pomodoro

### Arquitetura Completa

**Status:** 85% Implementado  
**Última Atualização:** 25 de julho de 2025

### 1. **pomodoro.ts** - Core Manager

**Classe:** `PomodoroManager`  
**Padrão:** Singleton  
**Cobertura:** 97%

**Estados do Sistema (6 estados):**
```typescript
enum PomodoroState {
  INACTIVE = 'inactive',
  FOCUS = 'focus',
  FOCUS_PAUSED = 'focus_paused',
  SHORT_BREAK = 'short_break',
  LONG_BREAK = 'long_break',
  BREAK_EXTENDED = 'break_extended'
}
```

**Métodos Principais:**
```typescript
class PomodoroManager {
  // Configuração
  async initialize(): Promise<void>
  async loadConfig(): Promise<void>
  async updateConfig(config: Partial<PomodoroConfig>): Promise<void>
  
  // Controle de sessão
  async startFocusSession(): Promise<void>
  async startBreakSession(type: 'short' | 'long'): Promise<void>
  async pauseSession(): Promise<void>
  async resumeSession(): Promise<void>
  async stopSession(): Promise<void>
  
  // Estado
  getCurrentState(): PomodoroState
  getRemainingTime(): number
  isActive(): boolean
  
  // Eventos
  setEvents(events: PomodoroEvents): void
  
  // Cleanup
  dispose(): void
}
```

**Sistema de Eventos:**
```typescript
interface PomodoroEvents {
  onFocusStart?: (duration: number) => void;
  onFocusComplete?: () => void;
  onBreakStart?: (duration: number, type: 'short' | 'long') => void;
  onBreakComplete?: () => void;
}
```

**Auto-Start Inteligente:**
```typescript
// 4 condições necessárias:
1. autoStartFocus === true
2. Estado INACTIVE
3. Arquivo é de código (isCodeFile())
4. Usuário está codificando ativamente (timeTrace.isActivelyCoding())
```

---

### 2. **desktopNotifications.ts** - Notificações

**Classe:** `DesktopNotificationManager`  
**Padrão:** Singleton  
**Cobertura:** 80%

**Tipos de Notificação:**
```typescript
class DesktopNotificationManager {
  // Notificações do Pomodoro
  async showFocusStartNotification(duration: number): Promise<void>
  async showFocusCompleteNotification(): Promise<void>
  async showBreakStartNotification(duration: number): Promise<void>
  async showBreakCompleteNotification(): Promise<void>
  async showPomodoroCompleteNotification(): Promise<void>
}
```

**Integração Automática (em extension.ts):**
```typescript
pomodoroManager.setEvents({
  onFocusStart: async (duration) => {
    await notificationManager.showFocusStartNotification(duration);
  },
  onBreakStart: async (duration, type) => {
    await notificationManager.showBreakStartNotification(duration);
  },
  onFocusComplete: async () => {
    await notificationManager.showFocusCompleteNotification();
  },
  onBreakComplete: async () => {
    await notificationManager.showBreakCompleteNotification();
  }
});
```

---

### 3. **Sistema de Áudio**

#### **soundManager.ts** - Gerenciador Principal

```typescript
class SoundManager {
  static getInstance(): SoundManager
  async initialize(context: vscode.ExtensionContext): Promise<void>
  async playSound(type: SoundType, theme?: SoundTheme): Promise<void>
  dispose(): void
}

enum SoundType {
  FOCUS_START = 'focus_start',
  FOCUS_COMPLETE = 'focus_complete',
  BREAK_START = 'break_start',
  BREAK_COMPLETE = 'break_complete',
  NOTIFICATION = 'notification',
  WARNING = 'warning',
  SUCCESS = 'success',
  ERROR = 'error'
}

enum SoundTheme {
  CLASSIC = 'classic',
  MODERN = 'modern',
  MINIMAL = 'minimal',
  NATURAL = 'natural'
}
```

#### **Estrutura de Sons:**
```
sounds/
├── classic/           # Sons clássicos harmônicos
│   ├── focus_start.wav
│   ├── focus_complete.wav
│   ├── break_start.wav
│   ├── break_complete.wav
│   ├── notification.wav
│   ├── warning.wav
│   ├── success.wav
│   └── error.wav
├── modern/            # Sons eletrônicos
├── minimal/           # Tons simples
└── natural/           # Harmônicos naturais
```

#### **Sistema de Fallback:**
```
1. Web Audio API (osciladores reais)
2. System Beeps (beeps do SO)
3. Simulação (logs no console)
```

---

### 4. **visualEffectsManager.ts** - Efeitos Visuais

**Classe:** `VisualEffectsManager`  
**Padrão:** Singleton  
**Cobertura:** 70%

**Estados Visuais (10 estados):**
```typescript
enum VisualState {
  IDLE,
  FOCUS_ACTIVE,
  FOCUS_ENDING,
  BREAK_ACTIVE,
  BREAK_ENDING,
  PAUSED,
  NOTIFICATION,
  SUCCESS,
  WARNING,
  ERROR
}
```

**Temas Visuais (4 temas):**
```typescript
const themes = {
  productivity: {
    focus: '#4A90E2',      // Azul
    success: '#7ED321',    // Verde
    warning: '#F5A623'     // Laranja
  },
  dark: {
    focus: '#5DADE2',
    success: '#58D68D'
  },
  highContrast: {
    focus: '#00FF00',
    success: '#00FF00',
    warning: '#FFFF00',
    error: '#FF0000'
  },
  minimal: {
    focus: '#333333',
    success: '#777777'
  }
};
```

**Animações:**
- PULSE - Pulsação contínua
- FADE - Transição suave
- BLINK - Piscada rápida
- FLASH - Flash colorido temporário

---

## 💾 Gerenciamento de Dados

### Sistema de Soft Delete

**Fluxo de Exclusão Reversível:**

```
1. Usuário deleta projeto → softDeleteProject()
2. Registros marcados com deleted_at (timestamp)
3. Entrada criada em deletion_history
4. Projeto aparece no painel de deletados
5. Usuário tem 30 dias para restaurar
6. Após 30 dias → cleanupExpiredProjects() remove permanentemente
```

**Métodos:**
```typescript
// Soft Delete (reversível)
async softDeleteProject(projectName: string): Promise<number> {
  const sql = `UPDATE time_entries 
               SET deleted_at = datetime('now') 
               WHERE project = ? AND deleted_at IS NULL`;
  await this.query(sql, [projectName]);
  await this.logDeletion(projectName, 'soft', affectedRows);
  return affectedRows;
}

// Restaurar projeto
async restoreProjectHistory(projectName: string): Promise<number> {
  const sql = `UPDATE time_entries 
               SET deleted_at = NULL 
               WHERE project = ? AND deleted_at IS NOT NULL`;
  await this.query(sql, [projectName]);
  await this.logRestoration(projectName, restoredRows);
  return restoredRows;
}

// Hard Delete (permanente)
async hardDeleteProjectHistory(projectName: string): Promise<number> {
  const sql = `DELETE FROM time_entries 
               WHERE project = ?`;
  await this.logDeletion(projectName, 'hard', deletedRows);
  await this.query(sql, [projectName]);
  return deletedRows;
}

// Limpeza automática (>30 dias)
async cleanupExpiredProjects(): Promise<number> {
  const expiredProjects = await this.getDeletedProjectsWithDays();
  const toDelete = expiredProjects.filter(p => p.days_since_deletion > 30);
  
  for (const project of toDelete) {
    await this.logDeletion(project.project, 'hard', project.records_count);
    await this.query(
      `DELETE FROM time_entries 
       WHERE project = ? AND deleted_at IS NOT NULL`,
      [project.project]
    );
  }
  
  return toDelete.length;
}
```

### Histórico de Auditoria

**Tabela:** `deletion_history`

**Estrutura:**
```sql
CREATE TABLE deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deletion_type TEXT NOT NULL,  -- 'soft' ou 'hard'
  records_count INTEGER NOT NULL,
  deleted_at TEXT NOT NULL,
  restored_at TEXT              -- NULL se não restaurado
);
```

**Métodos:**
```typescript
async logDeletion(
  projectName: string, 
  type: 'soft' | 'hard', 
  count: number
): Promise<void> {
  const sql = `INSERT INTO deletion_history 
               (project_name, deletion_type, records_count, deleted_at) 
               VALUES (?, ?, ?, datetime('now'))`;
  await this.query(sql, [projectName, type, count]);
}

async logRestoration(
  projectName: string, 
  count: number
): Promise<void> {
  const sql = `UPDATE deletion_history 
               SET restored_at = datetime('now') 
               WHERE project_name = ? AND restored_at IS NULL`;
  await this.query(sql, [projectName]);
}

async getDeletionHistory(): Promise<DeletionHistoryEntry[]> {
  return await this.query(
    `SELECT * FROM deletion_history ORDER BY deleted_at DESC`
  );
}
```

---

## ⌨️ Comandos e Configurações

### Comandos Principais (4)

```json
{
  "my-time-trace-vscode.startTracking": "Iniciar Rastreamento",
  "my-time-trace-vscode.pauseTracking": "Pausar Rastreamento",
  "my-time-trace-vscode.showStats": "Exibir Estatísticas",
  "my-time-trace-vscode.showDeletedProjects": "Projetos Deletados"
}
```

### Comandos Pomodoro (4)

```json
{
  "my-time-trace-vscode.startPomodoroFocus": "Iniciar Foco Pomodoro",
  "my-time-trace-vscode.pausePomodoroSession": "Pausar Sessão",
  "my-time-trace-vscode.stopPomodoroSession": "Parar Sessão",
  "my-time-trace-vscode.showPomodoroConfig": "Configurações Pomodoro"
}
```

### Comandos de Desenvolvimento (16)

```json
{
  "my-time-trace-vscode.testPomodoroIntegration": "Test Pomodoro Integration",
  "my-time-trace-vscode.testRealPomodoro": "Test Real Pomodoro",
  "my-time-trace-vscode.testPomodoroSettings": "Test Pomodoro Settings",
  "my-time-trace-vscode.testPomodoroNotifications": "Test Pomodoro Notifications",
  "my-time-trace-vscode.testPomodoroAutoNotifications": "Test Auto Notifications",
  "my-time-trace-vscode.testSoundSystem": "Test Sound System",
  "my-time-trace-vscode.testSyntheticSounds": "Test Synthetic Sounds",
  "my-time-trace-vscode.testWavSounds": "Test WAV Sounds",
  "my-time-trace-vscode.testVisualEffects": "Test Visual Effects",
  "my-time-trace-vscode.testRealAudio": "Test Real Audio",
  "my-time-trace-vscode.testSystemBeeps": "Test System Beeps",
  "my-time-trace-vscode.testDesktopNotifications": "Test Desktop Notifications",
  "my-time-trace-vscode.testModal": "Test Modal System",
  "my-time-trace-vscode.testFocusCompleteModal": "Test Focus Complete Modal",
  "my-time-trace-vscode.previewSound": "Preview Sound",
  "my-time-trace-vscode.testSpecialSounds": "Test Special Sounds"
}
```

### Configurações do Usuário

```json
{
  "myTimeTraceVSCode.idleTimeout": {
    "type": "number",
    "default": 5,
    "description": "Tempo de inatividade (minutos) antes de pausar"
  },
  "myTimeTraceVSCode.autoStart": {
    "type": "boolean",
    "default": true,
    "description": "Iniciar rastreamento automaticamente"
  },
  "myTimeTraceVSCode.showInStatusBar": {
    "type": "boolean",
    "default": true,
    "description": "Exibir timer na barra de status"
  },
  "myTimeTrace.notifications.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Habilitar notificações desktop"
  },
  "myTimeTrace.notifications.soundEnabled": {
    "type": "boolean",
    "default": true,
    "description": "Habilitar som nas notificações"
  }
}
```

---

## 🧪 Testes e Qualidade

### Estatísticas de Testes

**Última Atualização:** 25 de julho de 2025  
**Status:** ✅ 23 testes passando, 0 falhando  
**Cobertura:** 88%

### Distribuição de Testes

```
📊 Suíte Principal (15 testes):
  1. Should activate the extension correctly
  2. Should start and pause tracking
  3. Should track time for an active file
  4. Should switch tracking to a new file
  5. Should handle idle time correctly
  6. Should show stats panel
  7. Should update status bar correctly
  8. Should update status bar in real time
  9. Should format time correctly
  10. Should handle text document changes
  11. Should handle window state changes
  12. Should detect idle time
  13. DatabaseManager - query() SQL tests
  14. StatsManager - display tests
  15. timeTrace - integration tests

🍅 Suíte Pomodoro (7 testes):
  16. Should create and retrieve Pomodoro config
  17. Should update existing config
  18. Should save and retrieve Pomodoro session
  19. Should filter sessions by type
  20. Should update existing session
  21. Should return null when no config
  22. Should return empty array when no sessions

🔔 Testes de Eventos Automáticos (5 testes):
  Arquivo: test/pomodoro-events.test.ts
  1. onFocusStart Event test
  2. onBreakStart Event test
  3. Multiple events in sequence test
  4. Integration with notifications test
  5. Error handling test

🔲 Testes de Modais (3 testes):
  Arquivo: test/modal-system.test.ts
  1. Modal creation and display
  2. Modal communication
  3. Modal cleanup

📊 Total: 30+ cenários de teste validados
```

### Cobertura por Módulo

| Módulo | Cobertura | Status |
|--------|-----------|--------|
| extension.ts | 95% | 🟢 Excelente |
| timeTrace.ts | 95% | 🟢 Excelente |
| database.ts | 95% | 🟢 Excelente |
| statusBar.ts | 95% | 🟢 Excelente |
| stats.ts | 95% | 🟢 Excelente |
| pomodoro.ts | 97% | 🟢 Excelente |
| commands.ts | 90% | 🟢 Bom |
| config.ts | 80% | 🟢 Bom |
| modal.ts | 80% | 🟢 Bom |
| desktopNotifications.ts | 80% | 🟢 Bom |
| soundManager.ts | 70% | 🟡 Indireto |
| visualEffectsManager.ts | 70% | 🟡 Indireto |
| statsPanel.ts | 60% | 🟡 Parcial |

### Execução de Testes

```bash
# Compilar e executar testes
npm test

# Compilar apenas
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint
```

---

## 📏 Padrões e Convenções

### Convenções TypeScript

**Sintaxe Moderna:**
```typescript
// ✅ Usar async/await
async function getData(): Promise<Data> {
  const result = await db.query('SELECT * FROM table');
  return result;
}

// ✅ Destructuring
const { focusDuration, shortBreakDuration } = config;

// ✅ Template literals
console.log(`Sessão de ${duration} minutos iniciada`);

// ✅ Optional chaining
const duration = config?.focusDuration ?? 45;
```

**Tipagem Estrita:**
```typescript
// Interfaces bem definidas
interface PomodoroConfig {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  enableSoundAlerts: boolean;
  enableDesktopNotifications: boolean;
  enableStatusBarTimer: boolean;
  dailyGoalSessions: number;
}

// Enums para estados
enum PomodoroState {
  INACTIVE = 'inactive',
  FOCUS = 'focus',
  FOCUS_PAUSED = 'focus_paused'
}
```

### Nomenclatura

**Classes:** PascalCase
```typescript
class DatabaseManager { }
class StatusBarManager { }
class PomodoroManager { }
```

**Métodos/Funções:** camelCase
```typescript
async startTracking(): Promise<void>
async showStats(): Promise<void>
getCurrentState(): PomodoroState
```

**Constantes:** UPPER_SNAKE_CASE
```typescript
const IDLE_TIMEOUT = 5 * 60 * 1000;
const DEFAULT_CONFIG: PomodoroConfig = { ... };
```

**Arquivos:** camelCase para modules, kebab-case para CSS
```typescript
timeTrace.ts
database.ts
modal-styles.css
dashboard-styles.css
```

### Estrutura de Módulos

**Exports Named:**
```typescript
// ✅ Preferir exports nomeados
export class DatabaseManager { }
export interface ActivityData { }

// ❌ Evitar default exports
export default DatabaseManager;
```

**Barrel Files:**
```typescript
// src/modules/index.ts
export { DatabaseManager, ActivityData } from "./database";
export { StatusBarManager } from "./statusBar";
export { timeTrace } from "./timeTrace";
export { StatsManager } from "./stats";
```

**Interface First:**
```typescript
// Definir interfaces antes das implementações
interface ModalConfig {
  id: string;
  title: string;
  content?: string;
}

class ModalManager {
  async showModal(config: ModalConfig): Promise<void> { }
}
```

### Error Handling

**Try/Catch Robusto:**
```typescript
async saveActivityData(data: ActivityData): Promise<void> {
  try {
    const sql = `INSERT INTO time_entries ...`;
    await this.query(sql, [data.timestamp, data.project]);
    console.log('✅ Dados salvos com sucesso');
  } catch (error) {
    console.error('❌ Erro ao salvar dados:', error);
    throw error;
  }
}
```

**Logs Estruturados:**
```typescript
// Prefixos emoji para categorização
console.log('🚀 Iniciando extensão...');
console.log('✅ Operação concluída');
console.log('⚠️ Aviso importante');
console.error('❌ Erro crítico:', error);
console.log('🔍 Debug:', value);
```

### Design System

**Variáveis CSS VSCode:**
```css
:root {
  --vscode-editor-background: cor de fundo principal;
  --vscode-editor-foreground: cor do texto principal;
  --vscode-button-background: cor de fundo dos botões;
  --vscode-input-background: cor de fundo dos inputs;
  --vscode-panel-border: cor das bordas;
  --vscode-focusBorder: cor de foco dos elementos;
}
```

**Layout Responsivo:**
```css
/* Grid principal */
.overview {
  display: grid;
  grid-template-columns: 40% 60%;
  gap: 20px;
}

/* Mobile */
@media (max-width: 768px) {
  .overview {
    grid-template-columns: 1fr;
  }
}
```

**Animações Suaves:**
```css
.card {
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## 🔮 Roadmap e Próximos Passos

### v0.4.0 - Planejado

**Modais de Interface de Pausa:**
- [ ] Modal de timer de pausa com contagem regressiva
- [ ] Modal de fim de pausa com alertas visuais
- [ ] Integração automática com PomodoroManager

**Relatórios Básicos:**
- [ ] Engine de relatórios Pomodoro
- [ ] Interface de relatórios com gráficos
- [ ] Métricas de produtividade (streak, sessões por projeto)
- [ ] Comando `showPomodoroReports`

### v0.5.0 - Futuro

**Exportação de Dados:**
- [ ] Export CSV de estatísticas
- [ ] Export JSON para análise externa
- [ ] Backup automático de dados

**Sincronização Cloud:**
- [ ] Backend opcional para sync
- [ ] Backup em nuvem
- [ ] Multi-device support

**Integração Git:**
- [ ] Correlação tempo vs commits
- [ ] Analytics por branch
- [ ] Produtividade por feature

---

## 📚 Documentação Relacionada

### Arquivos de Documentação

```
docs/
├── README.md                        # Índice geral
├── POMODORO_CONSOLIDADO_TAREFAS.md  # Sistema Pomodoro completo
├── DASHBOARD_MODERNO.md             # Interface dashboard
├── DELETED_PROJECTS_PANEL.md        # Painel de deletados
├── COVERAGE_REPORT.md               # Relatório de testes
├── UI_COMPONENTS.md                 # Componentes de interface
├── IDENTIDADE_VISUAL.md             # Brand guidelines
├── SOFT_DELETE.md                   # Exclusão reversível
├── DELETION_HISTORY.md              # Histórico de auditoria
├── UNDO_GUIDE.md                    # Guia de restauração
├── IMPLEMENTACAO_EXCLUSAO.md        # Sistema de exclusão
└── PUBLICACAO.md                    # Publicação no marketplace
```

### Links Úteis

- **Repositório:** [https://github.com/beliciobcardoso/MyTimeTraceVSCode](https://github.com/beliciobcardoso/MyTimeTraceVSCode)
- **Marketplace:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=BelicioBCardoso.my-time-trace-vscode)
- **Issues:** [GitHub Issues](https://github.com/beliciobcardoso/MyTimeTraceVSCode/issues)

---

## 🎓 Como Começar

### Para Usuários

```bash
# 1. Instalar extensão no VS Code
Ctrl+Shift+X → Buscar "My Time Trace" → Instalar

# 2. Configurar (opcional)
Ctrl+, → Buscar "MyTime Trace"

# 3. Usar
Ctrl+Shift+P → "My Time Trace: Show Stats"
```

### Para Desenvolvedores

```bash
# 1. Clonar repositório
git clone https://github.com/beliciobcardoso/MyTimeTraceVSCode.git
cd MyTimeTraceVSCode

# 2. Instalar dependências
npm install

# 3. Compilar
npm run compile

# 4. Executar testes
npm test

# 5. Abrir no VS Code
code .

# 6. Pressionar F5 para debug
```

### Estrutura de Desenvolvimento

```
1. Análise de Requisitos
   ↓
2. Testes First (escrever testes antes)
   ↓
3. Implementação (código modular)
   ↓
4. Validação (executar testes)
   ↓
5. Documentação (comentários JSDoc)
```

---

## 📝 Notas Finais

### ⚠️ REGRA CRÍTICA: Modais e Confirmações

**NUNCA use `confirm()`, `alert()` ou `prompt()` em webviews!**

- ❌ **PROIBIDO:** `confirm()`, `alert()`, `prompt()` - Bloqueados por sandbox do VS Code
- ✅ **CORRETO - Frontend:** Crie modais customizados em HTML/CSS/JS dentro do webview
- 📋 **Fluxo:** Frontend envia `postMessage` → Backend confirma com modal nativo → Executa ação

**Motivo:** VS Code webviews são sandboxed e bloqueiam `confirm()`/`alert()` por segurança.

### Identidade Visual

**Logo:** Relógio laranja + chevron azul (tempo + código)  
**Cores Primárias:**
- Laranja (#F5A623) - Energia, ação
- Azul (#4A90E2) - Tecnologia, confiança

**Design Philosophy:** Profissional, clean, integração perfeita com VS Code

---

## 🏆 Qualidade e Métricas

### Indicadores de Qualidade

- ✅ **Cobertura de Testes:** 88% (23 testes passando)
- ✅ **Zero Testes Falhando:** Base sólida e confiável
- ✅ **Performance:** Operações não-bloqueantes
- ✅ **Error Handling:** Tratamento robusto de exceções
- ✅ **Cleanup Automático:** Prevenção de vazamentos de memória
- ✅ **Modularidade:** 7 módulos especializados
- ✅ **Documentação:** 19 arquivos de documentação
- ✅ **Internacionalização:** PT-BR + EN completos

### Métricas de Código

```
Total de Linhas: ~8.500 linhas
Arquivos TypeScript: 25+
Arquivos CSS: 3
Arquivos de Teste: 7
Comandos: 33
Interfaces: 15+
Classes: 12
```

---

**🎉 Projeto Enterprise-Grade - Pronto para Produção!**

*Documentação gerada automaticamente a partir do codebase em 17 de novembro de 2025*
