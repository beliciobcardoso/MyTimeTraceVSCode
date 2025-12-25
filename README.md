# My Time Trace VSCode (v0.5.0)

<div align="center">
<img src="images/my-time-trace-logo.png" alt="My Time Trace Logo" width="400" height="400"/>

[![Status](https://img.shields.io/badge/Status-Beta-orange?style=flat-square)]()
[![Coverage](https://img.shields.io/badge/Coverage-88%25-brightgreen?style=flat-square)]()
[![Tests](https://img.shields.io/badge/Tests-21%20passing-brightgreen?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square)]()
[![Version](https://img.shields.io/badge/Version-0.5.0-blue?style=flat-square)]()

</div>

Uma extensão para o Visual Studio Code que monitora automaticamente o tempo gasto em cada arquivo e projeto, permitindo que você acompanhe suas atividades de desenvolvimento com um dashboard moderno, filtros avançados e **sincronização em nuvem**!

## ✨ Funcionalidades

### 🕐 Monitoramento Inteligente
- **Rastreamento Automático**: Registra tempo por arquivo em tempo real
- **Detecção de Inatividade**: Pausa automática após 5 minutos de idle
- **Organização por Projeto**: Agrupa dados por workspace/projeto
- **Persistência Local**: Armazena dados em SQLite seguro
- **Identificação de Dispositivo**: Registra nome do computador para cada rastreamento
- **Sistema de Exclusão com Histórico**: Soft delete, hard delete automático (>30 dias), e restauração

### ☁️ Sincronização em Nuvem (NOVO v0.5.0)
- **Sync Bidirecional**: Push/Pull automático entre dispositivos
- **Configuração Dinâmica**: Backend controla `batchLimit`, `syncTimes`, `maxRetries` e `retryDelayMs`
- **Loop Automático**: Processa TODAS entries pendentes em um único comando
- **Retry Inteligente**: Até 5 tentativas com delay configurável (padrão: 10s)
- **Persistência de Config**: Configs salvas localmente para uso offline
- **Auto-Sync**: Sincronização automática em horários configuráveis
- **Status Visual**: Ícone animado na status bar durante sincronização
- **Multi-Dispositivo**: Sincronize entre Windows, Linux e macOS

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
- **Performance Otimizada**: Redução de ~600 linhas de código unnecessary
- **Cores Consistentes**: Mesma cor para cada projeto independente de filtros

## Como Funciona

1. A extensão começa a monitorar automaticamente quando o VS Code é iniciado
2. Registra o tempo que você passa em cada arquivo
3. Detecta quando você muda de arquivos ou projetos
4. Registra períodos de inatividade para melhorar a precisão dos dados
5. Armazena todos os dados localmente para acesso posterior
6. Oferece visualização unificada com filtros interativos para análise detalhada
7. Permite exclusão segura de projetos com histórico completo de restauração

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

No momento, esta extensão está em desenvolvimento e não está disponível no VS Code Marketplace. Para instalá-la:

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
code --install-extension my-time-trace-vscode-0.5.0.vsix
```

#### Opção 3: Pelo Terminal (VS Code Insiders)

```bash
# Para o VS Code Insiders
code-insiders --install-extension my-time-trace-vscode-0.5.0.vsix
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

- `myTimeTraceVSCode.idleTimeout`: Define o tempo (em minutos) para considerar o usuário como inativo. Padrão: 5 minutos.
- `myTimeTraceVSCode.autoStart`: Ativa/desativa o início automático do monitoramento quando o VS Code é iniciado. Padrão: ativado.
- `myTimeTraceVSCode.showInStatusBar`: Controla a exibição do tempo atual na barra de status. Padrão: ativado.

## Melhorias Planejadas

- ✅ **Status Bar Item**: Mostrar o tempo atual do arquivo ou o status do monitoramento na barra de status do VS Code.
- ❌ **Heartbeat**: Implementar "heartbeats" periódicos para uma contagem de tempo mais precisa.
- ✅ **Interface de Visualização**: Adicionar painéis e gráficos para visualizar os dados de tempo coletados.
- ❌ **Exportação de Dados**: Permitir a exportação dos dados em diferentes formatos.
- ❌ **Tratamento de Erros**: Melhora o tratamento de erros de rede e outras exceções.
- ❌ **Autenticação**: Planeja-se implementar um método de autenticação (como API Key) para permitir a sincronização segura dos dados com um servidor externo em versões futuras.
- ✅ **Separação de responsabilidades**: O arquivo extension.ts contém toda a lógica, poderia ser dividido em módulos
- ✅ **Melhor tratamento de erros**: Adicionar tratamento de exceções mais robusto (implementado safeRegisterCommand)
- ✅ **Visualização de dados**: Implementar painéis organizados na pasta `ui/` para visualizar as estatísticas de tempo por projeto
- ✅ **Status Bar interativa**: Melhorar a interação com o usuário através da barra de status

## Notas de Lançamento

### 0.2.0 - Beta (28/06/2025)

Terceira versão com refatoração completa e interface avançada:

**Arquitetura Modular:**
- Separação de responsabilidades em módulos específicos
- Módulos especializados: configuração, banco de dados, status bar, estatísticas, rastreamento e comandos
- Melhor organização do código com classes especializadas
- Tratamento de erros aprimorado com async/await
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

## Como Contribuir

Contribuições são bem-vindas! Se você tem alguma sugestão ou encontrou um bug:

1. Faça um fork deste repositório
2. Crie uma branch com sua feature ou correção (`git checkout -b minha-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona uma nova feature'`)
4. Push para a branch (`git push origin minha-feature`)
5. Abra um Pull Request

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

## Desenvolvimento

Para iniciar o desenvolvimento:

```bash
# Instalar dependências
npm install

# Compilar a extensão em modo de desenvolvimento
npm run compile

# Compilar e observar mudanças
npm run watch
```

Para testar a extensão:

1. Pressione F5 no VS Code para iniciar uma nova janela com a extensão carregada
2. A extensão deve iniciar automaticamente e começar a monitorar seu tempo

Para executar os testes:

```bash
# Executar todos os testes
npm test

# Verificar cobertura de testes  
npm run test:coverage
```

📖 **Mais informações:** Consulte a [documentação completa](./docs/) para guias detalhados de desenvolvimento, design e arquitetura.

## Qualidade e Confiabilidade

### 🧪 Testes Automatizados
A extensão possui uma **excelente cobertura de testes** com **15 testes automatizados** que garantem a qualidade e confiabilidade:

- ✅ **15 testes passando** (100% de sucesso)
- ✅ **~90% de cobertura** das funcionalidades críticas
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
