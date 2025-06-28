import * as vscode from "vscode";

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
      const patterns = ["/home/", "/Users/", "C:\\Users\\", "/var/", "/tmp/", "C:\\"];
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
      "timeTrackerStats",
      "Estatísticas de Tempo",
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
          <h2>Projeto: ${projectName} - Total ${this.formatTime(projectData.totalSeconds)}</h2>
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
   * Retorna os estilos CSS para o painel
   */
  private static getStyles(): string {
    return `
      body { 
        font-family: Arial, sans-serif; 
        padding: 0px 20px;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
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
}
