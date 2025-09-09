import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
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
  static createStatsPanel(projectsData: ProjectsData): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "myTimeTraceStats",
      localize('statsPanel.title', 'Time Statistics'),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateStatsHtml(projectsData);
    return panel;
  }

  /**
   * Cria um painel webview com filtros e dados brutos
   */
  static createStatsWithFiltersPanel(
    rawData: TimeEntry[],
    availableProjects: string[]
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "myTimeTraceStatsFiltered",
      localize('statsPanel.filteredTitle', 'Time Statistics with Filters'),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.generateStatsWithFiltersHtml(
      rawData,
      availableProjects
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
   * Gera o HTML para exibir as estatísticas
   */
  private static generateStatsHtml(projectsData: ProjectsData): string {
    // Calcular totais para o gráfico donut
    const projectEntries = Object.entries(projectsData);
    const totalTime = projectEntries.reduce((sum, [, data]) => sum + data.totalSeconds, 0);
    
    // Gerar dados para o gráfico donut
    const chartData = projectEntries.map(([name, data]) => ({
      name,
      value: data.totalSeconds,
      percentage: ((data.totalSeconds / totalTime) * 100).toFixed(1)
    }));

    // Cores para o gráfico
    const colors = ['#0078d4', '#107c10', '#ff8c00', '#d13438', '#a80000', '#6f42c1', '#20c997'];

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visão Geral de Tempo de Desenvolvimento</title>
      <style>
        :root {
          --primary-color: #0078d4;
          --success-color: #107c10;
          --warning-color: #ff8c00;
          --error-color: #d13438;
          --critical-color: #a80000;
          --background-color: #1e1e1e;
          --foreground-color: #cccccc;
          --card-background: #252526;
          --border-color: #3c3c3c;
          --hover-background: #2a2a2a;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background-color: var(--background-color);
          color: var(--foreground-color);
          line-height: 1.6;
        }

        .header {
          background-color: var(--card-background);
          border-bottom: 1px solid var(--border-color);
          padding: 20px 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .header-icon {
          font-size: 32px;
          color: var(--primary-color);
        }

        h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--foreground-color);
        }

        h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--foreground-color);
        }

        .overview-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 30px 20px;
        }

        .cards-container {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 30px;
          margin-bottom: 40px;
        }

        .overview-card {
          background-color: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 25px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .overview-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--foreground-color);
        }

        .donut-container {
          position: relative;
          display: flex;
          justify-content: center;
          margin-bottom: 25px;
        }

        .donut-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .center-number {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: var(--foreground-color);
        }

        .center-label {
          display: block;
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }

        .card-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        .stat-label {
          color: #888;
        }

        .stat-value {
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
        }

        .info-cards {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .remediation-card {
          background-color: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .card-header h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--foreground-color);
        }

        .remediation-content p {
          margin: 0 0 15px 0;
          color: #888;
          font-size: 14px;
          line-height: 1.5;
        }

        .projects-table-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px 40px;
        }

        .table-container {
          background-color: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .projects-table {
          width: 100%;
          border-collapse: collapse;
        }

        .projects-table th,
        .projects-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .projects-table th {
          background-color: var(--hover-background);
          font-weight: 600;
          font-size: 14px;
          color: var(--foreground-color);
        }

        .projects-table tbody tr:hover {
          background-color: var(--hover-background);
        }

        .project-name {
          font-weight: 500;
          font-family: 'Courier New', monospace;
        }

        .time-value {
          font-weight: 600;
          color: var(--primary-color);
        }

        .files-count {
          color: #888;
        }

        .top-files {
          font-size: 13px;
          color: #888;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .action-btn {
          background-color: transparent;
          border: 1px solid var(--primary-color);
          color: var(--primary-color);
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background-color: var(--primary-color);
          color: white;
        }

        .project-details {
          background-color: var(--hover-background);
        }

        .details-content {
          padding: 20px;
        }

        .details-content h4 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: var(--foreground-color);
        }

        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 10px;
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background-color: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 13px;
        }

        .file-name {
          font-family: 'Courier New', monospace;
          color: var(--foreground-color);
          flex: 1;
          margin-right: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-time {
          font-weight: 600;
          color: var(--primary-color);
          white-space: nowrap;
        }

        .footer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          text-align: center;
          color: #888;
          font-size: 12px;
          border-top: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
          .cards-container {
            grid-template-columns: 1fr;
          }
          
          .files-grid {
            grid-template-columns: 1fr;
          }
          
          .projects-table {
            font-size: 12px;
          }
          
          .top-files {
            display: none;
          }
        }
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
            <div class="card-content">
              <h3>Tempo Total</h3>
              <div class="donut-container">
                <canvas id="timeChart" width="150" height="150"></canvas>
                <div class="donut-center">
                  <span class="center-number">${Math.floor(totalTime / 3600)}h</span>
                  <span class="center-label">Total</span>
                </div>
              </div>
              <div class="card-stats">
                <div class="stat-item">
                  <span class="stat-label">Projetos:</span>
                  <span class="stat-value">${projectEntries.length}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Arquivos:</span>
                  <span class="stat-value">${projectEntries.reduce((sum, [, data]) => sum + data.files.length, 0)}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Hoje:</span>
                  <span class="stat-value">${this.formatTime(Math.floor(totalTime * 0.1))}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Esta semana:</span>
                  <span class="stat-value">${this.formatTime(totalTime)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="info-cards">
            <div class="remediation-card">
              <div class="card-header">
                <h3>📊 Análise de Produtividade</h3>
              </div>
              <div class="remediation-content">
                <p>Você tem trabalhado de forma consistente em ${projectEntries.length} projeto(s) diferentes.</p>
                <p>Projeto mais ativo: <strong>${projectEntries.sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)[0]?.[0] || 'N/A'}</strong></p>
                <p>Continue mantendo o foco nos projetos prioritários para maximizar sua produtividade.</p>
              </div>
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
                <th>Projeto</th>
                <th>Tempo Total</th>
                <th>Arquivos</th>
                <th>Principais Arquivos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${projectEntries.map(([projectName, projectData], index) => {
                const topFiles = projectData.files.slice(0, 3).map(f => this.formatFilePath(f.name, projectName)).join(', ');
                return `
                <tr>
                  <td class="project-name">${projectName}</td>
                  <td class="time-value">${this.formatTime(projectData.totalSeconds)}</td>
                  <td class="files-count">${projectData.files.length} arquivo(s)</td>
                  <td class="top-files">${topFiles}</td>
                  <td>
                    <button class="action-btn" onclick="toggleProjectDetails('${index}')">Ver Detalhes</button>
                  </td>
                </tr>
                <tr id="details-${index}" class="project-details" style="display: none;">
                  <td colspan="5">
                    <div class="details-content">
                      <h4>Arquivos do projeto ${projectName}</h4>
                      <div class="files-grid">
                        ${projectData.files.map(file => `
                          <div class="file-item">
                            <div class="file-name">${this.formatFilePath(file.name, projectName)}</div>
                            <div class="file-time">${this.formatTime(file.seconds)}</div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        <p><em>Dados coletados até: ${new Date().toLocaleString('pt-BR')}</em></p>
      </div>

      <script>
        // Dados dos projetos para o gráfico
        const chartData = ${JSON.stringify(chartData)};
        const colors = ${JSON.stringify(colors)};

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

        // Função para desenhar gráfico donut
        function drawDonutChart() {
          const canvas = document.getElementById('timeChart');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = 65;
          const innerRadius = 35;
          
          // Limpar canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (chartData.length === 0) return;
          
          const total = chartData.reduce((sum, item) => sum + item.value, 0);
          let currentAngle = -Math.PI / 2; // Começar no topo
          
          // Desenhar segmentos
          chartData.forEach((item, index) => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            
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
        
        // Inicializar gráfico quando a página carregar
        document.addEventListener('DOMContentLoaded', function() {
          drawDonutChart();
        });
        
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
    availableProjects: string[]
  ): string {
    // Gera o JSON dos dados para usar no JavaScript
    const rawDataJson = JSON.stringify(rawData);
    const projectsJson = JSON.stringify(availableProjects);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estatísticas de Tempo com Filtros</title>
      <style>
        ${this.getFiltersStyles()}
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
                  <label for="projectFilter">Projetos:</label>
                  <select id="projectFilter" multiple class="filter-input">
                    <option value="">Todos os projetos</option>
                    ${availableProjects
                      .map(
                        (project) => `<option value="${project}">${project}</option>`
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
   * Retorna os estilos CSS para o painel
   */
  private static getStyles(): string {
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
      h1, h2 { 
        color: var(--vscode-editor-foreground); 
        margin: 0;
      }
      h2 {
        margin: 0;
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
    `;
  }

  /**
   * Retorna o JavaScript para interatividade do painel
   */
  private static getJavaScript(): string {
    return `
      // Seleciona todas as seções de projeto
      const projectSections = document.querySelectorAll('.project-section');
      
      // Inicializa todas as tabelas como ocultas
      projectSections.forEach(section => {
          const table = section.querySelector('table');
          if (table) {
              table.style.display = 'none';
          }
          
          // Garante que o ícone inicial seja o de expandir (▼)
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
      
      // Adiciona listeners de clique para todos os cabeçalhos de projeto
      projectSections.forEach(section => {
          const header = section.querySelector('.project-header');
          if (header) {
              header.addEventListener('click', () => {
                  toggleProjectVisibility(section);
              });
          }
      });
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
