import * as vscode from "vscode";
import { DatabaseManager } from "./database";

/**
 * Classe responsável por gerar e exibir estatísticas
 */
export class StatsManager {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Formata o tempo em HH:MM:SS
   */
  private formatTime(timeInSeconds: number): string {
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
  private formatFilePath(filePath: string, projectName: string): string {
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
   * Mostra as estatísticas em um painel webview
   */
  async showStats(): Promise<void> {
    if (!this.dbManager.isInitialized()) {
      vscode.window.showErrorMessage(
        "Banco de dados não inicializado. Tente novamente mais tarde."
      );
      return;
    }

    try {
      // Obtém a lista de projetos com seus totais
      const projectRows = await this.dbManager.query(`
        SELECT 
          project, 
          SUM(duration_seconds) as total_seconds 
        FROM time_entries 
        WHERE is_idle = 0 
        GROUP BY project 
        ORDER BY total_seconds DESC
      `);

      // Obtém os detalhes de cada arquivo por projeto
      const fileRows = await this.dbManager.query(`
        SELECT 
          project, 
          file,
          SUM(duration_seconds) as file_seconds
        FROM time_entries 
        WHERE is_idle = 0 
        GROUP BY project, file
        ORDER BY project, file_seconds DESC
      `);

      // Agrupa os arquivos por projeto
      const projectsWithFiles: {
        [projectName: string]: {
          totalSeconds: number;
          files: { name: string; seconds: number }[];
        };
      } = {};

      // Inicializa os projetos com os dados totais
      projectRows.forEach((project) => {
        projectsWithFiles[project.project] = {
          totalSeconds: project.total_seconds,
          files: [],
        };
      });

      // Adiciona os arquivos aos seus projetos correspondentes
      fileRows.forEach((fileRow) => {
        if (projectsWithFiles[fileRow.project]) {
          projectsWithFiles[fileRow.project].files.push({
            name: fileRow.file,
            seconds: fileRow.file_seconds,
          });
        }
      });

      // Cria o painel webview
      const panel = vscode.window.createWebviewPanel(
        "timeTrackerStats",
        "Estatísticas de Tempo",
        vscode.ViewColumn.One,
        {}
      );

      panel.webview.html = this.generateStatsHtml(projectsWithFiles);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      vscode.window.showErrorMessage("Erro ao carregar estatísticas de tempo.");
    }
  }

  /**
   * Gera o HTML para exibir as estatísticas
   */
  private generateStatsHtml(
    projectsWithFiles: {
      [projectName: string]: {
        totalSeconds: number;
        files: { name: string; seconds: number }[];
      };
    }
  ): string {
    let statsHtml = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 0px 20px;}
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
          color: #fff; 
          margin: 0;
        }
        .project-header { 
          background-color: #4CAF50; 
          color: white; 
          padding: 10px 10px;
          margin-bottom: 0;
          margin-top: 10px;
          border-top-left-radius: 5px;
          border-top-right-radius: 5px;
          display: flex;
          justify-content: space-between;
        }
        table { 
          border-collapse: collapse; 
          width: 100%; 
          margin-bottom: 0px; 
          border: 1px solid #000; 
          border-radius: 5px;
        }
        th, td { 
          text-align: left; 
          padding: 8px; 
          border-bottom: 1px solid #ddd; 
        }
        th { background-color: #4682B4; color: white; }
        tr:nth-child(even) {
          background-color:#3f3f49; 
          color: #f2f2f2; 
        }
        .file-name { 
          font-family: monospace; 
        }
        .toggle-icon-up {
          display: none;
        }
        .project-section { 
          margin-bottom: 0px; 
          padding: 0px;
        }
      </style>
    </head>
    <body>
      <h1>Estatísticas de Tempo por Projeto</h1>
    `;

    // Para cada projeto, criar uma seção com seus arquivos
    Object.entries(projectsWithFiles).forEach(([projectName, projectData]) => {
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
    </script>
    </html>
    `;

    return statsHtml;
  }
}
