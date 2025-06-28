# UI Components

Esta pasta contém os componentes de interface do usuário da extensão My Time Trace VSCode.

## Estrutura

### `statsPanel.ts`
Contém a classe `StatsPanel` responsável por:
- Gerar painéis webview para exibição de estatísticas
- Formatação de dados de tempo e caminhos de arquivos
- Geração de HTML, CSS e JavaScript para os painéis
- Interface responsiva com temas do VS Code

### `index.ts`
Arquivo de barrel export que centraliza as exportações da pasta UI.

## Interfaces

- `FileTimeData`: Dados de tempo para um arquivo específico
- `ProjectTimeData`: Dados de tempo para um projeto com seus arquivos
- `ProjectsData`: Coleção de todos os projetos com dados de tempo

## Funcionalidades

- **Temas VS Code**: Usa variáveis CSS do VS Code para consistência visual
- **Interatividade**: JavaScript para expandir/colapsar seções de projetos
- **Formatação Inteligente**: Formatação de caminhos de arquivo e tempo
- **Responsividade**: Interface adaptável a diferentes tamanhos de tela

## Uso

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

## Melhorias Futuras

- Gráficos interativos
- Filtros por data/projeto
- Exportação de dados
- Dashboards customizáveis
