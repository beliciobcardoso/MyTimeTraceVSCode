import * as vscode from "vscode";
import { DatabaseManager } from "./database";
import { StatsPanel, ProjectsData } from "../ui";

/**
 * Classe responsável por gerar e exibir estatísticas
 */
export class StatsManager {
  constructor(private dbManager: DatabaseManager) {}

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
      const projectsData: ProjectsData = {};

      // Inicializa os projetos com os dados totais
      projectRows.forEach((project) => {
        projectsData[project.project] = {
          totalSeconds: project.total_seconds,
          files: [],
        };
      });

      // Adiciona os arquivos aos seus projetos correspondentes
      fileRows.forEach((fileRow) => {
        if (projectsData[fileRow.project]) {
          projectsData[fileRow.project].files.push({
            name: fileRow.file,
            seconds: fileRow.file_seconds,
          });
        }
      });

      // Cria o painel webview usando a classe StatsPanel
      const panel = StatsPanel.createStatsPanel(projectsData);
      
      // Opcional: adicionar handlers para eventos do painel
      panel.onDidDispose(() => {
        // Limpeza quando o painel for fechado
      });

    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      vscode.window.showErrorMessage("Erro ao carregar estatísticas de tempo.");
    }
  }
}
