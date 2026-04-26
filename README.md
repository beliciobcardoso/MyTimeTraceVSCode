# My Time Trace VSCode (v0.5.4)

<div align="center">
<img src="images/my-time-trace-logo.png" alt="My Time Trace Logo" width="400" height="400"/>

[![Status](https://img.shields.io/badge/Status-Published-green?style=flat-square)]()
[![Coverage](https://img.shields.io/badge/Coverage-88%25-brightgreen?style=flat-square)]()
[![Tests](https://img.shields.io/badge/Tests-21%20passing-brightgreen?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?style=flat-square)]()
[![Version](https://img.shields.io/badge/Version-0.5.4-blue?style=flat-square)]()

</div>

Uma extensão para o Visual Studio Code que monitora automaticamente o tempo gasto em cada arquivo e projeto, permitindo que você acompanhe suas atividades de desenvolvimento com um dashboard moderno, filtros avançados e **envio em nuvem**. A versão publicada no Marketplace já está disponível para instalação direta.

✅ **Disponível no VS Code Marketplace:** https://marketplace.visualstudio.com/items?itemName=BelicioBCardoso.my-time-trace-vscode

## ✨ Funcionalidades

### 🕐 Monitoramento Inteligente
- **Rastreamento Automático**: Registra tempo por arquivo em tempo real
- **Detecção de Inatividade**: Pausa automática após 5 minutos de idle
- **Organização por Projeto**: Agrupa dados por workspace/projeto
- **Persistência Local**: Armazena dados em SQLite seguro
- **Identificação de Dispositivo**: Registra nome do computador para cada rastreamento
- **Sistema de Exclusão com Histórico**: Soft delete, hard delete automático (>30 dias), e restauração

### ☁️ Sincronização em Nuvem (NOVO v0.5.3)
- **Sync Unidirecional**: Push automático da extensão para a cloud
- **Configuração Dinâmica**: Backend controla `batchLimit`, `syncTimes`, `maxRetries` e `retryDelayMs`
- **Loop Automático**: Processa TODAS entries pendentes em um único comando
- **Retry Inteligente**: Até 5 tentativas com delay configurável (padrão: 10s)
- **Persistência de Config**: Configs salvas localmente para uso offline
- **Auto-Sync**: Sincronização automática em horários configuráveis
- **Status Visual**: Ícone animado na status bar durante sincronização
- **Multi-Dispositivo**: Cada device envia seu próprio histórico para a cloud

> A partir da versão 0.5.2, o sync da extensão é unidirecional (ext -> cloud).

### 📊 Dashboard Moderno Unificado
- **Interface Responsiva**: Layout grid 40/60 otimizado
- **Filtros Integrados**: Por data (inicial/final) e múltiplos projetos
- **Gráfico Donut Interativo**: Visualização com tooltips e atualização dinâmica
- **Tabela Expansível**: Projetos com detalhes expansíveis e ordenação por coluna
- **Cards de Estatísticas**: Total, Hoje, Arquivos, Esta Semana em tempo real
- **Paleta de 50 Cores**: Distinção visual clara entre projetos

### 🎨 Interface Integrada
- **Status Bar Interativa**: Feedback visual constante
- **Formatação Inteligente**: Caminhos de arquivo legíveis
- **Tema Adaptativo**: Suporte a dark/light mode
- **Performance Otimizada**: Redução de ~600 linhas de código desnecessárias
- **Cores Consistentes**: Mesma cor para cada projeto independente de filtros

## Como Funciona

1. A extensão começa a monitorar automaticamente quando o VS Code é iniciado
2. Registra o tempo que você passa em cada arquivo
3. Detecta quando você muda de arquivos ou projetos
4. Registra períodos de inatividade para melhorar a precisão dos dados
5. Armazena todos os dados localmente para acesso posterior
6. Oferece visualização unificada com filtros interativos para análise detalhada
7. Permite exclusão segura de projetos com histórico completo de restauração

## 🔬 Fisiologia da Extensão

### Arquitetura Interna

A extensão utiliza uma **arquitetura modular enterprise** com separação clara de responsabilidades:

- **Timer Heartbeat**: Pulso de 1 segundo para contagem precisa em tempo real
- **Event Listeners**: Monitora mudanças de arquivos, janelas e atividade do usuário
- **Database Layer**: Camada de persistência com SQLite para armazenamento local
- **UI Components**: Webviews com HTML/CSS/JS para dashboards interativos
- **Sync Manager**: Sistema de sincronização com retry inteligente e auto-sync

### 💾 Armazenamento de Dados

Os dados são persistidos localmente em um banco **SQLite** seguro e ficam sob o armazenamento global do VS Code, o que facilita backup, inspeção e limpeza quando necessário:

**Linux:**
```
~/.config/Code/User/globalStorage/<your-username>.my-time-trace-vscode/time_tracker.sqlite
```

**macOS:**
```
~/Library/Application Support/Code/User/globalStorage/<your-username>.my-time-trace-vscode/time_tracker.sqlite
```

**Windows:**
```
%APPDATA%\Code\User\globalStorage\<your-username>.my-time-trace-vscode\time_tracker.sqlite
```

**VS Code Insiders:**
Substitua `Code` por `Code - Insiders` nos caminhos acima.

### 📊 Estrutura do Banco de Dados

**Tabela `time_entries`** - Registros de rastreamento de tempo:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | Chave primária auto-incremento |
| `timestamp` | TEXT | Data/hora ISO 8601 do registro |
| `project` | TEXT | Nome do projeto/workspace |
| `file` | TEXT | Caminho completo do arquivo |
| `duration_seconds` | INTEGER | Duração em segundos |
| `is_idle` | INTEGER | 1 = período inativo, 0 = ativo |
| `synced` | INTEGER | 1 = sincronizado na nuvem, 0 = local |
| `deleted_at` | TEXT | Timestamp do soft delete (NULL = ativo) |
| `device_name` | TEXT | Nome do dispositivo/computador |

**Tabela `deletion_history`** - Histórico de exclusões e restaurações:
- Registro completo de soft/hard deletes
- Permite restauração de projetos excluídos
- Auditoria de operações de exclusão

**Índices otimizados**: Queries rápidas para filtros por projeto, data e dispositivo

### 🔄 Ciclo de Vida

1. **Ativação**: Inicializa DB, cria listeners, inicia heartbeat
2. **Monitoramento**: Timer incrementa 1s, detecta idle após 5min
3. **Salvamento**: Persiste dados a cada mudança de arquivo ou idle
4. **Sincronização**: Auto-sync em horários configuráveis (se habilitado)
5. **Desativação**: Cleanup de recursos, fecha DB, cancela timers

## Requisitos

- Visual Studio Code 1.100.0 ou superior

## 📖 Documentação

Para documentação detalhada, consulte a pasta [`docs/`](./docs/):

- 🎨 **[Identidade Visual](./docs/IDENTIDADE_VISUAL.md)** - Logo, cores e design system
- 📊 **[Dashboard Moderno](./docs/DASHBOARD_MODERNO.md)** - Interface responsiva e funcionalidades
- 🧩 **[Componentes UI](./docs/UI_COMPONENTS.md)** - Documentação dos componentes de interface
- ✅ **[Relatório de Cobertura](./docs/COVERAGE_REPORT.md)** - Métricas de qualidade e testes (88%)
- 🚀 **[Guia de Desenvolvimento](./docs/vsc-extension-quickstart.md)** - Setup e desenvolvimento

## 📦 Instalação

Você pode instalar de duas formas: via **Marketplace** (recomendado) ou via **VSIX local** para desenvolvimento.

### Opção 1 (Recomendado): Instalar pelo Marketplace

```bash
ext install BelicioBCardoso.my-time-trace-vscode
```

Ou acesse diretamente:

https://marketplace.visualstudio.com/items?itemName=BelicioBCardoso.my-time-trace-vscode

### Opção 2 (Desenvolvimento): Instalação local via VSIX

### Passo 1: Preparar o Ambiente

```bash
# Clone o repositório
git clone https://github.com/beliciobcardoso/MyTimeTraceVSCode.git
cd MyTimeTraceVSCode

# Instale as dependências
npm install

# Compile o TypeScript
npm run compile
```

### Passo 2: Instalar a Ferramenta de Empacotamento

```bash
# Instale o vsce globalmente
npm install -g @vscode/vsce
```

### Passo 3: Empacotar a Extensão

```bash
# Gera o arquivo .vsix
vsce package
```

Este comando irá gerar um arquivo como `my-time-trace-vscode-X.X.X.vsix`.

### Passo 4: Instalar no VS Code

Após gerar o pacote, você pode instalá-lo de **três maneiras**:

#### Opção 1: Pela Interface do VS Code (Recomendado)

1. Abra o VS Code (ou VS Code Insiders)
2. Vá para a visualização de **Extensões** (`Ctrl+Shift+X` ou `Cmd+Shift+X`)
3. Clique nos três pontos (`...`) no canto superior da visualização
4. Selecione **Instalar do VSIX...**
5. Navegue e selecione o arquivo `.vsix` gerado

#### Opção 2: Pelo Terminal (VS Code)

```bash
# Para o VS Code normal
code --install-extension my-time-trace-vscode-0.5.4.vsix
```

#### Opção 3: Pelo Terminal (VS Code Insiders)

```bash
# Para o VS Code Insiders
code-insiders --install-extension my-time-trace-vscode-0.5.4.vsix
```

> **Nota para VS Code Insiders no Linux:** Se o comando `code-insiders` não for encontrado, use a **Opção 1** (instalação pela interface).

### Passo 5: Ativar a Extensão

Depois de instalar, o VS Code solicitará que você **recarregue a janela** para ativar a extensão. Você também pode:

- Pressionar `Ctrl+Shift+P` (ou `Cmd+Shift+P`) e executar **Developer: Reload Window**
- Fechar e reabrir o VS Code

### ✅ Verificar Instalação

Após recarregar, você deve ver:
- Ícone do relógio na barra de status inferior
- Comando disponível: `My Time Trace: Show Statistics`

## Configurações da Extensão

As seguintes configurações já estão disponíveis:

- `myTimeTraceVSCode.idleTimeout`: Define o tempo, em minutos, para considerar o usuário como inativo. Padrão: 5 minutos.
- `myTimeTraceVSCode.autoStart`: Ativa ou desativa o início automático do monitoramento quando o VS Code é iniciado. Padrão: ativado.
- `myTimeTraceVSCode.showInStatusBar`: Controla a exibição do tempo atual na barra de status. Padrão: ativado.
- `myTimeTraceVSCode.syncEnabled`: Ativa ou desativa a sincronização automática em nuvem. Requer API Key. Padrão: ativado.
- `myTimeTraceVSCode.syncInterval`: Intervalo de verificação do auto-sync, em minutos. Padrão: 60, com mínimo de 5 e máximo de 1440.

## Recursos e Próximos Passos

### ✅ Recursos já entregues

- **Status Bar Item**: Mostra o tempo atual do arquivo e o estado do monitoramento na barra de status do VS Code.
- **Heartbeat**: Timer de 1 segundo para contagem precisa e atualização em tempo real.
- **Interface de Visualização**: Painéis e gráficos para analisar os dados de tempo coletados.
- **Separação de responsabilidades**: Arquitetura modular com módulos especializados.
- **Tratamento de erros**: Fluxos com `async/await` e registro seguro de comandos.
- **Visualização de dados**: Dashboard unificado com filtros e gráficos interativos.
- **Status Bar interativa**: Feedback visual constante com atualização em tempo real.
- **Sincronização em Nuvem**: push-only com retry inteligente e auto-sync.

### ⏭️ Próximos passos considerados

- **Exportação de Dados**: Exportar os dados em formatos como CSV, JSON e Excel.
- **Relatórios Personalizados**: Criar relatórios customizáveis por período e projeto.
- **Integração Git**: Correlacionar tempo de desenvolvimento com commits.

## Desenvolvimento

Se você quiser contribuir, esta é a trilha recomendada para trabalhar no projeto localmente com segurança e sem perder o contexto da base atual.

### Ambiente de Desenvolvimento

```bash
# Instalar dependências
npm install

# Compilar a extensão em modo de desenvolvimento
npm run compile

# Compilar e observar mudanças durante o desenvolvimento
npm run watch
```

### Execução e Validação Local

1. Pressione F5 no VS Code para abrir uma nova janela com a extensão carregada.
2. A extensão deve iniciar automaticamente e começar a monitorar seu tempo.
3. Para testar manualmente, use os comandos da paleta do VS Code e valide o fluxo de tracking, dashboard e sync.
4. Para verificação de qualidade, rode os testes com `npm test`.

### Empacotamento para Teste Local

```bash
# Gera o arquivo .vsix
vsce package
```

Esse comando gera um arquivo como `my-time-trace-vscode-X.X.X.vsix`, que pode ser instalado localmente em outra máquina ou ambiente de teste.

### Como Contribuir

1. Faça um fork deste repositório.
2. Crie uma branch para sua alteração: `git checkout -b minha-feature`.
3. Faça os commits da sua mudança com mensagens objetivas.
4. Execute `npm run compile` e `npm test` antes de abrir o PR.
5. Envie a branch e abra um Pull Request.

### Observações para Contribuição

- O código está organizado em módulos; prefira alterar a responsabilidade correta em vez de concentrar lógica em `extension.ts`.
- Toda persistência deve continuar passando por `DatabaseManager`.
- Se a mudança afetar UI, revise também os documentos de `docs/DASHBOARD_MODERNO.md` e `docs/UI_COMPONENTS.md`.

## Notas de Lançamento

### 0.2.0 - Beta (28/06/2025)

Terceira versão com refatoração completa e interface avançada:

**Arquitetura Modular:**
- Separação de responsabilidades em módulos específicos
- Módulos especializados: configuração, banco de dados, status bar, estatísticas, rastreamento e comandos
- Melhor organização do código com classes especializadas
- **Sistema Heartbeat**: Timer de 1 segundo para contagem precisa e atualização em tempo real
- **Tratamento de erros robusto**: safeRegisterCommand com async/await para operações assíncronas
- Refatoração completa do arquivo extension.ts para usar arquitetura modular

**Interface de Estatísticas Avançada:**
- **Layout Responsivo**: Design em grid 40/60 com aproveitamento otimizado do espaço
- **Header Fixo**: Título sempre visível durante a navegação
- **Filtros Interativos**: Controles por data (início/fim) e seleção múltipla de projetos
- **Resumo Dinâmico**: Estatísticas em tempo real dos dados filtrados
- **Projetos Expansíveis**: Interface colapsível para melhor organização visual
- **CSS Modular**: Estilos organizados usando variáveis do tema VS Code
- **JavaScript Robusto**: Verificações de segurança e tratamento de erros

**Melhorias Técnicas:**
- Melhoria na gestão de recursos e limpeza de memória
- Melhor isolamento de responsabilidades evitando acoplamento
- Correção de bug crítico com elemento HTML ausente
- Verificações de elementos DOM antes do acesso
- Layout responsivo funcionando em diferentes tamanhos de tela
- Status Bar com feedback visual constante em tempo real

### 0.1.0 - Beta (18/06/2025)

Segunda versão com melhorias significativas:

- Visualização de estatísticas por projeto com detalhes de arquivos
- Exibição hierárquica de arquivos agrupados por projeto
- Formatação inteligente de caminhos de arquivos para melhor legibilidade
- Interface visual aprimorada para visualização dos dados coletados
- Seções de projetos colapsáveis para melhor organização das estatísticas
- Correção do problema "command already exists" nos testes
- Implementação de registro seguro de comandos para evitar conflitos
- Correção da funcionalidade de toggle para todos os projetos na visualização

### 0.0.1 - (31/05/2025)

Lançamento inicial com funcionalidades básicas:

- Monitoramento automático de tempo por arquivo
- Persistência local usando SQLite
- Detecção de inatividade após 5 minutos
- Rastreamento por projeto
- Status Bar mostrando o arquivo atual e tempo gasto

## Tecnologias Utilizadas

- TypeScript
- VS Code Extension API
- SQLite (via sqlite3)

## 🏗️ Estrutura do Projeto

```
MyTimeTraceVSCode/
├── 📁 src/                    # Código fonte principal
│   ├── extension.ts           # Ponto de entrada da extensão
│   ├── modules/              # Módulos especializados
│   │   ├── timeTrace.ts      # Engine de rastreamento
│   │   ├── database.ts       # Gerenciamento SQLite
│   │   ├── statusBar.ts      # Interface barra de status
│   │   └── ...
│   ├── ui/                   # Componentes de interface
│   └── test/                 # Testes automatizados
├── 📁 docs/                  # 📖 Documentação completa
├── 📁 images/                # Assets visuais
└── 📁 UI/                    # Demos e protótipos
```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

---

## Qualidade e Confiabilidade

### 🧪 Testes Automatizados
A extensão possui uma **excelente cobertura de testes** com **21 testes automatizados** que garantem a qualidade e confiabilidade:

- ✅ **21 testes passando**
- ✅ **88% de cobertura** das funcionalidades críticas
- ✅ **Testes abrangentes** incluindo:
  - Ativação/desativação da extensão
  - Rastreamento de tempo e detecção de idle
  - Persistência de dados no SQLite
  - Interface do status bar em tempo real
  - Painel de estatísticas com filtros
  - Tratamento de erros e edge cases
  - Integração entre módulos

### 🏗️ Arquitetura Modular
- **Separação clara de responsabilidades** com módulos especializados
- **Código TypeScript** com tipagem forte
- **Tratamento robusto de erros** com async/await
- **Cleanup automático** de recursos

Para mais detalhes, consulte o [Relatório de Cobertura de Testes](./docs/COVERAGE_REPORT.md).

**Aproveite o My Time Trace VSCode e monitore seu tempo de desenvolvimento de forma eficiente!**
