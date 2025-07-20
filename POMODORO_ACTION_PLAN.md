# 🍅 Plano de Ação: Implementação da Funcionalidade Pomodoro na Extensão MyTime Trace

## 📋 Análise da Situação Atual

### ✅ **O que já está implementado:**
- **Database Schema**: Tabelas `pomodoro_config` e `pomodoro_sessions` criadas
- **Interfaces TypeScript**: `PomodoroConfig` e `PomodoroSession` definidas
- **Métodos de Database**: CRUD completo para configuração e sessões
- **Testes Unitários**: 8 testes implementados e passando (100% cobertura database)

### 🚧 **O que precisa ser implementado:**
- Módulo de lógica Pomodoro (`PomodoroManager`)
- Interface de usuário (modais e configurações)
- Integração com sistema de rastreamento existente
- Notificações e alertas
- Comandos da extensão

---

## 🎯 **FASE 1: Criação do Módulo Core Pomodoro**
**Estimativa:** 2-3 dias  
**Prioridade:** 🔴 Crítica

### 1.1 Criar `src/modules/pomodoro.ts`

```typescript
export class PomodoroManager {
  // Estados do timer
  private currentSession: PomodoroSession | null = null;
  private focusTimer: NodeJS.Timeout | null = null;
  private breakTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private isPaused: boolean = false;
  
  // Configurações
  private config: PomodoroConfig | null = null;
  
  // Contadores
  private currentFocusTime: number = 0; // em segundos
  private sessionsCompleted: number = 0;
  private lastActivityTime: number = Date.now();
  
  constructor(
    private dbManager: DatabaseManager,
    private statusBarManager: StatusBarManager
  ) {}
  
  // Métodos principais a implementar:
  async initialize(): Promise<void>
  async startFocusSession(): Promise<void>
  async startBreakSession(type: 'short' | 'long'): Promise<void>
  async pauseSession(): Promise<void>
  async resumeSession(): Promise<void>
  async completeSession(): Promise<void>
  async handleInactivity(): Promise<void>
  async showBreakModal(): Promise<void>
  async extendFocus(minutes: number): Promise<void>
  
  // Helpers
  private calculateNextBreakType(): 'short' | 'long'
  private updateStatusBar(): void
  private playNotificationSound(): void
  private showDesktopNotification(message: string): void
}
```

**Arquivos a criar:**
- `src/modules/pomodoro.ts` - Classe principal PomodoroManager
- `src/ui/pomodoroPanel.ts` - Interface de configuração
- `src/ui/breakModal.ts` - Modal de pausa

---

## 🎯 **FASE 2: Integração com Sistema de Rastreamento**
**Estimativa:** 1-2 dias  
**Prioridade:** 🔴 Crítica

### 2.1 Modificar `src/modules/timeTrace.ts`

```typescript
// Adicionar ao timeTrace:
private pomodoroManager: PomodoroManager;

// Integrar detecção de atividade:
onTextDocumentChange(event: vscode.TextDocumentChangeEvent) {
  // Código existente...
  
  // Notificar Pomodoro sobre atividade
  if (this.pomodoroManager) {
    this.pomodoroManager.onUserActivity();
  }
}

onActiveEditorChange(editor: vscode.TextEditor | undefined) {
  // Código existente...
  
  // Auto-start Pomodoro se configurado
  if (this.pomodoroManager && editor) {
    this.pomodoroManager.autoStartIfNeeded();
  }
}
```

### 2.2 Modificar `src/extension.ts`

```typescript
// Adicionar inicialização do Pomodoro:
let pomodoroManager: PomodoroManager;

export async function activate(context: vscode.ExtensionContext) {
  // Código existente...
  
  // Inicializar Pomodoro
  pomodoroManager = new PomodoroManager(dbManager, statusBarManager);
  await pomodoroManager.initialize();
  
  // Integrar com timeTrace
  myTimeTrace.setPomodoroManager(pomodoroManager);
  
  // Registrar comandos Pomodoro
  const pomodoroCommands = [
    vscode.commands.registerCommand('my-time-trace-vscode.startPomodoro', 
      () => pomodoroManager.startFocusSession()),
    vscode.commands.registerCommand('my-time-trace-vscode.pausePomodoro',
      () => pomodoroManager.pauseSession()),
    vscode.commands.registerCommand('my-time-trace-vscode.pomodoroSettings',
      () => pomodoroManager.showSettings()),
  ];
  
  context.subscriptions.push(...pomodoroCommands);
}
```

---

## 🎯 **FASE 3: Interface de Usuário e Modais**
**Estimativa:** 3-4 dias  
**Prioridade:** 🟡 Alta

### 3.1 Modal de Pausa (`src/ui/breakModal.ts`)

```typescript
export class BreakModal {
  static async show(
    focusMinutes: number,
    breakMinutes: number,
    onRelax: () => void,
    onContinue: () => void,
    onSettings: () => void
  ): Promise<void> {
    // HTML do modal com:
    // - Fundo vermelho chamativo
    // - Botão "Relaxar agora (15 min)"
    // - Botão "Continuar por mais 5 min"
    // - Ícone ⚙️ de configurações
    // - Som de notificação
  }
}
```

### 3.2 Timer de Pausa (`src/ui/breakTimer.ts`)

```typescript
export class BreakTimer {
  static async show(
    durationMinutes: number,
    onComplete: () => void
  ): Promise<void> {
    // Timer regressivo com:
    // - Fundo amarelo
    // - Contagem regressiva
    // - Som contínuo ao final
    // - Botão "Voltar a codar"
  }
}
```

### 3.3 Painel de Configurações (`src/ui/pomodoroSettings.ts`)

```typescript
export class PomodoroSettings {
  static async show(
    currentConfig: PomodoroConfig,
    onSave: (config: PomodoroConfig) => void
  ): Promise<void> {
    // Interface para configurar:
    // - Tempo de foco (padrão: 45 min)
    // - Tempo de descanso (padrão: 15 min)
    // - Tempo "continuar por mais X min"
    // - Toggle Ativar/Desativar Pomodoro
    // - Outras configurações de notificação
  }
}
```

---

## 🎯 **FASE 4: Lógica de Negócio e Regras**
**Estimativa:** 2-3 dias  
**Prioridade:** 🟡 Alta

### 4.1 Implementar Regras de Tempo

```typescript
// Em PomodoroManager:

private async handleInactivity(): Promise<void> {
  const inactiveTime = Date.now() - this.lastActivityTime;
  const fiveMinutes = 5 * 60 * 1000;
  const tenMinutes = 10 * 60 * 1000;
  
  if (inactiveTime > fiveMinutes && this.isActive) {
    // Pausar timer automaticamente
    await this.pauseSession();
  }
  
  if (inactiveTime > tenMinutes && this.isPaused) {
    // Reiniciar sessão do zero
    await this.resetSession();
  }
}

private async checkFocusTime(): Promise<void> {
  const focusTimeMinutes = this.currentFocusTime / 60;
  const focusLimit = this.config?.focusDuration || 45;
  
  if (focusTimeMinutes >= focusLimit) {
    await this.showBreakModal();
  }
}
```

### 4.2 Sistema de Categorização

```typescript
// Integrar com ActivityData existente:
enum ActivityType {
  FOCUS = 'foco',
  SHORT_BREAK = 'descanso',
  LONG_BREAK = 'descanso',
  EXTENDED_BREAK = 'descanso_estendido',
  IDLE = 'ocioso'
}

// Salvar no banco com tipo correto:
await this.dbManager.saveActivityData({
  timestamp: new Date().toISOString(),
  project: this.currentProject,
  file: this.currentFile,
  duration: sessionDuration,
  type: ActivityType.FOCUS, // ou outros tipos
  isIdle: false
});
```

---

## 🎯 **FASE 5: Comandos e Integração VSCode**
**Estimativa:** 1-2 dias  
**Prioridade:** 🟡 Alta

### 5.1 Atualizar `package.json`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "my-time-trace-vscode.startPomodoro",
        "title": "Start Pomodoro Session",
        "category": "My Time Trace"
      },
      {
        "command": "my-time-trace-vscode.pausePomodoro", 
        "title": "Pause Pomodoro",
        "category": "My Time Trace"
      },
      {
        "command": "my-time-trace-vscode.pomodoroSettings",
        "title": "Pomodoro Settings",
        "category": "My Time Trace"
      }
    ],
    "configuration": {
      "title": "My Time Trace Pomodoro",
      "properties": {
        "myTimeTrace.pomodoro.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable Pomodoro timer"
        },
        "myTimeTrace.pomodoro.autoStart": {
          "type": "boolean", 
          "default": true,
          "description": "Auto-start Pomodoro when coding begins"
        }
      }
    }
  }
}
```

### 5.2 Atualizar Status Bar

```typescript
// Em StatusBarManager, adicionar indicador Pomodoro:
updatePomodoroStatus(isActive: boolean, timeRemaining: number, type: 'focus' | 'break'): void {
  if (!this.statusBarItem) return;
  
  if (isActive) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const icon = type === 'focus' ? '🍅' : '☕';
    
    this.statusBarItem.text = `${icon} ${minutes}:${seconds.toString().padStart(2, '0')}`;
    this.statusBarItem.backgroundColor = type === 'focus' 
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : new vscode.ThemeColor('statusBarItem.errorBackground');
  }
}
```

---

## 🎯 **FASE 6: Relatórios e Analytics**
**Estimativa:** 2-3 dias  
**Prioridade:** 🟢 Média

### 6.1 Estender `src/modules/stats.ts`

```typescript
// Adicionar ao StatsManager:

async getPomodoroReports(startDate?: Date, endDate?: Date): Promise<PomodoroReport> {
  const sessions = await this.dbManager.getPomodoroSessions(startDate, endDate);
  
  const report = {
    totalFocusTime: 0,
    totalBreakTime: 0,
    totalIdleTime: 0,
    completedCycles: 0,
    productivity: 0,
    sessionsBreakdown: {
      focus: sessions.filter(s => s.sessionType === 'focus'),
      short_break: sessions.filter(s => s.sessionType === 'short_break'),
      long_break: sessions.filter(s => s.sessionType === 'long_break')
    }
  };
  
  // Calcular métricas...
  return report;
}

async showPomodoroStats(): Promise<void> {
  // Interface similar ao statsPanel.ts existente
  // mas focada em dados do Pomodoro
}
```

### 6.2 Filtros por Período

```typescript
// Interface para seleção de período:
interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Implementar filtros:
- Hoje
- Esta semana  
- Este mês
- Período customizado (01/01/2025 a 01/02/2025)
```

---

## 🎯 **FASE 7: Testes e Qualidade**
**Estimativa:** 1-2 dias  
**Prioridade:** 🟢 Média

### 7.1 Expandir Testes

```typescript
// Adicionar testes em pomodoro.test.ts:
- Teste de integração com timeTrace
- Teste de detecção de inatividade
- Teste de auto-start
- Teste de modais (mock)
- Teste de cálculo de relatórios
```

### 7.2 Testes de Interface

```typescript
// Criar pomodoroUI.test.ts:
- Teste de criação de modais
- Teste de timer countdown
- Teste de notificações
- Teste de configurações
```

---

## 📅 **Cronograma de Implementação**

### **Semana 1:**
- **Dias 1-2:** FASE 1 (Módulo Core)
- **Dias 3-4:** FASE 2 (Integração)
- **Dia 5:** FASE 5 (Comandos básicos)

### **Semana 2:**
- **Dias 1-3:** FASE 3 (Interface UI)
- **Dias 4-5:** FASE 4 (Lógica de negócio)

### **Semana 3:**
- **Dias 1-2:** FASE 6 (Relatórios)
- **Dias 3-4:** FASE 7 (Testes)
- **Dia 5:** Refinamentos e documentação

---

## 🔧 **Dependências e Configurações**

### Atualizações Necessárias:

1. **`package.json`** - Adicionar comandos e configurações
2. **`extension.ts`** - Inicialização do PomodoroManager
3. **`timeTrace.ts`** - Integração com detecção de atividade
4. **`statusBar.ts`** - Indicador visual do timer
5. **`commands.ts`** - Novos comandos Pomodoro

### Novos Arquivos:

```
src/
├── modules/
│   └── pomodoro.ts           # ⭐ Novo - Lógica principal
├── ui/
│   ├── breakModal.ts         # ⭐ Novo - Modal de pausa
│   ├── breakTimer.ts         # ⭐ Novo - Timer regressivo
│   └── pomodoroSettings.ts   # ⭐ Novo - Configurações
└── test/
    ├── pomodoroManager.test.ts # ⭐ Novo - Testes integração
    └── pomodoroUI.test.ts      # ⭐ Novo - Testes interface
```

---

## 🚨 **Riscos e Considerações**

### **Riscos Técnicos:**
- **Performance:** Timers podem impactar performance se mal implementados
- **Memória:** Cleanup adequado dos intervals/timeouts
- **Estado:** Sincronização entre diferentes timers

### **Mitigações:**
- Usar `setInterval` com cleanup no `dispose()`
- Implementar debounce para detecção de atividade
- Estado centralizado no PomodoroManager

### **Compatibilidade:**
- Testar com configurações existentes
- Manter retrocompatibilidade com banco de dados
- Não impactar funcionalidades existentes

---

## ✅ **Critérios de Aceitação**

### **Funcionalidade Core:**
- [ ] Pomodoro inicia automaticamente ao detectar codificação
- [ ] Modal aparece após 45 minutos de foco
- [ ] Timer de pausa funciona corretamente
- [ ] Configurações são persistidas no banco
- [ ] Status bar mostra timer ativo

### **Regras de Negócio:**
- [ ] Pausa automática após 5 min de inatividade
- [ ] Reset após 10 min de inatividade
- [ ] Categorização correta (foco/descanso/ocioso/estendido)
- [ ] Opção de desativar Pomodoro

### **Interface:**
- [ ] Modal responsivo e visualmente chamativo
- [ ] Som de notificação funcionando
- [ ] Configurações acessíveis e intuitivas
- [ ] Relatórios filtráveis por período

### **Qualidade:**
- [ ] 90%+ cobertura de testes
- [ ] Performance mantida
- [ ] Sem vazamentos de memória
- [ ] Documentação atualizada

---

## 🎯 **Próximos Passos Imediatos**

### **Hoje (20/01/2025):**
1. ✅ ~~Analisar código existente e testes~~
2. ✅ ~~Criar plano de ação detalhado~~
3. 🔄 **PRÓXIMO:** Começar implementação do `PomodoroManager`

### **Amanhã (21/01/2025):**
1. Finalizar `src/modules/pomodoro.ts`
2. Implementar integração básica com `timeTrace.ts`
3. Criar comandos básicos no `extension.ts`

### **Esta Semana:**
- Completar FASES 1, 2 e 5 (core funcional)
- Começar interface básica (modais)

---

**📊 Estimativa Total: 8-12 dias de desenvolvimento**  
**🎯 Meta: Funcionalidade Pomodoro completa e integrada**  
**📅 Entrega Prevista: Final de Janeiro 2025**

---

*Este plano garante uma implementação sistemática e de alta qualidade da funcionalidade Pomodoro, mantendo a compatibilidade com o sistema existente e seguindo as melhores práticas da extensão MyTime Trace.*
