# 🍅 Módulo Pomodoro - My Time Trace VSCode

## FASE 1 - Módulo Core Pomodoro (PomodoroManager) ✅ CONCLUÍDO

### Visão Geral

O **PomodoroManager** é o núcleo do sistema Pomodoro integrado à extensão My Time Trace VSCode. Foi desenvolvido para funcionar de forma totalmente integrada com o sistema de rastreamento de tempo existente, mantendo a compatibilidade com todas as funcionalidades já implementadas.

### Funcionalidades Implementadas

#### 🎯 Estados do Pomodoro
- **INACTIVE**: Pomodoro não está ativo
- **FOCUS**: Sessão de foco ativa  
- **FOCUS_PAUSED**: Sessão de foco pausada por inatividade
- **SHORT_BREAK**: Pausa curta (15 min padrão)
- **LONG_BREAK**: Pausa longa (30 min padrão)
- **BREAK_EXTENDED**: Pausa estendida além do tempo planejado

#### ⏰ Sistema de Timers
- **Timer de Foco**: Controla sessões de trabalho (45 min padrão)
- **Timer de Pausa**: Controla períodos de descanso
- **Timer de Inatividade**: Monitora atividade do usuário a cada 30s
- **Auto-pausa**: Pausa automática após 5 minutos de inatividade

#### 🔧 Configurações Flexíveis
```typescript
interface PomodoroConfig {
  focusDuration: number;              // 45 min padrão
  shortBreakDuration: number;         // 15 min padrão  
  longBreakDuration: number;          // 30 min padrão
  sessionsUntilLongBreak: number;     // 4 sessões padrão
  autoStartBreaks: boolean;           // Auto-iniciar pausas
  autoStartFocus: boolean;            // Auto-iniciar foco após atividade
  enableSoundAlerts: boolean;         // Alertas sonoros
  enableDesktopNotifications: boolean;// Notificações do sistema
  enableStatusBarTimer: boolean;      // Timer na barra de status
  dailyGoalSessions: number;          // Meta diária (8 sessões)
}
```

#### 📊 Integração com Sistema Existente
- **Compatibilidade Total**: Usa o mesmo DatabaseManager do sistema principal
- **Registros de Atividade**: Salva sessões como atividades rastreáveis
- **StatusBar**: Integra com o StatusBarManager existente
- **Comandos VSCode**: Adiciona comandos sem conflitar com existentes

#### 🎮 Comandos Disponíveis
- `my-time-trace-vscode.startPomodoroFocus`: Inicia sessão de foco
- `my-time-trace-vscode.pausePomodoroSession`: Pausa sessão atual
- `my-time-trace-vscode.stopPomodoroSession`: Para sessão atual
- `my-time-trace-vscode.showPomodoroConfig`: Abre configurações (placeholder)

#### 🔄 Detecção de Atividade
O sistema monitora automaticamente:
- **Mudanças de editor**: `onDidChangeActiveTextEditor`
- **Edições de texto**: `onDidChangeTextDocument`  
- **Foco da janela**: `onDidChangeWindowState`

#### 📈 Sistema de Eventos
```typescript
interface PomodoroEvents {
  onStateChange?: (state: PomodoroState) => void;
  onTimeUpdate?: (remainingSeconds: number) => void;
  onFocusComplete?: () => void;
  onBreakComplete?: () => void;
  onSessionComplete?: (session: PomodoroSession) => void;
}
```

### Arquitetura

#### 📁 Estrutura de Arquivos
```
src/modules/
├── pomodoro.ts          # Módulo principal PomodoroManager
├── database.ts          # Interfaces PomodoroConfig e PomodoroSession (já existiam)
├── commands.ts          # Comandos atualizados
└── extension.ts         # Integração principal

test/
└── pomodoro-integration.test.ts  # Teste de integração básico
```

#### 🔗 Integração com Extension.ts
```typescript
// Inicialização
pomodoroManager = new PomodoroManager(dbManager, statusBarManager);
await pomodoroManager.initialize();

// Detecção de atividade integrada
const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
  myTimeTrace.onTextDocumentChange(event);
  pomodoroManager.onUserActivity(); // <-- Integração com Pomodoro
});
```

### Lógica de Funcionamento

#### 🚀 Auto-Start (Configurável)
1. Sistema detecta atividade de codificação
2. Se `autoStartFocus = true`, inicia automaticamente sessão de foco
3. Usuário pode desativar nas configurações

#### ⏸️ Auto-Pause por Inatividade
1. Monitor verifica atividade a cada 30 segundos
2. Se inativo por >5 minutos durante foco, pausa automaticamente
3. Se retorna em <15 minutos, resume sessão
4. Se retorna em >15 minutos, reinicia sessão

#### ⏰ Extensão de Tempo
- Função `extendFocus(minutes)` permite adicionar tempo extra
- Útil para implementar botão "Continuar por mais 5 min" (FASE 3)

### Base de Dados

#### 📋 Tabelas Utilizadas
- **pomodoro_config**: Configurações do usuário
- **pomodoro_sessions**: Histórico de sessões
- **activity_data**: Integração com sistema de rastreamento existente

#### 💾 Persistência de Sessões
```typescript
interface PomodoroSession {
  sessionType: 'focus' | 'short_break' | 'long_break';
  plannedDuration: number;        // Duração planejada (segundos)
  actualDuration?: number;        // Duração real (segundos)
  startTime: number;             // Timestamp Unix
  endTime?: number;              // Timestamp Unix
  wasCompleted: boolean;         // Sessão completada?
  wasInterrupted: boolean;       // Sessão interrompida?
  interruptionReason?: string;   // Motivo da interrupção
  associatedActivity?: string;   // Atividade durante foco
}
```

### Testes

#### 🧪 Teste de Integração Básico
Arquivo: `test/pomodoro-integration.test.ts`

Testa:
- ✅ Inicialização do PomodoroManager
- ✅ Carregamento de configurações padrão
- ✅ Detecção de atividade do usuário
- ✅ Inicio/pausa/resume de sessões
- ✅ Extensão de tempo
- ✅ Sistema de eventos
- ✅ Cleanup adequado

### Localização

#### 🌐 Suporte Multi-idioma
- **Inglês**: `package.nls.json`
- **Português BR**: `package.nls.pt-br.json`

### Próximas Fases

#### 📋 FASE 2 - Integração com Sistema Existente (1-2 dias)
- [ ] Melhor integração com StatusBarManager
- [ ] Sincronização com timeTrace para detectar quando usuário está codificando
- [ ] Regras específicas para auto-start baseadas em atividade real de código

#### 🎨 FASE 3 - Interface de Usuário (3-4 dias)
- [ ] Modal de alerta "45 minutos completados"
- [ ] Modal de pausa com cronômetro regressivo
- [ ] Panel de configurações
- [ ] Indicadores visuais na StatusBar

#### ⚡ FASE 4 - Lógica de Negócio (2-3 dias)
- [ ] Implementar regras completas dos requisitos
- [ ] Sons de alerta
- [ ] Ciclos de pausa longa (a cada 4 sessões)
- [ ] Metas diárias

### Como Testar

#### 🏃‍♂️ Teste Rápido
1. Compile: `npm run compile`
2. Execute no VS Code com F5 (modo debug)
3. Abra Command Palette (Ctrl+Shift+P)
4. Execute: "Pomodoro: Start Focus Session"
5. Verifique logs no Debug Console

#### 🔬 Teste Completo
1. Execute o arquivo de teste: `test/pomodoro-integration.test.ts`
2. Verifique output no terminal/console

### Conclusão FASE 1

✅ **STATUS: COMPLETAMENTE IMPLEMENTADO**

A FASE 1 entrega uma base sólida e totalmente funcional do sistema Pomodoro. O PomodoroManager está:

- 🏗️ **Arquiteturalmente Sólido**: Design modular e extensível
- 🔗 **Totalmente Integrado**: Funciona junto com sistema existente sem conflitos  
- ⚙️ **Configurável**: Todas as preferências ajustáveis pelo usuário
- 📊 **Observável**: Sistema de eventos permite integrações futuras
- 🧪 **Testável**: Testes básicos funcionando
- 🌐 **Localizado**: Suporte PT-BR e EN
- 📝 **Documentado**: Código bem comentado e documentação completa

**Próximo passo**: Iniciar FASE 2 para melhorar integração e seguir para FASE 3 com a implementação dos modais de interface.
