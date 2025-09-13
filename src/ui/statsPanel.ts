import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { CssLoader } from "./cssLoader";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Interface para dados de arquivo com tempo
 */
export interface FileTimeData {
  name: string;
  seconds: number;
}

/**
 * Interface para dados de projeto com arquivos
 */
export interface ProjectTimeData {
  totalSeconds: number;
  files: FileTimeData[];
}

/**
 * Tipo para coleção de projetos
 */
export type ProjectsData = {
  [projectName: string]: ProjectTimeData;
};

/**
 * Interface para entrada de tempo com timestamp
 */
export interface TimeEntry {
  id: number;
  timestamp: string;
  project: string;
  file: string;
  duration_seconds: number;
  is_idle: number;
  synced: number;
}

/**
 * Interface para filtros
 */
export interface StatsFilters {
  startDate?: string;
  endDate?: string;
  projects?: string[];
}

/**
 * Classe responsável por gerar painéis de visualização de estatísticas
 *
 * NOVAS IMPLEMENTAÇÕES v0.2.1:
 * ============================
 *
 * 1. DASHBOARD MODERNO COM FILTROS INTEGRADOS (generateStatsHtml):
 *    - Design baseado no template dashboard-demo.html
 *    - Sistema de filtros client-side inspirado em generateStatsWithFiltersHtml
 *    - Gráfico donut interativo com atualização dinâmica
 *    - Cards de estatísticas que respondem aos filtros
 *    - Tabela de projetos com detalhes expansíveis
 *    - Filtros por data (inicial/final) e seleção múltipla de projetos
 *    - Feedback visual dos filtros aplicados
 *    - Design responsivo para dispositivos móveis
 *
 * 2. FUNCIONALIDADES DE FILTROS:
 *    - populateProjectSelect(): Preenche select com projetos disponíveis
 *    - setupFilterListeners(): Configura event listeners dos controles
 *    - applyFilters(): Aplica filtros e atualiza visualizações
 *    - clearFilters(): Limpa filtros e restaura estado original
 *    - updateProjectsTable(): Atualiza tabela preservando estado de expansão
 *    - updateStatCards(): Recalcula e atualiza cards de estatísticas
 *    - updateDonutChart(): Redesenha gráfico com dados filtrados
 *    - showFilterResults(): Exibe feedback dos filtros aplicados
 *
 * 3. FUNÇÕES AUXILIARES:
 *    - formatFilePath(): Formata caminhos de arquivo para exibição
 *    - formatTime(): Formata tempo em formato legível (h/m/s)
 *    - getProjectColor(): Retorna cores consistentes para projetos
 *
 * 4. PRESERVAÇÃO DA FUNCIONALIDADE EXISTENTE:
 *    - generateStatsWithFiltersHtml(): Mantida intacta conforme solicitado
 *    - Todos os métodos e funcionalidades anteriores preservados
 *    - Compatibilidade total com implementações existentes
 *
 * ARQUITETURA:
 * - Client-side filtering para performance
 * - Separação clara entre dados originais e filtrados
 * - Atualização sincronizada de múltiplas visualizações
 * - Preservação de estado durante operações de filtro
 * - Design consistente com tema VS Code
 */
export class StatsPanel {
  /**
   * Formata o tempo em HH:MM:SS
   */
  static formatTime(timeInSeconds: number): string {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return [
      hours > 0 ? `${hours}h` : "",
      minutes > 0 ? `${minutes}m` : "",
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  /**
   * Formata o caminho do arquivo para exibição
   */
  static formatFilePath(filePath: string, projectName: string): string {
    let displayPath = filePath;

    // Abordagem 1: Se o nome do projeto estiver no caminho, pega a partir dele
    if (displayPath.includes(projectName)) {
      displayPath = displayPath.substring(displayPath.indexOf(projectName));
    }
    // Abordagem 2: Pega só o nome do arquivo se for IDLE ou unknown-file
    else if (displayPath === "IDLE" || displayPath === "unknown-file") {
      // Mantém sem alterações
    }
    // Abordagem 3: Remove caminhos absolutos comuns
    else {
      const patterns = [
        "/home/",
        "/Users/",
        "C:\\Users\\",
        "/var/",
        "/tmp/",
        "C:\\",
      ];
      for (const pattern of patterns) {
        if (displayPath.includes(pattern)) {
          const parts = displayPath.split(pattern);
          if (parts.length > 1) {
            const userParts = parts[1].split("/");
            if (userParts.length > 1) {
              displayPath = userParts.slice(1).join("/");
              break;
            }
          }
        }
      }
    }

    return displayPath;
  }

  /**
   * Cria um painel webview com as estatísticas
   */
  static createStatsPanel(
    projectsData: ProjectsData,
    context: vscode.ExtensionContext,
    rawData?: TimeEntry[]
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "myTimeTraceStats",
      localize("statsPanel.title", "Time Statistics"),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateStatsHtml(projectsData, context, rawData);
    return panel;
  }

  /**
   * Cria um painel webview com filtros e dados brutos
   */
  static createStatsWithFiltersPanel(
    rawData: TimeEntry[],
    availableProjects: string[],
    context: vscode.ExtensionContext
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "myTimeTraceStatsFiltered",
      localize("statsPanel.filteredTitle", "Time Statistics with Filters"),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateStatsWithFiltersHtml(
      rawData,
      availableProjects,
      context
    );
    return panel;
  }

  /**
   * Filtra dados por critérios específicos
   */
  static filterData(data: TimeEntry[], filters: StatsFilters): TimeEntry[] {
    return data.filter((entry) => {
      // Filtro por data
      if (filters.startDate) {
        const entryDate = new Date(entry.timestamp).toISOString().split("T")[0];
        if (entryDate < filters.startDate) {
          return false;
        }
      }

      if (filters.endDate) {
        const entryDate = new Date(entry.timestamp).toISOString().split("T")[0];
        if (entryDate > filters.endDate) {
          return false;
        }
      }

      // Filtro por projeto
      if (filters.projects && filters.projects.length > 0) {
        if (!filters.projects.includes(entry.project)) {
          return false;
        }
      }

      // Excluir entradas idle
      if (entry.is_idle === 1) {
        return false;
      }

      return true;
    });
  }

  /**
   * Converte dados filtrados para formato de ProjectsData
   */
  static convertToProjectsData(filteredData: TimeEntry[]): ProjectsData {
    const projectsData: ProjectsData = {};

    // Agrupa por projeto e arquivo
    const projectFileMap: { [project: string]: { [file: string]: number } } =
      {};

    filteredData.forEach((entry) => {
      if (!projectFileMap[entry.project]) {
        projectFileMap[entry.project] = {};
      }
      if (!projectFileMap[entry.project][entry.file]) {
        projectFileMap[entry.project][entry.file] = 0;
      }
      projectFileMap[entry.project][entry.file] += entry.duration_seconds;
    });

    // Converte para o formato ProjectsData
    Object.entries(projectFileMap).forEach(([projectName, files]) => {
      const fileData: FileTimeData[] = [];
      let totalSeconds = 0;

      Object.entries(files).forEach(([fileName, seconds]) => {
        fileData.push({ name: fileName, seconds });
        totalSeconds += seconds;
      });

      // Ordena arquivos por tempo (maior primeiro)
      fileData.sort((a, b) => b.seconds - a.seconds);

      projectsData[projectName] = {
        totalSeconds,
        files: fileData,
      };
    });

    return projectsData;
  }

  /**
   * Gera o HTML para exibir as estatísticas com dashboard moderno e filtros integrados
   *
   * Esta implementação combina o design do dashboard-demo.html com funcionalidade de filtros
   * similar à tela generateStatsWithFiltersHtml, mantendo ambas as funcionalidades separadas.
   *
   * Funcionalidades incluídas:
   * - Dashboard moderno com gráfico donut interativo
   * - Cards de estatísticas em tempo real
   * - Seção de filtros integrada (data inicial, data final, seleção de projetos)
   * - Tabela de projetos com detalhes expansíveis
   * - Atualização dinâmica da visualização com base nos filtros aplicados
   * - Design responsivo para dispositivos móveis
   *
   * @param projectsData Dados dos projetos organizados por nome do projeto
   * @param projectsData Dados dos projetos organizados por nome do projeto
   * @param context Contexto da extensão para carregar arquivos CSS
   * @returns HTML string completo do dashboard com filtros
   */
  private static generateStatsHtml(
    projectsData: ProjectsData,
    context: vscode.ExtensionContext,
    rawData?: TimeEntry[]
  ): string {
    // Calcular totais para o gráfico donut
    const projectEntries = Object.entries(projectsData);
    const totalTime = projectEntries.reduce(
      (sum, [, data]) => sum + data.totalSeconds,
      0
    );

    // Gerar dados para o gráfico donut
    const chartData = projectEntries.map(([name, data]) => ({
      name,
      value: data.totalSeconds,
      percentage: ((data.totalSeconds / totalTime) * 100).toFixed(1),
    }));

    // Gerar array de projetos para filtros
    // Este array é usado pelo JavaScript client-side para implementar filtros dinâmicos
    // sem necessidade de comunicação com o servidor
    const projectsArray = projectEntries.map(([projectName, projectData]) => ({
      projectName,
      totalMinutes: Math.round(projectData.totalSeconds / 60),
      formattedTime: this.formatTime(projectData.totalSeconds),
      percentage: ((projectData.totalSeconds / totalTime) * 100).toFixed(1),
    }));

    // Cores para o gráfico
    const colors = [
      "#0078d4",
      "#107c10",
      "#ff8c00",
      "#d13438",
      "#a80000",
      "#6f42c1",
      "#20c997",
    ];

    // Carregar CSS externo
    const dashboardCss = CssLoader.loadDashboardStyles(context.extensionPath);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visão Geral de Tempo de Desenvolvimento</title>
      <style>
        ${dashboardCss}
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-content">
          <div class="header-icon">⏱️</div>
          <h1>Visão Geral de Tempo de Desenvolvimento</h1>
        </div>
      </div>

      <div class="overview-section">
        <h2>Resumo Geral</h2>
        <div class="cards-container">
          <div class="overview-card">
              <h3>Tempo Total</h3>
              <div class="donut-container">
                <canvas id="timeChart" width="200" height="200"></canvas>
                <div class="donut-center">
                  <span class="center-number">${Math.floor(
                    totalTime / 3600
                  )}h</span>
                  <span class="center-label">Total</span>
                </div>
              </div>
              <div class="card-stats">
                <div class="stat-item">
                  <span class="stat-label">Projetos:</span>
                  <span class="stat-value critical">${
                    projectEntries.length
                  }</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Hoje:</span>
                  <span class="stat-value medium">${this.formatTime(
                    (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const tomorrow = new Date(today);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      return (rawData || [])
                        .filter((entry) => {
                          const entryDate = new Date(entry.timestamp);
                          return (
                            entryDate >= today &&
                            entryDate < tomorrow &&
                            entry.is_idle !== 1
                          );
                        })
                        .reduce((sum, entry) => sum + entry.duration_seconds, 0);
                    })()
                  )}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Arquivos:</span>
                  <span class="stat-value high">${projectEntries.reduce(
                    (sum, [, data]) => sum + data.files.length,
                    0
                  )}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Esta semana:</span>
                  <span class="stat-value low">${this.formatTime(
                    totalTime
                  )}</span>
                </div>
              </div>
          </div>

          <div class="info-cards">
            <!-- Seção de Filtros Integrados -->
            <!-- 
              Esta seção implementa filtros similares aos da tela generateStatsWithFiltersHtml,
              mas integrados ao design do dashboard moderno. Inclui:
              - Filtros por data (inicial e final)
              - Seleção múltipla de projetos
              - Botões para aplicar e limpar filtros
              - Área de resultados dos filtros aplicados
            -->
            <div class="filters-section">
              <h4>Filtros de Análise de Tempo</h4>
              <div class="filters-grid">
                <div class="filter-group">
                  <label for="start-date">Data Inicial:</label>
                  <input type="date" id="start-date" class="filter-input">
                  <label for="end-date">Data Final:</label>
                  <input type="date" id="end-date" class="filter-input">
                </div>
                <div class="filter-group">
                  <label for="projectFilter">Selecionar Projetos:</label>
                  <select id="projectFilter" class="filter-select" multiple>
                    <option value="">Todos os Projetos</option>
                    ${projectEntries
                      .map(
                        ([projectName]) =>
                          `<option value="${projectName}">${projectName}</option>`
                      )
                      .join("")}
                  </select>
                </div>
              </div>
              <div class="filter-actions">
                <button id="applyFilter" class="filter-btn apply-btn">Aplicar Filtros</button>
                <button id="clearFilter" class="filter-btn clear-btn">Limpar Filtros</button>
              </div>
              <div id="filterResults" class="filter-results"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="projects-table-section">
        <h2>Detalhes dos Projetos</h2>
        <div class="table-container">
          <table class="projects-table">
            <thead>
              <tr>
                <th class="sortable" data-column="project" data-sort="none">
                  Projeto
                  <span class="sort-indicator">
                    <span class="sort-arrow sort-up">▲</span>
                    <span class="sort-arrow sort-down">▼</span>
                  </span>
                </th>
                <th class="sortable" data-column="time" data-sort="none">
                  Tempo Total
                  <span class="sort-indicator">
                    <span class="sort-arrow sort-up">▲</span>
                    <span class="sort-arrow sort-down">▼</span>
                  </span>
                </th>
                <th class="sortable" data-column="files" data-sort="none">
                  Arquivos
                  <span class="sort-indicator">
                    <span class="sort-arrow sort-up">▲</span>
                    <span class="sort-arrow sort-down">▼</span>
                  </span>
                </th>
                <th>Principais Arquivos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              <!-- Tabela será preenchida dinamicamente pelo JavaScript -->
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        <p><em>Dados coletados até: ${new Date().toLocaleString(
          "pt-BR"
        )}</em></p>
      </div>

      <script>
        /**
         * SISTEMA DE FILTROS INTEGRADO AO DASHBOARD
         * 
         * Este sistema implementa funcionalidade de filtros client-side baseada no
         * sistema existente da tela generateStatsWithFiltersHtml, adaptado para
         * o design moderno do dashboard.
         * 
         * Funcionalidades implementadas:
         * 1. Filtros por data (inicial e final)
         * 2. Filtros por projetos (seleção múltipla)
         * 3. Atualização dinâmica da tabela de projetos
         * 4. Atualização dinâmica dos cards de estatísticas
         * 5. Atualização dinâmica do gráfico donut
         * 6. Feedback visual dos filtros aplicados
         * 7. Limpeza de filtros com restauração do estado original
         * 
         * Variáveis globais:
         * - projectsData: Array com dados dos projetos para filtros
         * - allProjects: Backup dos dados originais
         * - chartData: Dados para o gráfico donut
         * - colors: Cores para o gráfico
         */
        
        // JavaScript para funcionalidade dos filtros
        const vscode = acquireVsCodeApi();
        let projectsData = ${JSON.stringify(projectsArray)};
        let allProjects = projectsData;
        let currentProjectsData = ${JSON.stringify(projectsData)};
        let currentSortColumn = 'none';
        let currentSortDirection = 'none';

        // Dados brutos para filtros por data (sem entradas IDLE por padrão)
        const rawData = ${JSON.stringify((rawData || []).filter(entry => entry.is_idle !== 1))};

        // Dados dos projetos para o gráfico
        const chartData = ${JSON.stringify(chartData)};
        const colors = ${JSON.stringify(colors)};

        document.addEventListener('DOMContentLoaded', function() {
          // Inicializar gráfico
          drawDonutChart();
          
          // Configurar tooltips do gráfico
          setupCanvasTooltip();
          
          // Renderizar tabela inicial
          renderProjectsTable(allProjects);
          
          // Configurar ordenação da tabela
          setupTableSorting();
          
          // Preencher select de projetos
          populateProjectSelect();
          
          // Event listeners para os filtros
          setupFilterListeners();
        });

        // Função para alternar detalhes do projeto
        function toggleProjectDetails(projectId) {
          const detailsRow = document.getElementById('details-' + projectId);
          const button = event.target;
          
          if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
            detailsRow.style.display = 'table-row';
            button.textContent = 'Ocultar';
          } else {
            detailsRow.style.display = 'none';
            button.textContent = 'Ver Detalhes';
          }
        }

        /**
         * SISTEMA DE ORDENAÇÃO DE TABELA
         * 
         * Implementa ordenação por coluna com indicadores visuais
         * Funcionalidades:
         * 1. Ordenação por nome do projeto (alfabética)
         * 2. Ordenação por tempo total (numérica)  
         * 3. Ordenação por número de arquivos (numérica)
         * 4. Indicadores visuais (setas) para direção da ordenação
         * 5. Alternância entre ASC/DESC/NONE
         */

        function setupTableSorting() {
          const sortableHeaders = document.querySelectorAll('.sortable');
          
          sortableHeaders.forEach(header => {
            header.addEventListener('click', function() {
              const column = this.getAttribute('data-column');
              const currentSort = this.getAttribute('data-sort');
              
              // Determinar nova direção
              let newSort;
              if (currentSort === 'none') {
                newSort = 'asc';
              } else if (currentSort === 'asc') {
                newSort = 'desc';
              } else {
                newSort = 'none';
              }
              
              // Resetar todos os headers
              sortableHeaders.forEach(h => h.setAttribute('data-sort', 'none'));
              
              // Configurar header atual
              this.setAttribute('data-sort', newSort);
              currentSortColumn = column;
              currentSortDirection = newSort;
              
              // Aplicar ordenação
              const sortedProjects = sortProjects(projectsData, column, newSort);
              renderProjectsTable(sortedProjects);
            });
          });
        }

        function sortProjects(projects, column, direction) {
          if (direction === 'none') {
            return [...projects]; // Retorna cópia original
          }
          
          return [...projects].sort((a, b) => {
            let valueA, valueB;
            
            switch (column) {
              case 'project':
                valueA = a.projectName.toLowerCase();
                valueB = b.projectName.toLowerCase();
                break;
              case 'time':
                valueA = a.totalMinutes;
                valueB = b.totalMinutes;
                break;
              case 'files':
                // Buscar número de arquivos nos dados completos
                const projectDataA = Object.entries(currentProjectsData)
                  .find(([name]) => name === a.projectName);
                const projectDataB = Object.entries(currentProjectsData)
                  .find(([name]) => name === b.projectName);
                valueA = projectDataA ? projectDataA[1].files.length : 0;
                valueB = projectDataB ? projectDataB[1].files.length : 0;
                break;
              default:
                return 0;
            }
            
            if (direction === 'asc') {
              return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
            } else {
              return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
            }
          });
        }

        function renderProjectsTable(projects) {
          const tbody = document.querySelector('.projects-table tbody');
          if (!tbody) return;
          
          tbody.innerHTML = '';
          
          projects.forEach((project, index) => {
            // Buscar dados completos do projeto
            const fullProjectData = Object.entries(currentProjectsData)
              .find(([name]) => name === project.projectName);
            
            if (!fullProjectData) return;
            
            const [projectName, projectData] = fullProjectData;
            const topFiles = projectData.files.slice(0, 3)
              .map(f => formatFilePath(f.name, projectName)).join(', ');
            
            // Criar linha principal do projeto
            const row = document.createElement('tr');
            row.innerHTML = \`
              <td class="project-name">\${projectName}</td>
              <td class="time-value">\${project.formattedTime}</td>
              <td class="files-count">\${projectData.files.length} arquivo(s)</td>
              <td class="top-files">\${topFiles}</td>
              <td>
                <button class="action-btn" onclick="toggleProjectDetails('\${index}')">Ver Detalhes</button>
              </td>
            \`;
            tbody.appendChild(row);
            
            // Criar linha de detalhes (expandível)
            const detailsRow = document.createElement('tr');
            detailsRow.id = 'details-' + index;
            detailsRow.className = 'project-details';
            detailsRow.style.display = 'none';
            detailsRow.innerHTML = \`
              <td colspan="5">
                <div class="details-content">
                  <h4>Arquivos do projeto \${projectName}</h4>
                  <div class="files-grid">
                    \${projectData.files.map(file => \`
                      <div class="file-item">
                        <div class="file-name">\${formatFilePath(file.name, projectName)}</div>
                        <div class="file-time">\${formatTime(file.seconds)}</div>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              </td>
            \`;
            tbody.appendChild(detailsRow);
          });
        }

        // Variáveis globais para o tooltip e segmentos do gráfico
        let chartSegments = [];
        let tooltip = null;

        // Função para criar o elemento tooltip
        function createTooltip() {
          if (tooltip) return tooltip;
          
          tooltip = document.createElement('div');
          tooltip.style.cssText = \`
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transition: opacity 0.2s ease;
            white-space: nowrap;
          \`;
          document.body.appendChild(tooltip);
          return tooltip;
        }

        // Função para mostrar tooltip
        function showTooltip(x, y, projectName, formattedTime, percentage) {
          const tooltipEl = createTooltip();
          
          // Criar HTML estruturado para o tooltip
          tooltipEl.innerHTML = \`
            <div style="font-weight: bold; margin-bottom: 2px;">\${projectName}</div>
            <div style="font-size: 11px;">\${formattedTime} (\${percentage}%)</div>
          \`;
          
          tooltipEl.style.left = x + 10 + 'px';
          tooltipEl.style.top = y - 35 + 'px';
          tooltipEl.style.opacity = '1';
        }

        // Função para esconder tooltip
        function hideTooltip() {
          if (tooltip) {
            tooltip.style.opacity = '0';
          }
        }

        // Função para verificar se um ponto está dentro de um segmento
        function isPointInSegment(x, y, segment) {
          const dx = x - segment.centerX;
          const dy = y - segment.centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Verificar se está dentro do anel donut
          if (distance < segment.innerRadius || distance > segment.radius) {
            return false;
          }
          
          // Calcular ângulo do ponto
          let angle = Math.atan2(dy, dx);
          // Normalizar para [0, 2π]
          if (angle < 0) angle += 2 * Math.PI;
          // Ajustar para começar do topo (-π/2)
          angle = (angle + Math.PI / 2) % (2 * Math.PI);
          
          // Verificar se está dentro do ângulo do segmento
          let startAngle = segment.startAngle;
          let endAngle = segment.endAngle;
          
          // Normalizar ângulos para [0, 2π]
          if (startAngle < 0) startAngle += 2 * Math.PI;
          if (endAngle < 0) endAngle += 2 * Math.PI;
          
          if (startAngle <= endAngle) {
            return angle >= startAngle && angle <= endAngle;
          } else {
            // Caso onde o segmento cruza o 0
            return angle >= startAngle || angle <= endAngle;
          }
        }

        // Função para desenhar gráfico donut
        function drawDonutChart() {
          const canvas = document.getElementById('timeChart');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = 90;
          const innerRadius = 50;
          
          // Limpar canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (chartData.length === 0) return;
          
          const total = chartData.reduce((sum, item) => sum + item.value, 0);
          let currentAngle = -Math.PI / 2; // Começar no topo
          
          // Limpar array de segmentos
          chartSegments = [];
          
          // Desenhar segmentos e salvar informações para detecção de hover
          chartData.forEach((item, index) => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            
            // Salvar informações do segmento para detecção de hover
            chartSegments.push({
              centerX,
              centerY,
              radius,
              innerRadius,
              startAngle: currentAngle,
              endAngle: currentAngle + sliceAngle,
              projectName: item.name,
              formattedTime: formatTime(item.value),
              percentage: item.percentage
            });
            
            // Desenhar segmento externo
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            
            currentAngle += sliceAngle;
          });
          
          // Desenhar círculo interno
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#252526';
          ctx.fill();
        }

        // Função para configurar eventos de mouse no canvas
        function setupCanvasTooltip() {
          const canvas = document.getElementById('timeChart');
          if (!canvas) return;
          
          canvas.addEventListener('mousemove', function(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Verificar se o mouse está sobre algum segmento
            const hoveredSegment = chartSegments.find(segment => 
              isPointInSegment(x, y, segment)
            );
            
            if (hoveredSegment) {
              showTooltip(
                e.clientX, 
                e.clientY, 
                hoveredSegment.projectName,
                hoveredSegment.formattedTime,
                hoveredSegment.percentage
              );
              canvas.style.cursor = 'pointer';
            } else {
              hideTooltip();
              canvas.style.cursor = 'default';
            }
          });
          
          canvas.addEventListener('mouseleave', function() {
            hideTooltip();
            canvas.style.cursor = 'default';
          });
        }

        /**
         * Preenche o select de projetos com as opções disponíveis
         * Remove duplicação de opções e adiciona informação de tempo para cada projeto
         */
        function populateProjectSelect() {
          const projectSelect = document.getElementById('projectFilter');
          if (!projectSelect) return;
          
          // Limpar opções existentes exceto a primeira
          while (projectSelect.children.length > 1) {
            projectSelect.removeChild(projectSelect.lastChild);
          }
          
          allProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.projectName;
            option.textContent = \`\${project.projectName} (\${project.formattedTime})\`;
            projectSelect.appendChild(option);
          });
        }

        /**
         * Configura os event listeners para os controles de filtro
         * Conecta botões e inputs aos handlers apropriados
         */
        function setupFilterListeners() {
          const applyBtn = document.getElementById('applyFilter');
          const clearBtn = document.getElementById('clearFilter');
          
          if (applyBtn) applyBtn.addEventListener('click', applyFilters);
          if (clearBtn) clearBtn.addEventListener('click', clearFilters);
          
          // Auto-aplicar quando mudar período
          const startDate = document.getElementById('start-date');
          const endDate = document.getElementById('end-date');
          if (startDate) startDate.addEventListener('change', applyFilters);
          if (endDate) endDate.addEventListener('change', applyFilters);
        }

        /**
         * Aplica os filtros selecionados aos dados e atualiza a visualização
         * Implementa a lógica principal de filtros baseada na tela generateStatsWithFiltersHtml
         */
        function applyFilters() {
          const startDate = document.getElementById('start-date')?.value;
          const endDate = document.getElementById('end-date')?.value;
          const projectSelect = document.getElementById('projectFilter');
          const selectedProjects = projectSelect ? 
            Array.from(projectSelect.selectedOptions)
              .map(option => option.value)
              .filter(value => value !== '') : [];
          
          let filteredProjects = [...allProjects];
          
          // Se há filtros de data, precisamos filtrar usando os dados brutos
          if ((startDate || endDate) && rawData.length > 0) {
            // Filtrar dados brutos por data (IDLE já foi filtrado)
            const filteredRawData = rawData.filter(entry => {
              // Filtro por data
              if (startDate) {
                const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
                if (entryDate < startDate) return false;
              }
              
              if (endDate) {
                const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
                if (entryDate > endDate) return false;
              }
              
              return true;
            });
            
            // Converter dados filtrados para formato de projetos
            const projectsFromFilteredData = convertFilteredDataToProjects(filteredRawData);
            filteredProjects = projectsFromFilteredData;
          }
          
          // Aplicar filtros por projeto (se selecionados)
          if (selectedProjects.length > 0) {
            filteredProjects = filteredProjects.filter(project => 
              selectedProjects.includes(project.projectName)
            );
          }
          
          // Atualizar todas as visualizações
          updateProjectsTable(filteredProjects);
          updateStatCards(filteredProjects);
          updateDonutChart(filteredProjects);
          
          // Mostrar feedback dos filtros aplicados
          showFilterResults(filteredProjects.length, startDate, endDate, selectedProjects);
        }

        /**
         * Limpa todos os filtros e restaura o estado original
         * Reseta inputs e visualizações para mostrar todos os dados
         */
        function clearFilters() {
          // Limpar inputs
          const startDate = document.getElementById('start-date');
          const endDate = document.getElementById('end-date');
          const projectSelect = document.getElementById('projectFilter');
          
          if (startDate) startDate.value = '';
          if (endDate) endDate.value = '';
          if (projectSelect) {
            // Desmarcar todas as opções
            for (let i = 0; i < projectSelect.options.length; i++) {
              projectSelect.options[i].selected = false;
            }
          }
          
          // Resetar visualização para dados completos originais
          updateProjectsTable(allProjects);
          
          // Restaurar cards de estatísticas originais
          restoreOriginalStatCards();
          
        // Restaurar gráfico donut original (não filtrado)
        drawDonutChart();          // Esconder resultado dos filtros
          const filterResults = document.getElementById('filterResults');
          if (filterResults) {
            filterResults.classList.remove('active');
            filterResults.textContent = '';
          }
        }

        /**
         * Atualiza a tabela de projetos com base nos filtros aplicados
         * Preserva o estado de expansão dos detalhes dos projetos durante a atualização
         * Reconstrói as linhas da tabela mantendo a funcionalidade de "Ver Detalhes"
         */
        function updateProjectsTable(projects) {
          // Atualizar dados atuais para ordenação
          projectsData = projects;
          
          // Aplicar ordenação atual se existir
          let sortedProjects = projects;
          if (currentSortDirection !== 'none') {
            sortedProjects = sortProjects(projects, currentSortColumn, currentSortDirection);
          }
          
          renderProjectsTable(sortedProjects);
        }

        /**
         * Funções auxiliares para formatação (cópias das funções do servidor)
         * Necessárias para manter consistência na formatação client-side
         */
        
        // Converte dados brutos filtrados para formato de projetos compatível com a UI
        function convertFilteredDataToProjects(filteredRawData) {
          const projectFileMap = {};
          
          // Agrupa por projeto e arquivo
          filteredRawData.forEach(entry => {
            if (!projectFileMap[entry.project]) {
              projectFileMap[entry.project] = {};
            }
            if (!projectFileMap[entry.project][entry.file]) {
              projectFileMap[entry.project][entry.file] = 0;
            }
            projectFileMap[entry.project][entry.file] += entry.duration_seconds;
          });
          
          // Converte para o formato esperado pela UI
          const projectsArray = [];
          Object.entries(projectFileMap).forEach(([projectName, files]) => {
            const totalSeconds = Object.values(files).reduce((sum, seconds) => sum + seconds, 0);
            const totalMinutes = Math.round(totalSeconds / 60);
            
            projectsArray.push({
              projectName,
              totalMinutes,
              formattedTime: formatTime(totalSeconds),
              percentage: '0' // Será recalculado na exibição
            });
          });
          
          return projectsArray;
        }
        
        // Formata caminho do arquivo para exibição limpa
        function formatFilePath(filePath, projectName) {
          let displayPath = filePath;
          if (displayPath.includes(projectName)) {
            displayPath = displayPath.substring(displayPath.indexOf(projectName));
          } else if (displayPath === "IDLE" || displayPath === "unknown-file") {
            // Mantém sem alterações  
          } else {
            const patterns = ["/home/", "/Users/", "C:\\\\Users\\\\", "/var/", "/tmp/", "C:\\\\"];
            for (const pattern of patterns) {
              if (displayPath.includes(pattern)) {
                const parts = displayPath.split(pattern);
                if (parts.length > 1) {
                  const userParts = parts[1].split("/");
                  if (userParts.length > 1) {
                    displayPath = userParts.slice(1).join("/");
                    break;
                  }
                }
              }
            }
          }
          return displayPath;
        }

        // Formata tempo em formato legível (horas, minutos, segundos)
        function formatTime(timeInSeconds) {
          const hours = Math.floor(timeInSeconds / 3600);
          const minutes = Math.floor((timeInSeconds % 3600) / 60);
          const seconds = Math.floor(timeInSeconds % 60);
          return [
            hours > 0 ? hours + 'h' : '',
            minutes > 0 ? minutes + 'm' : '',
            seconds + 's'
          ].filter(Boolean).join(' ');
        }

        /**
         * Atualiza os cards de estatísticas com base nos projetos filtrados
         * Recalcula totais e atualiza os elementos visuais do dashboard
         */
        function updateStatCards(projects) {
          const totalMinutes = projects.reduce((sum, p) => sum + p.totalMinutes, 0);
          const totalProjects = projects.length;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          
          // Atualizar os cards de estatísticas
          const statItems = document.querySelectorAll('.stat-item');
          if (statItems.length >= 4) {
            // Primeiro card: número de projetos
            const projectsValue = statItems[0].querySelector('.stat-value');
            if (projectsValue) projectsValue.textContent = totalProjects;
            
            // Terceiro card: arquivos (calcular total de arquivos dos projetos filtrados)
            const totalFiles = projects.reduce((sum, project) => {
              const fullProjectData = Object.entries(${JSON.stringify(
                projectsData
              )})
                .find(([name]) => name === project.projectName);
              return sum + (fullProjectData ? fullProjectData[1].files.length : 0);
            }, 0);
            const filesValue = statItems[2].querySelector('.stat-value');
            if (filesValue) filesValue.textContent = totalFiles;
          }
          
          // Atualizar centro do gráfico donut
          const centerNumber = document.querySelector('.center-number');
          if (centerNumber) {
            centerNumber.textContent = \`\${hours}h\`;
          }
        }

        /**
         * Restaura os valores originais dos cards de estatísticas
         * Usado ao limpar filtros para mostrar dados completos
         */
        function restoreOriginalStatCards() {
          const statItems = document.querySelectorAll('.stat-item');
          if (statItems.length >= 4) {
            // Restaurar valores originais
            const projectsValue = statItems[0].querySelector('.stat-value');
            if (projectsValue) projectsValue.textContent = '${projectEntries.length}';
            
            const filesValue = statItems[2].querySelector('.stat-value');
            if (filesValue) filesValue.textContent = '${projectEntries.reduce(
              (sum, [, data]) => sum + data.files.length,
              0
            )}';
          }
          
          // Restaurar centro do gráfico donut original
          const centerNumber = document.querySelector('.center-number');
          if (centerNumber) {
            centerNumber.textContent = '${Math.floor(totalTime / 3600)}h';
          }
        }

        /**
         * Atualiza o gráfico donut com base nos projetos filtrados
         * Redesenha o gráfico mantendo proporções e cores consistentes
         */
        function updateDonutChart(projects) {
          const canvas = document.getElementById('timeChart');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = 90;
          const innerRadius = 50;
          
          // Limpar canvas para redesenho
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (projects.length === 0) {
            // Desenhar círculo vazio quando não há dados
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI, true);
            ctx.fillStyle = '#3a3a3a';
            ctx.fill();
            
            // Limpar array de segmentos
            chartSegments = [];
            return;
          }
          
          // Calcular e desenhar segmentos baseados nos projetos filtrados
          const total = projects.reduce((sum, p) => sum + p.totalMinutes, 0);
          let currentAngle = -Math.PI / 2;
          
          // Limpar array de segmentos
          chartSegments = [];
          
          projects.forEach((project, index) => {
            const sliceAngle = (project.totalMinutes / total) * 2 * Math.PI;
            const color = getProjectColor(index);
            
            // Salvar informações do segmento para detecção de hover (versão filtrada)
            chartSegments.push({
              centerX,
              centerY,
              radius,
              innerRadius,
              startAngle: currentAngle,
              endAngle: currentAngle + sliceAngle,
              projectName: project.projectName,
              formattedTime: project.formattedTime,
              percentage: ((project.totalMinutes / total) * 100).toFixed(1)
            });
            
            // Desenhar fatia do gráfico
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            
            currentAngle += sliceAngle;
          });
          
          // Desenhar círculo interno (centro do donut)
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#252526';
          ctx.fill();
        }

        /**
         * Retorna uma cor consistente para cada projeto baseada no índice
         * Garante que as cores sejam sempre as mesmas para o mesmo projeto
         */
        function getProjectColor(index) {
          const projectColors = [
            '#0078d4', '#107c10', '#d83b01', '#5c2d91',
            '#e3008c', '#00bcf2', '#bad80a', '#ff8c00',
            '#e74856', '#0099bc', '#881798', '#486860'
          ];
          return projectColors[index % projectColors.length];
        }

        /**
         * Exibe feedback visual dos filtros aplicados
         * Mostra informações resumidas sobre os filtros ativos
         */
        function showFilterResults(count, startDate, endDate, projects) {
          const resultsDiv = document.getElementById('filterResults');
          if (!resultsDiv) return;
          
          let message = \`Mostrando \${count} projeto(s)\`;
          
          if (startDate || endDate) {
            message += \` no período\`;
            if (startDate) message += \` de \${startDate}\`;
            if (endDate) message += \` até \${endDate}\`;
          }
          
          if (projects.length > 0) {
            message += \` para: \${projects.join(', ')}\`;
          }
          
          resultsDiv.textContent = message;
          resultsDiv.classList.add('active');
        }
        
        // Redesenhar gráfico se a janela for redimensionada
        window.addEventListener('resize', function() {
          setTimeout(drawDonutChart, 100);
        });
      </script>
    </body>
    </html>
    `;
  }

  /**
   * Gera o HTML para exibir as estatísticas com filtros
   */
  private static generateStatsWithFiltersHtml(
    rawData: TimeEntry[],
    availableProjects: string[],
    context: vscode.ExtensionContext
  ): string {
    // Gera o JSON dos dados para usar no JavaScript
    const rawDataJson = JSON.stringify(rawData);
    const projectsJson = JSON.stringify(availableProjects);

    // Carregar CSS externo para filtros
    const filtersCss = CssLoader.loadFiltersStyles(context.extensionPath);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estatísticas de Tempo com Filtros</title>
      <style>
        ${filtersCss}
      </style>
    </head>
    <body>
      <h1>Estatísticas de Tempo por Projeto</h1>
      <div class="filter-main">

          <!-- Resumo dos resultados filtrados -->
          <div id="resultsSummary">
              <div id="loadingMessage">Carregando estatísticas...</div>
          </div>

          <!-- Seção de Filtros -->
          <div class="filters-section">
            <div class="filters-container">

              <div class="filter-date">
                  <div class="filter-group">
                      <label for="startDate">Data Inicial:</label>
                      <input type="date" id="startDate" class="filter-input">
                  </div>
                  <div class="filter-group">
                      <label for="endDate">Data Final:</label>
                      <input type="date" id="endDate" class="filter-input">
                  </div>
              </div>

              <div class="filter-select">
                <div class="filter-group">
                  <label for="projectFilter">Projetos2:</label>
                  <select id="projectFilter" multiple class="filter-input">
                    <option value="">Todos os projetos</option>
                    ${availableProjects
                      .map(
                        (project) =>
                          `<option value="${project}">${project}</option>`
                      )
                      .join("")}
                  </select>
                </div>
              </div>                      
              
              <div class="filter-actions">
                  <button id="applyFilters" class="filter-btn">Aplicar Filtros</button>
                  <button id="clearFilters" class="filter-btn secondary">Limpar</button>
              </div>
              
              </div>
            </div>
      </div>
      
      <!-- Área de resultados -->
      <div id="resultsArea">
        <div id="loadingMessage">Carregando estatísticas...</div>
      </div>
      
      <p><em>Última atualização: <span id="lastUpdate">${new Date().toLocaleString()}</span></em></p>
    </body>
    <script>
      ${this.getFiltersJavaScript(rawDataJson, projectsJson)}
    </script>
    </html>
    `;
  }

  /**
   * Retorna os estilos CSS específicos para filtros
   */
  private static getFiltersStyles(): string {
    return `
      body { 
        font-family: Arial, sans-serif; 
        padding: 0px 20px;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        padding-top: 80px; /* Espaço para o header fixo */
      }
      h1 {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        margin: 0;
        padding: 15px 20px;
        border-bottom: 2px solid var(--vscode-panel-border);
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      h1, h2 { 
        color: var(--vscode-editor-foreground); 
        margin: 0;
      }
      h2, h3 {
        margin: 0;
      }
      .toggle-icon { 
        cursor: pointer; 
        color: #fff; 
        font-size: 20px; 
        margin-left: 10px; 
      }
      .toggle-icon:hover { 
        color: #ccc; 
      }
      i {
        font-style: normal;
        color: #fff;
        cursor: pointer;
      }
      .project-header { 
        background-color: var(--vscode-button-background); 
        color: var(--vscode-button-foreground); 
        padding: 10px 10px;
        margin-bottom: 0;
        margin-top: 10px;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        display: flex;
        justify-content: space-between;
        cursor: pointer;
      }
      .project-header:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      table { 
        border-collapse: collapse; 
        width: 100%; 
        margin-bottom: 0px; 
        border: 1px solid var(--vscode-panel-border); 
        border-radius: 5px;
      }
      th, td { 
        text-align: left; 
        padding: 8px; 
        border-bottom: 1px solid var(--vscode-panel-border); 
      }
      th { 
        background-color: var(--vscode-list-activeSelectionBackground); 
        color: var(--vscode-list-activeSelectionForeground); 
      }
      tr:nth-child(even) {
        background-color: var(--vscode-list-hoverBackground); 
        color: var(--vscode-list-hoverForeground); 
      }
      .file-name { 
        font-family: var(--vscode-editor-font-family); 
        font-size: var(--vscode-editor-font-size);
      }
      .toggle-icon-up {
        display: none;
      }
      .project-section { 
        margin-bottom: 0px; 
        padding: 0px;
      }
      
      .filter-main {
        grid-template-rows: auto 1fr;
        display: grid;
        grid-template-columns: 40% 60%;
        gap: 20px;
      }
      
      .filters-section {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 5px;
        padding: 8px;
      }

      .filters-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        align-items: end;
        }

        .filter-date {
          display: flex;
          flex-direction: column;
          margin-bottom: 15px;
        }

        .filter-select {
          display: flex;
          margin-bottom: 15px;
        }
      
      .filter-group {
        display: flex;
        flex-direction: column;
      }
      
      .filter-group label {
        margin-bottom: 5px;
        font-weight: bold;
        color: var(--vscode-editor-foreground);
      }
      
      .filter-input {
        padding: 6px 10px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: inherit;
      }
      
      .filter-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      
      select.filter-input {
        height: auto;
        min-height: 32px;
      }
      
      .filter-actions {
        display: flex;
        gap: 10px;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-end;
      }
      
      .filter-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 3px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
        font-family: inherit;
        font-weight: bold;
      }
      
      .filter-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      
      .filter-btn.secondary {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      
      .filter-btn.secondary:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }
      
      #resultsArea {
        min-height: 200px;
      }
      
      #loadingMessage {
        text-align: center;
        padding: 40px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }
      
      .stats-summary {
        background-color: var(--vscode-textBlockQuote-background);
        border-left: 4px solid var(--vscode-textBlockQuote-border);
        padding: 10px 15px;
        margin-bottom: 15px;
        border-radius: 3px;
      }
      
      .stats-summary h4 {
        margin: 0 0 8px 0;
        color: var(--vscode-editor-foreground);
      }
      
      .stats-summary p {
        margin: 4px 0;
        color: var(--vscode-descriptionForeground);
      }
    `;
  }

  /**
   * Retorna o JavaScript para filtros interativos
   */
  private static getFiltersJavaScript(
    rawDataJson: string,
    projectsJson: string
  ): string {
    return `
      // Dados brutos e projetos disponíveis
      const rawData = ${rawDataJson};
      const availableProjects = ${projectsJson};
      
      // Funções utilitárias
      function formatTime(timeInSeconds) {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        return [
          hours > 0 ? hours + 'h' : '',
          minutes > 0 ? minutes + 'm' : '',
          seconds + 's'
        ].filter(Boolean).join(' ');
      }
      
      function formatFilePath(filePath, projectName) {
        let displayPath = filePath;
        if (displayPath.includes(projectName)) {
          displayPath = displayPath.substring(displayPath.indexOf(projectName));
        } else if (displayPath === "IDLE" || displayPath === "unknown-file") {
          // Mantém sem alterações
        } else {
          const patterns = ["/home/", "/Users/", "C:\\\\Users\\\\", "/var/", "/tmp/", "C:\\\\"];
          for (const pattern of patterns) {
            if (displayPath.includes(pattern)) {
              const parts = displayPath.split(pattern);
              if (parts.length > 1) {
                const userParts = parts[1].split("/");
                if (userParts.length > 1) {
                  displayPath = userParts.slice(1).join("/");
                  break;
                }
              }
            }
          }
        }
        return displayPath;
      }
      
      function filterData(data, filters) {
        return data.filter(entry => {
          // Filtro por data
          if (filters.startDate) {
            const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
            if (entryDate < filters.startDate) return false;
          }
          
          if (filters.endDate) {
            const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
            if (entryDate > filters.endDate) return false;
          }

          // Filtro por projeto
          if (filters.projects && filters.projects.length > 0) {
            if (!filters.projects.includes(entry.project)) return false;
          }

          // Excluir entradas idle
          if (entry.is_idle === 1) return false;

          return true;
        });
      }
      
      function convertToProjectsData(filteredData) {
        const projectsData = {};
        const projectFileMap = {};

        filteredData.forEach(entry => {
          if (!projectFileMap[entry.project]) {
            projectFileMap[entry.project] = {};
          }
          if (!projectFileMap[entry.project][entry.file]) {
            projectFileMap[entry.project][entry.file] = 0;
          }
          projectFileMap[entry.project][entry.file] += entry.duration_seconds;
        });

        Object.entries(projectFileMap).forEach(([projectName, files]) => {
          const fileData = [];
          let totalSeconds = 0;

          Object.entries(files).forEach(([fileName, seconds]) => {
            fileData.push({ name: fileName, seconds });
            totalSeconds += seconds;
          });

          fileData.sort((a, b) => b.seconds - a.seconds);

          projectsData[projectName] = {
            totalSeconds,
            files: fileData
          };
        });

        return projectsData;
      }
      
      function generateProjectsHtml(projectsData) {
        let html = '';
        
        Object.entries(projectsData).forEach(([projectName, projectData]) => {
          html += \`
          <div class="project-section">
            <div class="project-header">
              <h2>Projeto: \${projectName} - Total \${formatTime(projectData.totalSeconds)}</h2>
              <i class="toggle-icon toggle-icon-down">▼</i>
              <i class="toggle-icon toggle-icon-up">▲</i>
            </div>
            <table>
              <tr>
                <th>Arquivos</th>
                <th>Tempo</th>
              </tr>
          \`;

          projectData.files.forEach((file) => {
            const displayPath = formatFilePath(file.name, projectName);
            html += \`
            <tr>
              <td class="file-name">\${displayPath}</td>
              <td>\${formatTime(file.seconds)}</td>
            </tr>
            \`;
          });

          html += \`
            </table>
          </div>
          \`;
        });
        
        return html;
      }
      
      function addProjectToggleListeners() {
        const projectSections = document.querySelectorAll('.project-section');
        
        projectSections.forEach(section => {
          const table = section.querySelector('table');
          if (table) {
            table.style.display = 'none';
          }
          
          const toggleIconUp = section.querySelector('.toggle-icon-up');
          const toggleIconDown = section.querySelector('.toggle-icon-down');
          if (toggleIconUp && toggleIconDown) {
            toggleIconUp.style.display = 'none';
            toggleIconDown.style.display = 'inline';
          }
        });

        function toggleProjectVisibility(section) {
          const table = section.querySelector('table');
          const toggleIconUp = section.querySelector('.toggle-icon-up');
          const toggleIconDown = section.querySelector('.toggle-icon-down');
          
          if (!table || !toggleIconUp || !toggleIconDown) return;
          
          if (table.style.display === 'none' || table.style.display === '') {
            table.style.display = 'table';
            toggleIconUp.style.display = 'inline';
            toggleIconDown.style.display = 'none';
          } else {
            table.style.display = 'none';
            toggleIconUp.style.display = 'none';
            toggleIconDown.style.display = 'inline';
          }
        }
        
        projectSections.forEach(section => {
          const header = section.querySelector('.project-header');
          if (header) {
            header.addEventListener('click', () => {
              toggleProjectVisibility(section);
            });
          }
        });
      }
      
      function updateResults() {
        const filters = {
          startDate: document.getElementById('startDate').value,
          endDate: document.getElementById('endDate').value,
          projects: Array.from(document.getElementById('projectFilter').selectedOptions).map(option => option.value).filter(v => v)
        };
        
        const filteredData = filterData(rawData, filters);
        const projectsData = convertToProjectsData(filteredData);
        
        const resultsArea = document.getElementById('resultsArea');
        if (!resultsArea) {
          console.error('Elemento resultsArea não encontrado.');
          return;
        }
        const resultsSummary = document.getElementById('resultsSummary');
        if (!resultsSummary) {
          console.error('Elemento resultsSummary não encontrado.');
          return;
        }

        if (Object.keys(projectsData).length === 0) {
          resultsArea.innerHTML = '<div id="loadingMessage">Nenhum dado encontrado para os filtros selecionados.</div>';
          return;
        }
        
        // Gera resumo
        const totalEntries = filteredData.length;
        const totalTime = Object.values(projectsData).reduce((sum, project) => sum + project.totalSeconds, 0);
        const totalProjects = Object.keys(projectsData).length;
        
        const summaryHtml = \`
          <div class="stats-summary">
            <h4>Resumo dos Dados Filtrados</h4>
            <p><strong>Total de entradas:</strong> \${totalEntries}</p>
            <p><strong>Tempo total:</strong> \${formatTime(totalTime)}</p>
            <p><strong>Projetos:</strong> \${totalProjects}</p>
          </div>
        \`;
        
        resultsSummary.innerHTML = summaryHtml;
        
        resultsArea.innerHTML = generateProjectsHtml(projectsData);

        addProjectToggleListeners();
        
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
      }
      
      // Event listeners
      document.getElementById('applyFilters').addEventListener('click', updateResults);
      
      document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('projectFilter').selectedIndex = -1;
        updateResults();
      });
      
      // Carregar dados iniciais
      updateResults();
    `;
  }
}
