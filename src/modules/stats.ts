import * as vscode from "vscode";
import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import { DatabaseManager } from "./database";
import { StatsPanel, ProjectsData, TimeEntry } from "../ui";

/**
 * Classe responsável por gerar e exibir estatísticas
 */
export class StatsManager {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Mostra as estatísticas em um painel webview
   */
  async showStats(): Promise<void> {
    const simpleStatsItem: vscode.QuickPickItem = {
        label: localize('stats.simpleStats', 'Simple Stats'),
        description: localize('stats.simpleStats.description', 'Basic view without filters'),
        detail: localize('stats.simpleStats.detail', 'Shows all stats grouped together')
    };
    const filteredStatsItem: vscode.QuickPickItem = {
        label: localize('stats.filteredStats', 'Stats with Filters'),
        description: localize('stats.filteredStats.description', 'Advanced view with date and project filters'),
        detail: localize('stats.filteredStats.detail', 'Allows filtering data by period and specific projects')
    };

    // Pergunta ao usuário qual tipo de visualização deseja
    const choice = await vscode.window.showQuickPick([simpleStatsItem, filteredStatsItem], {
      placeHolder: localize('stats.chooseVisualization', 'Choose the type of statistics visualization')
    });

    if (!choice) {
      return; // User cancelled
    }

    if (choice === simpleStatsItem) {
      await this.showSimpleStats();
    } else {
      await this.showStatsWithFilters();
    }
  }

  /**
   * Mostra estatísticas simples sem filtros
   */
  async showSimpleStats(): Promise<void> {
    if (!this.dbManager.isInitialized()) {
      vscode.window.showErrorMessage(
        localize('stats.dbNotInitialized', 'Database not initialized. Please try again later.')
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
      vscode.window.showErrorMessage(localize('stats.loadError', 'Error loading time statistics.'));
    }
  }

  /**
   * Mostra estatísticas avançadas com filtros
   */
  async showStatsWithFilters(): Promise<void> {
    if (!this.dbManager.isInitialized()) {
      vscode.window.showErrorMessage(
        localize('stats.dbNotInitialized', 'Database not initialized. Please try again later.')
      );
      return;
    }

    try {
      // Obtém todos os dados brutos para filtragem no lado cliente
      const rawData: TimeEntry[] = await this.dbManager.query(`
        SELECT
          id,
          timestamp,
          project,
          file,
          duration_seconds,
          is_idle,
          synced
        FROM time_entries
        ORDER BY timestamp DESC
      `);

      // Obtém lista de projetos únicos para o filtro
      const projectsQuery = await this.dbManager.query(`
        SELECT DISTINCT project
        FROM time_entries
        WHERE is_idle = 0
        ORDER BY project
      `);

      const availableProjects: string[] = projectsQuery.map((row: any) => row.project);

      // Cria o painel webview com filtros
      const panel = StatsPanel.createStatsWithFiltersPanel(rawData, availableProjects);

      // Adicionar handlers para eventos do painel
      panel.onDidDispose(() => {
        // Limpeza quando o painel for fechado
      });

    } catch (error) {
      console.error("Erro ao carregar estatísticas com filtros:", error);
      vscode.window.showErrorMessage(localize('stats.loadFilteredError', 'Error loading time statistics with filters.'));
    }
  }
}