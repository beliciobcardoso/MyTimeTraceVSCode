# My Time Trace VSCode (Beta 0.2.1)

<div align="center">

![My Time Trace Logo](images/my-time-trace-logo.png)

**🕒 Extensão profissional de rastreamento de tempo para desenvolvedores**

[![VSCode](https://img.shields.io/badge/VSCode-1.100.0+-blue.svg)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Testes](https://img.shields.io/badge/Testes-15%20passando-green.svg)](#qualidade-e-confiabilidade)

</div>

Uma extensão avançada para o Visual Studio Code que monitora automaticamente o tempo gasto em cada arquivo e projeto, com **sistema Pomodoro integrado**, **alertas visuais e sonoros**, e **visualização detalhada de estatísticas** com filtros interativos. Transforme sua produtividade em dados acionáveis!

## ⚡ Funcionalidades Principais

### 🕒 **Rastreamento Automático de Tempo**
- **Monitoramento Inteligente**: Registra automaticamente o tempo gasto em cada arquivo durante o desenvolvimento
- **Organização por Projeto**: Agrupamento automático por workspace para análise de produtividade
- **Detecção de Inatividade**: Pausa automática após 5 minutos de inatividade para dados precisos
- **Persistência Local Robusta**: Armazenamento em banco SQLite local com backup automático

### 🍅 **Sistema Pomodoro Integrado** 
- **Timer de Foco**: Sessões configuráveis (45 min padrão) com acompanhamento visual
- **Pausas Inteligentes**: Pausas curtas (15 min) e longas (30 min) automáticas
- **Estados Avançados**: FOCUS, BREAK, PAUSED com detecção automática de inatividade
- **Configuração Flexível**: Duração de sessões, meta diária e comportamentos personalizáveis
- **Integração Total**: Funciona harmoniosamente com o rastreamento de tempo existente

### 🎨 **Sistema de Alertas Multimodal**
- **Alertas Visuais Avançados**: 10 estados visuais com animações dinâmicas (PULSE, FADE, BLINK)
- **4 Temas Visuais**: Produtividade Clássica, Modo Escuro, Alto Contraste, Minimalista
- **Alertas Sonoros Musicais**: 4 temas sonoros (Clássico, Moderno, Natural, Minimal)
- **Sons Sintéticos**: Geração em tempo real de acordes musicais e frequências harmônicas
- **Notificações Desktop**: Integração nativa com sistema operacional

### 📊 **Interface de Visualização Avançada**
- **Painel de Estatísticas Responsivo**: Design grid 40/60 otimizado com header fixo
- **Filtros Interativos Avançados**: 
  - Filtragem por intervalo de datas (data inicial e final)
  - Seleção múltipla de projetos específicos
  - Aplicação de filtros em tempo real
  - Resumo dinâmico dos dados filtrados
- **Projetos Expansíveis**: Interface colapsável para navegação otimizada
- **Status Bar Inteligente**: Exibição em tempo real do arquivo atual, tempo e estado do Pomodoro
- **Modal System**: Sistema completo de modais para configurações e alertas

### 🎛️ **Status Bar Interativo**
```
📁 main.ts - ⏱️ 2h 15m 30s [🍅 FOCUS 25:30] [●]
```
- **Arquivo Atual**: Nome do arquivo em edição
- **Tempo Total**: Formatação inteligente (segundos, minutos, horas)
- **Estado Pomodoro**: Timer visual do Pomodoro com tempo restante
- **Status Visual**: Indicadores de ativo/pausado com efeitos visuais

## 🎮 Comandos Disponíveis

### ⏱️ **Rastreamento de Tempo**
- `MyTime Trace: Start Tracking` - Iniciar monitoramento de tempo
- `MyTime Trace: Pause Tracking` - Pausar monitoramento
- `MyTime Trace: Show Stats` - Exibir painel de estatísticas interativo

### 🍅 **Sistema Pomodoro**
- `MyTime Trace: Start Pomodoro Focus` - Iniciar sessão de foco Pomodoro
- `MyTime Trace: Pause Pomodoro Session` - Pausar sessão Pomodoro atual
- `MyTime Trace: Stop Pomodoro Session` - Parar sessão Pomodoro atual
- `MyTime Trace: Show Pomodoro Config` - Configurar parâmetros do Pomodoro

## 🛠️ Como Funciona

### 🔄 **Fluxo de Trabalho Automático**
1. **Inicialização**: A extensão começa a monitorar automaticamente quando o VS Code é iniciado
2. **Rastreamento Inteligente**: Registra o tempo por arquivo e projeto em tempo real
3. **Detecção de Mudanças**: Detecta mudanças de arquivos, projetos e períodos de inatividade
4. **Pomodoro Integrado**: Opcionalmente executa sessões Pomodoro integradas ao rastreamento
5. **Persistência Segura**: Armazena todos os dados localmente em SQLite para acesso posterior
6. **Visualização Rica**: Oferece múltiplas formas de visualizar e filtrar os dados coletados

### 🍅 **Fluxo Pomodoro**
1. **Configuração Inicial**: Define duração de foco, pausas e comportamentos
2. **Sessão de Foco**: 45 minutos de trabalho concentrado com timer visual
3. **Pausa Automática**: Pausas curtas (15 min) ou longas (30 min) conforme progresso
4. **Alertas Multimodais**: Notificações visuais, sonoras e desktop
5. **Registro de Sessões**: Integração total com o sistema de rastreamento de tempo

## 🚀 Instalação e Configuração

### 📋 **Requisitos**
- Visual Studio Code 1.100.0 ou superior
- Node.js 16+ (para desenvolvimento)
- SQLite3 (incluído automaticamente)

### 💾 **Instalação**
```bash
# 1. Clone o repositório
git clone https://github.com/user/MyTimeTraceVSCode.git
cd MyTimeTraceVSCode

# 2. Instale as dependências
npm install

# 3. Compile o TypeScript
npm run compile

# 4. Teste a extensão (F5) ou gere VSIX
npm run package
```

### ⚡ **Início Rápido**
1. **Instalação**: A extensão inicia automaticamente após instalação
2. **Primeiro Uso**: Aceite permissões de armazenamento local SQLite
3. **Configuração**: Personalize configurações via `Ctrl+,` → busque "MyTime Trace"
4. **Pomodoro**: Execute `Ctrl+Shift+P` → "MyTime Trace: Start Pomodoro Focus"
5. **Visualização**: Use `Ctrl+Shift+P` → "MyTime Trace: Show Stats" para ver dados

## ⚙️ Configurações da Extensão

### 🕒 **Rastreamento de Tempo**
```json
{
  "myTimeTrace.idleTimeout": 5,           // Tempo limite de inatividade (minutos)
  "myTimeTrace.autoStart": true,          // Início automático do monitoramento
  "myTimeTrace.showInStatusBar": true     // Exibir tempo na barra de status
}
```

### 🍅 **Configurações Pomodoro**
```json
{
  "pomodoro.focusDuration": 45,              // Duração da sessão de foco (minutos)
  "pomodoro.shortBreakDuration": 15,         // Duração da pausa curta (minutos) 
  "pomodoro.longBreakDuration": 30,          // Duração da pausa longa (minutos)
  "pomodoro.sessionsUntilLongBreak": 4,      // Sessões até pausa longa
  "pomodoro.autoStartBreaks": true,          // Auto-iniciar pausas
  "pomodoro.autoStartFocus": false,          // Auto-iniciar foco após atividade
  "pomodoro.enableSoundAlerts": true,        // Alertas sonoros
  "pomodoro.enableDesktopNotifications": true, // Notificações desktop
  "pomodoro.enableStatusBarTimer": true,     // Timer na barra de status
  "pomodoro.dailyGoalSessions": 8            // Meta diária de sessões
}
```

### 🎨 **Configurações Visuais e Sonoras**
```json
{
  "visualEffects.theme": "productivity",     // Temas: productivity, dark, contrast, minimal
  "soundAlerts.theme": "classic",           // Temas: classic, modern, natural, minimal
  "soundAlerts.volume": 0.7                 // Volume dos alertas (0.0 - 1.0)
}
```

## 🎯 Roadmap e Funcionalidades

### ✅ **Implementado (v0.2.1)**
- ✅ **Rastreamento de Tempo**: Core completo com SQLite e interface avançada
- ✅ **Sistema Pomodoro**: Timer integrado com estados avançados e configurações flexíveis
- ✅ **Alertas Multimodais**: Sistema visual (10 estados) e sonoro (4 temas musicais)
- ✅ **Interface Avançada**: Painel responsivo com filtros interativos em tempo real
- ✅ **Arquitetura Modular**: 7 módulos especializados com testes abrangentes
- ✅ **Modal System**: Infraestrutura completa para alertas e configurações
- ✅ **Status Bar Inteligente**: Integração visual com estados do Pomodoro
- ✅ **Identidade Visual**: Logo profissional e design consistente

### 🚧 **Em Desenvolvimento**
- 🔄 **Sincronização Cloud**: Integração com API backend para dados na nuvem
- 🔄 **Dashboard Web**: Interface web para visualização avançada de dados
- 🔄 **Relatórios Avançados**: Análises de produtividade e insights de tempo
- 🔄 **Configurações Avançadas**: Interface visual para todas as configurações

### 📅 **Próximas Versões**
- 🛒 **Marketplace**: Publicação oficial no VS Code Marketplace
- 🔄 **Auto-Update**: Sistema de atualizações automáticas
- 📊 **Analytics**: Métricas de uso e performance
- 🔌 **API Externa**: Integração com ferramentas de terceiros
- 📱 **Mobile Companion**: App mobile para acompanhamento (futuro)

## 📋 Notas de Lançamento

### 🎉 **v0.2.1 - Identidade Visual e Documentação** (29/06/2025)
**🎨 Nova Identidade Visual Profissional:**
- Logo criada com IA representando tempo (relógio laranja) e código (chevron azul)
- Documentação completa da identidade visual em `IDENTIDADE_VISUAL.md`
- Integração da logo no README.md e package.json com apresentação aprimorada
- Descrição mais detalhada e atrativa seguindo padrão SemVer

### 🚀 **v0.2.0 - Arquitetura Modular e Interface Avançada** (28/06/2025)
**🏗️ Refatoração Completa da Arquitetura:**
- **7 Módulos Especializados**: config, database, statusBar, stats, timeTrace, commands, modal
- **Sistema de UI Separado**: Pasta `ui/` com componentes de interface especializados
- **Arquitetura Singleton**: Gerenciamento global de recursos e estados

**📊 Interface de Estatísticas Revolucionada:**
- **Layout Responsivo**: Design grid 40/60 com aproveitamento otimizado do espaço
- **Filtros Interativos Avançados**: Data inicial/final e seleção múltipla de projetos
- **Resumo Dinâmico**: Estatísticas em tempo real dos dados filtrados
- **Header Fixo**: Navegação sempre visível durante scroll
- **Projetos Expansíveis**: Interface colapsável para organização visual otimizada

**🍅 Sistema Pomodoro Completo:**
- **PomodoroManager**: Core completo com 6 estados (INACTIVE, FOCUS, FOCUS_PAUSED, SHORT_BREAK, LONG_BREAK, BREAK_EXTENDED)
- **Configurações Flexíveis**: Duração personalizável, auto-start, metas diárias
- **Timers Integrados**: Foco, pausa e inatividade com detecção automática
- **Comandos VSCode**: Start, pause, stop com integração total ao sistema existente

**🎨 Sistema de Alertas Multimodal:**
- **Alertas Visuais**: 10 estados com 4 temas (Produtividade, Escuro, Alto Contraste, Minimalista)
- **Animações Avançadas**: PULSE, FADE, BLINK, FLASH com transições suaves
- **Alertas Sonoros**: 4 temas musicais com sons sintéticos (Clássico, Moderno, Natural, Minimal)
- **Sons Harmônicos**: Geração em tempo real de acordes musicais e frequências naturais

**🔧 Melhorias Técnicas:**
- **15 Testes Automatizados**: 100% de sucesso em componentes críticos
- **Tratamento de Erros Robusto**: Verificações de segurança e async/await
- **Gestão de Recursos**: Cleanup automático e prevenção de vazamentos de memória
- **TypeScript Avançado**: Tipagem forte e interfaces bem definidas

### 🌟 **v0.1.0 - Visualização e Organização** (18/06/2025)
- Visualização hierárquica de arquivos agrupados por projeto
- Formatação inteligente de caminhos para melhor legibilidade
- Interface visual aprimorada com seções colapsáveis
- Correção do conflito "command already exists" nos testes
- Sistema de registro seguro de comandos

### 🎯 **v0.0.1 - Lançamento Inicial** (31/05/2025)
- Monitoramento automático de tempo por arquivo usando SQLite
- Detecção de inatividade inteligente (5 minutos)
- Rastreamento organizado por projeto e workspace
- Status Bar com exibição em tempo real
- Persistência local robusta e baixo consumo de recursos

## 🧪 Qualidade e Confiabilidade

### 📊 **Cobertura de Testes Excepcional**
- ✅ **15 testes automatizados** (100% de sucesso)
- ✅ **Funcionalidades críticas** testadas completamente
- ✅ **7 módulos testados** diretamente + 2 indiretamente
- ✅ **Testes abrangentes** incluindo:
  - Ativação/desativação da extensão
  - Rastreamento de tempo e detecção de idle
  - Persistência SQLite com consultas complexas
  - Interface status bar em tempo real
  - Painel de estatísticas com filtros
  - Sistema Pomodoro completo
  - Tratamento de erros e edge cases
  - Integração entre módulos

### 🏗️ **Arquitetura Enterprise**
```
src/
├── modules/                    # 🧩 Módulos especializados
│   ├── timeTrace.ts           # ⏱️ Engine de rastreamento
│   ├── database.ts            # 💾 Gerenciamento SQLite  
│   ├── statusBar.ts           # 📊 Interface status bar
│   ├── pomodoro.ts            # 🍅 Sistema Pomodoro
│   ├── visualEffectsManager.ts # 🎨 Alertas visuais
│   ├── stats.ts               # 📈 Painel de estatísticas
│   ├── commands.ts            # ⌨️ Comandos da extensão
│   ├── config.ts              # ⚙️ Configurações
│   └── modal.ts               # 🔲 Sistema de modais
├── ui/                        # 🎨 Componentes de interface
│   ├── statsPanel.ts          # 📊 Interface de estatísticas
│   └── modal-styles.css       # 🎨 Estilos de modais
└── test/                      # 🧪 Testes automatizados
    ├── extension.test.ts      # 🔧 Testes principais
    └── modal-system.test.ts   # 🔲 Testes de modais
```

### 🔧 **Qualidade Técnica**
- **TypeScript 5.0+**: Tipagem forte e interfaces bem definidas
- **Async/Await**: Tratamento moderno de operações assíncronas
- **Error Handling**: Captura e tratamento robusto de exceções
- **Resource Management**: Cleanup automático e prevenção de memory leaks
- **Singleton Pattern**: Gerenciamento global de estados e recursos
- **Modular Design**: Separação clara de responsabilidades

### 📈 **Performance**
- **Baixo Consumo**: Opera silenciosamente sem impactar performance
- **SQLite Otimizado**: Consultas indexadas e transações eficientes
- **Timers Inteligentes**: Detecção de idle e cleanup automático
- **UI Responsiva**: Interface fluida com animações otimizadas

Para detalhes completos dos testes, consulte a documentação técnica do projeto.

---

## 🚀 Desenvolvimento e Contribuição

### 🛠️ **Setup de Desenvolvimento**
```bash
# Clone e instale dependências
git clone https://github.com/user/MyTimeTraceVSCode.git
cd MyTimeTraceVSCode && npm install

# Desenvolvimento ativo
npm run watch          # Compilação automática
npm run test           # Executar testes
npm run lint           # Verificar código

# Build e distribuição
npm run compile        # Compilar TypeScript
npm run package        # Gerar VSIX para distribuição
```

### 🧪 **Executar Testes**
```bash
npm test              # Todos os testes
npm run test:watch    # Modo watch para desenvolvimento
```

### 🤝 **Como Contribuir**
1. **Fork** o repositório e clone localmente
2. **Branch**: Crie uma branch descritiva (`git checkout -b feature/nova-funcionalidade`)
3. **Desenvolva**: Implemente seguindo os padrões do projeto
4. **Teste**: Execute `npm test` e garanta 100% de sucesso
5. **Commit**: Use mensagens descritivas (`git commit -m 'feat: adiciona nova funcionalidade'`)
6. **Push**: Envie para seu fork (`git push origin feature/nova-funcionalidade`)
7. **PR**: Abra um Pull Request detalhado

### 🏷️ **Tecnologias Utilizadas**
- **Core**: TypeScript 5.0+, VS Code Extension API 1.100+
- **Database**: SQLite3 com persistência local
- **UI**: HTML5, CSS3 com variáveis de tema VSCode
- **Áudio**: Web Audio API para sons sintéticos
- **Testes**: Jest framework com mocks especializados
- **Build**: npm scripts com TypeScript compiler

### 📄 **Licença**
Este projeto está licenciado sob a **Licença MIT** - veja o arquivo [LICENSE](LICENSE) para detalhes completos.

---

<div align="center">

**🕒 Aproveite o My Time Trace VSCode e transforme seu tempo de desenvolvimento em insights de produtividade!**

[![Instalar](https://img.shields.io/badge/Instalar-Agora-blue.svg)](#-instalação-e-configuração)
[![Documentação](https://img.shields.io/badge/Docs-Completa-green.svg)](#-qualidade-e-confiabilidade)
[![Suporte](https://img.shields.io/badge/Suporte-GitHub-orange.svg)](https://github.com/user/MyTimeTraceVSCode/issues)

</div>
