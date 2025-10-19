import * as vscode from "vscode";
import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import { DatabaseManager } from "./database";
import { StatsPanel, ProjectsData, TimeEntry } from "../ui";

/**
 * Classe responsável por gerar e exibir estatísticas
 */
export class StatsManager {
  constructor(
    private dbManager: DatabaseManager,
    private context: vscode.ExtensionContext
  ) {}

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
      // Obtém dados já filtrados (sem IDLE) e processados
      const processedData = await this.dbManager.query(`
        SELECT
          project,
          file,
          SUM(duration_seconds) as total_seconds
        FROM time_entries
        WHERE is_idle = 0 AND deleted_at IS NULL
        GROUP BY project, file
        ORDER BY project, total_seconds DESC
      `);

      // Obtém todos os dados brutos para suporte a filtros por data
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
        WHERE deleted_at IS NULL
        ORDER BY timestamp DESC
      `);

      // Converte para o formato ProjectsData
      const projectsData: ProjectsData = {};
      
      processedData.forEach((row: any) => {
        const projectName = row.project;
        if (!projectsData[projectName]) {
          projectsData[projectName] = {
            totalSeconds: 0,
            files: []
          };
        }
        
        projectsData[projectName].files.push({
          name: row.file,
          seconds: row.total_seconds
        });
        
        projectsData[projectName].totalSeconds += row.total_seconds;
      });

      // Cria o painel básico (agora com suporte a filtros por data)
      const panel = StatsPanel.createStatsPanel(projectsData, this.context, rawData);

      // Sistema de mensagens para comunicação webview ↔ backend
      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === 'deleteProject') {
            await this.handleDeleteProject(message.projectName, panel);
          }
        },
        undefined,
        this.context.subscriptions
      );

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
        WHERE deleted_at IS NULL
        ORDER BY timestamp DESC
      `);

      // Obtém lista de projetos únicos para o filtro
      const projectsQuery = await this.dbManager.query(`
        SELECT DISTINCT project
        FROM time_entries
        WHERE is_idle = 0 AND deleted_at IS NULL
        ORDER BY project
      `);

      const availableProjects: string[] = projectsQuery.map((row: any) => row.project);

      // Cria o painel webview com filtros
      const panel = StatsPanel.createStatsWithFiltersPanel(rawData, availableProjects, this.context);

      // Adicionar handlers para eventos do painel
      panel.onDidDispose(() => {
        // Limpeza quando o painel for fechado
      });

    } catch (error) {
      console.error("Erro ao carregar estatísticas com filtros:", error);
      vscode.window.showErrorMessage(localize('stats.loadFilteredError', 'Error loading time statistics with filters.'));
    }
  }

  /**
   * Processa solicitação de exclusão de projeto vinda do webview
   */
  private async handleDeleteProject(
    projectName: string,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Validação básica
      if (!projectName || projectName.trim() === '') {
        throw new Error('Nome do projeto inválido');
      }

      console.log(`🗑️ Iniciando exclusão do projeto: ${projectName}`);

      // Executa exclusão no banco de dados
      const deletedRows = await this.dbManager.deleteProjectHistory(projectName);

      console.log(`✅ ${deletedRows} registro(s) deletado(s) do projeto ${projectName}`);

      // Recarrega dados atualizados do banco
      const updatedData = await this.loadStatsData();

      // Regenera HTML completo com dados atualizados
      panel.webview.html = StatsPanel.generateStatsHtml(
        updatedData.projectsData,
        this.context,
        updatedData.rawData
      );

      // Notificação de sucesso no VS Code
      vscode.window.showInformationMessage(
        localize(
          'stats.deleteSuccess',
          'Projeto "{0}" excluído com sucesso! {1} registro(s) removido(s).',
          projectName,
          deletedRows
        )
      );

    } catch (error: any) {
      console.error('❌ Erro ao excluir projeto:', error);

      // Notificação de erro no VS Code
      vscode.window.showErrorMessage(
        localize(
          'stats.deleteError',
          'Erro ao excluir projeto "{0}": {1}',
          projectName,
          error.message
        )
      );
    }
  }

  /**
   * Carrega os dados de estatísticas do banco de dados
   * Helper method para reutilizar lógica de carregamento
   */
  private async loadStatsData(): Promise<{
    projectsData: ProjectsData;
    rawData: TimeEntry[];
  }> {
    // Obtém dados processados (agregados)
    const processedData = await this.dbManager.query(`
      SELECT
        project,
        file,
        SUM(duration_seconds) as total_seconds
      FROM time_entries
      WHERE is_idle = 0 AND deleted_at IS NULL
      GROUP BY project, file
      ORDER BY project, total_seconds DESC
    `);

    // Obtém dados brutos para filtros por data
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
      WHERE deleted_at IS NULL
      ORDER BY timestamp DESC
    `);

    // Converte para formato ProjectsData
    const projectsData: ProjectsData = {};

    processedData.forEach((row: any) => {
      const projectName = row.project;
      if (!projectsData[projectName]) {
        projectsData[projectName] = {
          totalSeconds: 0,
          files: []
        };
      }

      projectsData[projectName].files.push({
        name: row.file,
        seconds: row.total_seconds
      });

      projectsData[projectName].totalSeconds += row.total_seconds;
    });

    return { projectsData, rawData };
  }

  /**
   * Mostra histórico de exclusões em um painel informativo
   */
  async showDeletionHistory(): Promise<void> {
    try {
      console.log('📝 Carregando histórico de exclusões...');
      
      // Buscar histórico completo
      const history = await this.dbManager.getDeletionHistory(true);
      
      if (history.length === 0) {
        vscode.window.showInformationMessage(
          localize('stats.deletionHistory.empty', 'Nenhum projeto foi deletado ainda.')
        );
        return;
      }

      // Calcular estatísticas
      const stats = {
        total: history.length,
        softDeletes: history.filter((h: any) => h.deletion_type === 'soft').length,
        hardDeletes: history.filter((h: any) => h.deletion_type === 'hard').length,
        restored: history.filter((h: any) => h.status === 'restored').length,
        pending: history.filter((h: any) => h.status === 'deleted').length,
        permanent: history.filter((h: any) => h.status === 'permanent').length,
        totalRecords: history.reduce((sum: number, h: any) => sum + h.records_count, 0)
      };

      // Mostrar em formato estruturado
      const message = `
📝 Histórico de Exclusões
─────────────────────────────────────
Total de operações: ${stats.total}
  ├─ Soft deletes: ${stats.softDeletes}
  └─ Hard deletes: ${stats.hardDeletes}

Status atual:
  ├─ Restaurados: ${stats.restored}
  ├─ Pendentes: ${stats.pending}
  └─ Permanentes: ${stats.permanent}

Total de registros afetados: ${stats.totalRecords}

Últimas ${Math.min(5, history.length)} operações:
${history.slice(0, 5).map((h: any, i: number) => `
${i + 1}. ${h.project_name} (${h.status})
   Deletado: ${new Date(h.deleted_at).toLocaleString('pt-BR')}
   Registros: ${h.records_count}
   Tipo: ${h.deletion_type === 'soft' ? 'Reversível' : 'Permanente'}
   ${h.restored_at ? `Restaurado: ${new Date(h.restored_at).toLocaleString('pt-BR')}` : ''}
`).join('')}

💡 Dica: Use o console do VS Code Developer Tools para consultar o histórico completo:
   await dbManager.getDeletionHistory()
      `.trim();

      // Mostrar informação com opções
      const action = await vscode.window.showInformationMessage(
        message,
        'Ver Detalhes no Console',
        'Fechar'
      );

      if (action === 'Ver Detalhes no Console') {
        console.log('📝 Histórico Completo de Exclusões:');
        console.table(history);
        vscode.window.showInformationMessage(
          'Histórico exibido no console do Developer Tools (Help → Toggle Developer Tools)'
        );
      }

    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
      vscode.window.showErrorMessage(
        localize('stats.deletionHistory.error', 'Erro ao carregar histórico de exclusões: {0}', 
          error instanceof Error ? error.message : String(error))
      );
    }
  }
}