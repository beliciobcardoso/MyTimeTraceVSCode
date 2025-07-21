# 🚀 FASE 3 - CONFIGURAÇÕES AVANÇADAS DO POMODORO

## 📋 Plano de Implementação

### 🎯 Objetivo
Criar uma interface de configuração completa e intuitiva para personalizar o sistema Pomodoro, permitindo ao usuário ajustar todos os parâmetros de acordo com suas preferências e necessidades de produtividade.

---

## 🔧 SUB-TAREFAS DA FASE 3

### ✅ SUB-TAREFA 3.1: Interface de Configuração Principal
- **Arquivo**: `src/ui/pomodoroSettingsModal.ts`
- **Objetivo**: Modal de configurações com interface visual intuitiva
- **Funcionalidades**:
  - Sliders para durações (foco, pausa curta, pausa longa)
  - Campos numéricos para valores precisos
  - Toggles para opções booleanas
  - Preview das configurações em tempo real
  - Botões Salvar/Cancelar/Restaurar Padrões

### 🔄 SUB-TAREFA 3.2: Validação e Persistência
- **Arquivo**: `src/modules/configValidator.ts` (novo)
- **Objetivo**: Validar configurações e garantir valores coerentes
- **Funcionalidades**:
  - Validação de valores mínimos/máximos
  - Verificação de lógica (ex: pausa < foco)
  - Sanitização de inputs
  - Mensagens de erro claras

### 🎨 SUB-TAREFA 3.3: Presets e Perfis
- **Arquivo**: `src/modules/pomodoroPresets.ts` (novo)
- **Objetivo**: Perfis pré-configurados para diferentes necessidades
- **Funcionalidades**:
  - Preset "Clássico" (25-5-15 min)
  - Preset "Foco Profundo" (45-15-30 min) - atual
  - Preset "Sprint Rápido" (15-3-10 min)
  - Preset "Personalizado" (configurações do usuário)

### 🔧 SUB-TAREFA 3.4: Integração com Sistema Existente
- **Arquivo**: Atualizações em `extension.ts` e `pomodoro.ts`
- **Objetivo**: Conectar nova interface com sistema existente
- **Funcionalidades**:
  - Substituir placeholder de configurações
  - Aplicar mudanças em tempo real
  - Feedback visual de aplicação

---

## 🎨 Design da Interface

### Modal de Configurações (Estrutura Visual)
```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ Configurações do Pomodoro                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📝 Perfis Predefinidos:                                │
│  [Clássico] [Foco Profundo] [Sprint] [Personalizado]    │
│                                                         │
│  ⏱️ Durações:                                           │
│  Foco:         [●────────] 45 min                      │
│  Pausa Curta:  [●──] 15 min                            │
│  Pausa Longa:  [●────] 30 min                          │
│                                                         │
│  🔄 Comportamento:                                      │
│  ☑️ Auto-iniciar pausas                                │
│  ☐ Auto-iniciar foco                                   │
│  ☑️ Alertas sonoros                                     │
│  ☑️ Notificações desktop                                │
│                                                         │
│  🎯 Metas:                                              │
│  Sessões até pausa longa: [●●] 4                       │
│  Meta diária de sessões:  [●●●●●●●●] 8                 │
│                                                         │
│              [Restaurar] [Cancelar] [Salvar]            │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Configurações Disponíveis

### ⏱️ Durações (com validação)
- **Foco**: 5-120 minutos (padrão: 45)
- **Pausa Curta**: 1-30 minutos (padrão: 15)
- **Pausa Longa**: 5-60 minutos (padrão: 30)

### 🔄 Comportamento
- **Auto-iniciar pausas**: Sim/Não
- **Auto-iniciar foco**: Sim/Não  
- **Alertas sonoros**: Sim/Não
- **Notificações desktop**: Sim/Não
- **Timer na status bar**: Sim/Não

### 🎯 Metas e Ciclos
- **Sessões até pausa longa**: 1-10 (padrão: 4)
- **Meta diária de sessões**: 1-20 (padrão: 8)

---

## 🎯 Presets Predefinidos

### 1. 🍅 Clássico (Pomodoro Tradicional)
```json
{
  "name": "Clássico",
  "focusDuration": 25,
  "shortBreakDuration": 5,
  "longBreakDuration": 15,
  "sessionsUntilLongBreak": 4,
  "dailyGoalSessions": 12
}
```

### 2. 🎯 Foco Profundo (Atual)
```json
{
  "name": "Foco Profundo",
  "focusDuration": 45,
  "shortBreakDuration": 15,
  "longBreakDuration": 30,
  "sessionsUntilLongBreak": 4,
  "dailyGoalSessions": 8
}
```

### 3. ⚡ Sprint Rápido
```json
{
  "name": "Sprint Rápido",
  "focusDuration": 15,
  "shortBreakDuration": 3,
  "longBreakDuration": 10,
  "sessionsUntilLongBreak": 6,
  "dailyGoalSessions": 16
}
```

### 4. 🛠️ Personalizado
- Configurações definidas pelo usuário
- Salvas automaticamente

---

## 🔄 Fluxo de Implementação

### Passo 1: Estrutura Base
1. Criar `pomodoroSettingsModal.ts`
2. Definir interface `SettingsModalConfig`
3. Implementar modal básico com campos

### Passo 2: Validação
1. Criar `configValidator.ts`
2. Implementar regras de validação
3. Adicionar feedback de erro

### Passo 3: Presets
1. Criar `pomodoroPresets.ts`
2. Definir presets predefinidos
3. Implementar sistema de seleção

### Passo 4: Integração
1. Conectar modal ao comando existente
2. Aplicar configurações ao PomodoroManager
3. Feedback visual de aplicação

---

## 📋 Critérios de Sucesso

- [ ] Modal de configurações abre e fecha corretamente
- [ ] Todos os campos são editáveis e responsivos
- [ ] Validação impede valores inválidos
- [ ] Presets aplicam configurações corretas
- [ ] Configurações são salvas e persistem
- [ ] Mudanças são aplicadas ao timer em tempo real
- [ ] Interface é intuitiva e visualmente atrativa

---

## 🚀 Comandos de Teste (a implementar)

- `myTimeTrace.openPomodoroSettings` - Abre configurações
- `myTimeTrace.testPresetClassic` - Testa preset clássico
- `myTimeTrace.testPresetSprint` - Testa preset sprint
- `myTimeTrace.resetPomodoroConfig` - Restaura padrões

---

**Status**: 🔄 INICIANDO IMPLEMENTAÇÃO
**Próximo**: SUB-TAREFA 3.1 - Interface Principal
**Data**: 20 de julho de 2025
