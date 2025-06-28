# UI Components

Esta pasta contém os componentes de interface do usuário da extensão My Time Trace VSCode com design responsivo e funcionalidades avançadas.

## Estrutura

### `statsPanel.ts`
Contém a classe `StatsPanel` responsável por:
- Gerar painéis webview para exibição de estatísticas
- Formatação de dados de tempo e caminhos de arquivos
- Geração de HTML, CSS e JavaScript para os painéis
- **Interface responsiva** com layout em grid (40/60)
- **Header fixo** para melhor navegação
- **Filtros interativos avançados** por data e projeto
- **Projetos expansíveis/colapsáveis** para organização visual
- **Verificações robustas** de elementos DOM no JavaScript
- **CSS modular** usando variáveis do tema VS Code

### `index.ts`
Arquivo de barrel export que centraliza as exportações da pasta UI.

## Interfaces

- `FileTimeData`: Dados de tempo para um arquivo específico
- `ProjectTimeData`: Dados de tempo para um projeto com seus arquivos
- `ProjectsData`: Coleção de todos os projetos com dados de tempo
- `TimeEntry`: Entrada individual de tempo com timestamp e metadados
- `StatsFilters`: Estrutura para filtros de data e projeto

## Funcionalidades

### Design e Layout
- **Temas VS Code**: Usa variáveis CSS do VS Code para consistência visual
- **Layout Responsivo**: Design em grid 40/60 para melhor aproveitamento do espaço
- **Header Fixo**: Título sempre visível durante o scroll
- **CSS Modular**: Estilos organizados por responsabilidade

### Interatividade
- **Projetos Expansíveis**: Clique para expandir/colapsar detalhes dos projetos
- **JavaScript Robusto**: Verificações de segurança e tratamento de erros
- **Formatação Inteligente**: Formatação de caminhos de arquivo e tempo
- **Controles Intuitivos**: Botões e inputs com feedback visual

### Filtros Avançados
- **Filtro por Data**: Intervalo com data inicial e final
- **Filtro por Projeto**: Seleção múltipla de projetos específicos
- **Aplicação em Tempo Real**: Filtros aplicados instantaneamente
- **Resumo Dinâmico**: Estatísticas atualizadas dos dados filtrados
  - Total de entradas filtradas
  - Tempo total dos dados selecionados
  - Número de projetos incluídos
- **Controles Avançados**: Botões para aplicar e limpar filtros

## Uso

### Painel Simples
```typescript
import { StatsPanel, ProjectsData } from '../ui';

const projectsData: ProjectsData = {
  'meu-projeto': {
    totalSeconds: 3600,
    files: [
      { name: 'src/index.ts', seconds: 1800 },
      { name: 'src/utils.ts', seconds: 1800 }
    ]
  }
};

const panel = StatsPanel.createStatsPanel(projectsData);
```

### Painel com Filtros Avançados
```typescript
import { StatsPanel, TimeEntry } from '../ui';

const rawData: TimeEntry[] = [
  {
    id: 1,
    timestamp: '2025-06-28T10:00:00Z',
    project: 'meu-projeto',
    file: 'src/index.ts',
    duration_seconds: 1800,
    is_idle: 0,
    synced: 0
  }
];

const availableProjects = ['meu-projeto', 'outro-projeto'];
const panel = StatsPanel.createStatsWithFiltersPanel(rawData, availableProjects);
```

### Filtragem de Dados
```typescript
import { StatsPanel, StatsFilters } from '../ui';

const filters: StatsFilters = {
  startDate: '2025-06-01',
  endDate: '2025-06-30',
  projects: ['meu-projeto'] // Opcional: filtrar projetos específicos
};

const filteredData = StatsPanel.filterData(rawData, filters);
const projectsData = StatsPanel.convertToProjectsData(filteredData);
```

## Características Técnicas

### Segurança e Robustez
- **Verificações DOM**: Todos os elementos são verificados antes do acesso
- **Tratamento de Erros**: Logs de erro em caso de elementos não encontrados
- **Fallback Gracioso**: Interface degrada graciosamente em caso de problemas

### Performance
- **CSS Otimizado**: Uso de variáveis CSS para consistência e performance
- **JavaScript Eficiente**: Event listeners otimizados e limpeza adequada
- **Layout Grid**: CSS Grid para layout responsivo sem JavaScript adicional

### Acessibilidade
- **Navegação por Teclado**: Todos os controles são acessíveis via teclado
- **Contraste Adequado**: Uso das variáveis do tema VS Code para contraste
- **Semântica HTML**: Estrutura HTML semântica para screen readers

## Arquitetura CSS

### Variáveis do Tema VS Code Utilizadas
- `--vscode-editor-background`: Cor de fundo principal
- `--vscode-editor-foreground`: Cor do texto principal
- `--vscode-button-background`: Cor de fundo dos botões
- `--vscode-input-background`: Cor de fundo dos inputs
- `--vscode-panel-border`: Cor das bordas
- `--vscode-focusBorder`: Cor de foco dos elementos

### Layout Responsivo
- **Grid Principal**: `grid-template-columns: 40% 60%` para divisão otimizada
- **Filtros**: Layout flexível com `auto-fit` e `minmax(200px, 1fr)`
- **Header Fixo**: `position: fixed` com `z-index: 1000`
- **Scroll Inteligente**: `padding-top` para compensar header fixo

## Melhorias Futuras

- Gráficos interativos
- ✅ **Filtros por data/projeto** - Implementado com interface completa
- Exportação de dados
- Dashboards customizáveis
