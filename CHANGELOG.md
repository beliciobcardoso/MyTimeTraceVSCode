# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-06-28

### Adicionado

- Separação de responsabilidades em módulos específicos
- Módulo de configuração (`config.ts`) para gerenciar configurações do usuário
- Módulo de banco de dados (`database.ts`) com classe `DatabaseManager`
- Módulo de status bar (`statusBar.ts`) com classe `StatusBarManager`
- Módulo de estatísticas (`stats.ts`) com classe `StatsManager`
- Módulo de rastreamento de tempo (`timeTrace.ts`) com classe `timeTrace`
- Módulo de comandos (`commands.ts`) com classe `CommandManager`
- **Pasta UI (`src/ui/`)** com componentes de interface separados:
  - `StatsPanel` classe para gerenciar painéis de estatísticas
  - **Filtros interativos avançados** por data e projeto nas estatísticas
  - Interface responsiva com layout em grid (40/60) para melhor usabilidade
  - Controles de filtragem em tempo real com aplicação instantânea
  - Resumo estatístico dinâmico de dados filtrados
  - Header fixo para melhor navegação
  - Projetos expansíveis/colapsáveis para organização visual
  - Verificações robustas de elementos DOM no JavaScript
  - CSS modular com variáveis do tema VS Code
  - JavaScript otimizado com tratamento de erros
- Melhor organização do código com classes especializadas
- Tratamento de erros aprimorado com async/await

### Alterado

- Refatoração completa do arquivo `extension.ts` para usar arquitetura modular
- Conversão de funções globais para classes com responsabilidades específicas
- Melhoria na gestão de recursos e limpeza de memória
- **Layout das estatísticas redesenhado** com grid responsivo
- **Interface de filtros aprimorada** com melhor UX
- Atualização da versão seguindo padrão SemVer (0.1.0 → 0.2.0)

### Corrigido

- **Bug crítico**: Elemento `resultsSummary` ausente no HTML causando erro JavaScript
- **Verificações de segurança**: Elementos DOM são verificados antes do acesso
- Melhor isolamento de responsabilidades evitando acoplamento
- Gestão mais robusta de recursos e handlers de eventos
- Correção de possíveis vazamentos de memória
- **Layout responsivo** funcionando corretamente em diferentes tamanhos de tela

## [0.1.0] - 2025-06-18

### Adicionado

- Visualização de estatísticas por projeto com detalhes de arquivos
- Exibição hierárquica de arquivos agrupados por projeto
- Formatação inteligente de caminhos de arquivos para melhor legibilidade
- Interface visual aprimorada para visualização dos dados coletados
- Seções de projetos colapsáveis para melhor organização das estatísticas

### Corrigido

- Correção do problema "command already exists" nos testes
- Melhor manuseio de caminhos de arquivo absolutos na visualização de estatísticas
- Correção da funcionalidade de toggle para todos os projetos na visualização de estatísticas

## [Planejado]

## [0.0.1] - 2025-05-31

### Adicionado

- Sistema de monitoramento automático de tempo por arquivo
- Rastreamento por projeto para organização dos dados
- Detecção de inatividade após 5 minutos
- Persistência local de dados usando SQLite
- Inicialização automática do monitoramento ao abrir o VS Code

## [Planejado]

- Interface visual para visualização dos dados
- Status Bar Item para mostrar o tempo atual do arquivo
- Implementação de "heartbeats" periódicos
- Exportação de dados
- Configurações personalizáveis
