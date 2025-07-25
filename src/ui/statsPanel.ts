import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';

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
    let statsHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estatísticas de Tempo</title>
      <style>
        ${this.getStyles()}
      </style>
    </head>
    <body>
      <h1>Estatísticas de Tempo por Projeto</h1>
    `;

    // Para cada projeto, criar uma seção com seus arquivos
    Object.entries(projectsData).forEach(([projectName, projectData]) => {
      statsHtml += `
      <div class="project-section">
        <div class="project-header">
          <h2>Projeto: ${projectName} - Total ${this.formatTime(
        projectData.totalSeconds
      )}</h2>
          <i class="toggle-icon toggle-icon-down">▼</i>
          <i class="toggle-icon toggle-icon-up">▲</i>
        </div>
        <table>
          <tr>
            <th>Arquivos</th>
            <th>Tempo</th>
          </tr>
      `;

      // Adiciona cada arquivo do projeto
      projectData.files.forEach((file) => {
        const displayPath = this.formatFilePath(file.name, projectName);
        statsHtml += `
        <tr>
          <td class="file-name">${displayPath}</td>
          <td>${this.formatTime(file.seconds)}</td>
        </tr>
        `;
      });

      statsHtml += `
        </table>
      </div>
      `;
    });

    statsHtml += `
      <p><em>Dados coletados até: ${new Date().toLocaleString()}</em></p>
    </body>
    <script>
      ${this.getJavaScript()}
    </script>
    </html>
    `;

    return statsHtml;
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
