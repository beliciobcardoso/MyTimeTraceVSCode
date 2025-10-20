# MyTimeTrace VSCode - Instruções do Repositório

## Visão Geral do Projeto

O **MyTimeTrace VSCode** é uma extensão profissional para Visual Studio Code que implementa um sistema avançado de rastreamento de tempo de desenvolvimento com funcionalidades de produtividade Pomodoro. A extensão monitora automaticamente o tempo gasto em cada arquivo e projeto, oferecendo insights detalhados sobre a atividade de desenvolvimento.

**Status Atual:** v0.2.1 (Beta) - Arquitetura Modular Consolidada
**Arquitetura:** Enterprise-grade com 88% cobertura de testes
**Linguagem Principal:** TypeScript com SQL (SQLite)

## Funcionalidades Core

### 🏗️ Arquitetura Modular Enterprise
- **7 Módulos Especializados:** timeTrace, database, statusBar, stats, commands, config, modal
- **Padrão Singleton:** Gerenciamento global de estado e recursos
- **Sistema UI Separado:** Componentes especializados em `src/ui/`
- **Testes Robustos:** 15 testes passando com cobertura de 88%

### ⏱️ Sistema de Rastreamento Inteligente
- **Monitoramento Automático:** Detecção de atividade em tempo real
- **Gestão de Idle Time:** Detecção de inatividade após 5min configuráveis
- **Persistência SQLite:** Banco local com queries otimizadas
- **StatusBar Integrada:** Feedback visual constante

### 📊 Dashboard Moderno e Responsivo
- **Interface Responsiva:** Layout grid 40/60 otimizado
- **Filtros Avançados:** Data inicial/final e seleção múltipla de projetos
- **Gráficos Donut Interativos:** Canvas HTML5 com paleta de cores profissional
- **Projetos Expansíveis:** Interface colapsável para organização visual

### 🍅 Sistema Pomodoro Integrado (85% Implementado)
- **6 Estados Operacionais:** Idle, Focus, Break, Paused, Complete, Alert
- **Alertas Visuais Avançados:** 4 temas visuais com animações profissionais
- **Sistema de Modais:** Base robusta para interfaces de usuário
- **Sons WAV Reais:** 13 arquivos musicais com acordes harmônicos

## Estrutura de Diretórios

```
src/
├── extension.ts              # 🚪 Ponto de entrada principal
├── modules/                  # 🧩 Módulos especializados
│   ├── timeTrace.ts         # ⏱️ Engine de rastreamento core
│   ├── database.ts          # 💾 Gerenciamento SQLite robusto
│   ├── statusBar.ts         # 📊 Interface barra de status
│   ├── stats.ts            # 📈 Geração de relatórios
│   ├── commands.ts          # ⌨️ Registro de comandos
│   ├── config.ts           # ⚙️ Configurações de usuário
│   ├── modal.ts            # 🔲 Sistema de modais base
│   ├── pomodoro.ts         # 🍅 Sistema Pomodoro (85%)
│   └── visualEffectsManager.ts # 🎨 Alertas visuais
├── ui/                      # 🎨 Componentes de interface
│   ├── statsPanel.ts       # 📊 Painel de estatísticas
│   ├── modal-styles.css    # 🎨 Estilos de modais
│   └── README.md           # 📖 Documentação UI
└── test/                   # 🧪 Suíte de testes
    ├── extension.test.ts   # ✅ Testes principais (1625 linhas)
    └── tarefa1.3.test.ts  # ✅ Testes específicos Pomodoro
```

## Padrões de Codificação

### Convenções TypeScript
- **Sintaxe Moderna:** async/await, destructuring, template literals
- **Tipagem Estrita:** Interfaces bem definidas para todos os contratos
- **Classes Singleton:** Para gerenciadores globais (ModalManager, etc.)
- **Error Handling:** try/catch robusto com logs detalhados

### Convenções de Nomenclatura
- **Classes:** PascalCase (`DatabaseManager`, `StatusBarManager`)
- **Métodos/Funções:** camelCase (`startTracking()`, `showStats()`)
- **Constantes:** UPPER_SNAKE_CASE (`IDLE_TIMEOUT`, `DEFAULT_CONFIG`)
- **Arquivos:** camelCase para modules, kebab-case para CSS

### Estrutura de Módulos
- **Exports Named:** Preferir exports nomeados sobre default
- **Barrel Files:** `index.ts` para centralizar exports
- **Interface First:** Definir interfaces antes das implementações
- **Dependency Injection:** Injeção via constructor

## Tecnologias e Dependências

### Core Dependencies
- **VSCode API:** v1.100.0+ (engine)
- **SQLite3:** v5.1.6 (persistência)
- **TypeScript:** Compilação e tipagem

### Dev Dependencies
- **Mocha/Sinon:** Framework de testes robusto
- **ESLint:** Linting com @typescript-eslint
- **vscode-test:** Ambiente de teste integrado

### Ferramentas de Build
- **tsc:** Compilador TypeScript configurado
- **vsce:** Empacotamento para marketplace
- **npm scripts:** Automação de build/test/watch

## Padrões de Interface

### Design System
- **Variáveis CSS VSCode:** Integração completa com temas
- **Layout Responsivo:** CSS Grid com fallbacks flexbox
- **Animações Suaves:** Transições de 0.2s para feedback
- **Acessibilidade:** ARIA labels e navegação por teclado

### Componentes UI
- **StatsPanel:** Geração dinâmica de HTML/CSS/JS
- **Modal System:** Base reutilizável para interfaces
- **StatusBar Integration:** Feedback visual constante
- **Theme Adaptation:** Dark/Light mode automático

### ⚠️ REGRA CRÍTICA: Modais e Confirmações
**NUNCA use `confirm()`, `alert()` ou `prompt()` em webviews!**

- ❌ **PROIBIDO:** `confirm()`, `alert()`, `prompt()` - Bloqueados por sandbox do VS Code
- ✅ **CORRETO - Frontend:** Crie modais customizados em HTML/CSS/JS dentro do webview
- 📋 **Fluxo:** Frontend envia `postMessage` → Backend confirma com modal nativo → Executa ação

**Motivo:** VS Code webviews são sandboxed e bloqueiam `confirm()`/`alert()` por segurança.
Erro típico: `"Ignored call to 'confirm()'. The document is sandboxed"`

## Sistema de Qualidade

### Cobertura de Testes
- **15 Testes Implementados:** 100% passando
- **88% Cobertura Geral:** Todos os módulos core testados
- **Testes de Integração:** extension.test.ts (1625 linhas)
- **Testes Específicos:** Pomodoro e eventos automáticos

### Métricas de Qualidade
- **Zero Testes Falhando:** Base sólida e confiável
- **Cleanup Automático:** Prevenção de vazamentos de memória
- **Error Handling:** Tratamento robusto de exceções
- **Performance:** Operações não-bloqueantes

## Funcionalidades em Desenvolvimento

### Sistema Pomodoro (85% Completo)
- ✅ **Core Engine:** 6 estados operacionais
- ✅ **Integração Completa:** timeTrace + StatusBar
- ✅ **Alertas Visuais:** 4 temas com animações
- ✅ **Sistema Modal:** Base para interfaces
- ⏳ **Modais de Interface:** Alertas de fim de foco
- ⏳ **Configurações Avançadas:** Interface de customização

### Recursos Planejados
- **Exportação de Dados:** CSV, JSON para análise externa
- **Sincronização Cloud:** Backup opcional de dados
- **Relatórios Avançados:** Analytics de produtividade
- **Integração Git:** Correlação com commits

## Comandos Implementados

### Comandos Principais
- `my-time-trace-vscode.startTracking` - Inicia rastreamento
- `my-time-trace-vscode.pauseTracking` - Pausa rastreamento  
- `my-time-trace-vscode.showStats` - Exibe estatísticas

### Configurações Disponíveis
- `myTimeTraceVSCode.idleTimeout` - Timeout de inatividade (5min)
- `myTimeTraceVSCode.autoStart` - Início automático (true)
- `myTimeTraceVSCode.showInStatusBar` - Exibição na status bar (true)

## Práticas de Desenvolvimento

### Workflow Recomendado
1. **Análise de Requisitos:** Entender contexto antes de implementar
2. **Testes First:** Escrever testes antes da implementação
3. **Modularidade:** Manter responsabilidades bem separadas
4. **Documentação:** Comentários JSDoc para APIs públicas

### Debugging e Logs
- **Console Logs Estruturados:** Prefixos emoji para categorização
- **Error Tracking:** Stack traces completos em desenvolvimento
- **Performance Monitoring:** Métricas de operações críticas

## Identidade Visual

### Logo e Branding
- **Logo Principal:** Relógio laranja + chevron azul (tempo + código)
- **Cores Primárias:** Laranja (#F5A623) energia, Azul (#4A90E2) tecnologia
- **Design Philosophy:** Profissional, clean, integração VS Code

### Paleta de Cores (Dashboard)
- **Projetos:** 7 cores harmônicas rotativas
- **Estados Visuais:** Mapeamento semântico (verde sucesso, vermelho erro)
- **Temas Suportados:** Dark, Light, High Contrast, Minimal

---

**Nota Importante:** Este projeto segue padrões enterprise com foco em qualidade, modularidade e experiência do usuário. Sempre considere o impacto na performance e mantenha a compatibilidade com versões anteriores do VS Code.
