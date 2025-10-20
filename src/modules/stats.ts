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
   * Mostra estatísticas de tempo
   */
  async showStats(): Promise<void> {
    await this.showSimpleStats();
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
   * Mostra painel visual de projetos deletados com opção de restauração
   */
  async showDeletedProjects(): Promise<void> {
    if (!this.dbManager.isInitialized()) {
      vscode.window.showErrorMessage(
        localize('stats.dbNotInitialized', 'Database not initialized')
      );
      return;
    }

    try {
      console.log('🗑️ Carregando painel de projetos deletados...');

      // Buscar projetos deletados
      const deletedProjects = await this.dbManager.getDeletedProjectsWithDays();

      // Criar painel webview
      const panel = vscode.window.createWebviewPanel(
        'myTimeTraceDeletedProjects',
        'Projetos Deletados - MyTimeTrace',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(this.context.extensionPath)
          ]
        }
      );

      // Importar DeletedProjectsPanel
      const { DeletedProjectsPanel } = await import('../ui/deletedProjectsPanel.js');

      // Gerar URI para CSS
      const stylePath = vscode.Uri.file(
        this.context.asAbsolutePath('src/ui/dashboard-styles.css')
      );
      const styleUri = panel.webview.asWebviewUri(stylePath);

      // Gerar HTML
      panel.webview.html = DeletedProjectsPanel.generateDeletedProjectsHtml(
        deletedProjects,
        styleUri
      );

      // Listener para mensagens do webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          try {
            switch (message.command) {
              case 'restoreProject':
                await this.handleRestoreProject(message.projectName, panel);
                break;
              
              case 'hardDeleteProject':
                await this.handleHardDeleteProject(message.projectName, panel);
                break;
              
              case 'cleanupExpiredProjects':
                await this.handleCleanupExpired(panel);
                break;
              
              case 'refreshDeletedProjects':
                await this.refreshDeletedProjectsPanel(panel);
                break;
            }
          } catch (error) {
            console.error('❌ Erro ao processar comando:', error);
            vscode.window.showErrorMessage(
              `Erro: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        },
        undefined,
        this.context.subscriptions
      );

      console.log(`✅ Painel de projetos deletados aberto (${deletedProjects.length} projetos)`);

    } catch (error) {
      console.error('❌ Erro ao mostrar projetos deletados:', error);
      vscode.window.showErrorMessage(
        localize('stats.deletedProjects.error', 'Erro ao carregar projetos deletados: {0}',
          error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Manipula restauração de projeto
   */
  private async handleRestoreProject(
    projectName: string,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      console.log(`♻️ Solicitação de restauração: ${projectName}`);

      const restoredCount = await this.dbManager.restoreProjectHistory(projectName);

      vscode.window.showInformationMessage(
        `✅ Projeto "${projectName}" restaurado com sucesso! ${restoredCount} registro(s) recuperado(s).`
      );

      // Atualizar painel
      await this.refreshDeletedProjectsPanel(panel);

    } catch (error) {
      console.error('❌ Erro ao restaurar projeto:', error);
      vscode.window.showErrorMessage(
        `Erro ao restaurar projeto: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Manipula exclusão permanente de projeto
   */
  private async handleHardDeleteProject(
    projectName: string,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      console.log(`💥 Solicitação de hard delete: ${projectName}`);

      const deletedCount = await this.dbManager.hardDeleteProjectHistory(projectName);

      vscode.window.showWarningMessage(
        `💥 Projeto "${projectName}" removido PERMANENTEMENTE! ${deletedCount} registro(s) deletado(s) para sempre.`
      );

      // Atualizar painel
      await this.refreshDeletedProjectsPanel(panel);

    } catch (error) {
      console.error('❌ Erro ao deletar permanentemente:', error);
      vscode.window.showErrorMessage(
        `Erro ao deletar permanentemente: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Manipula limpeza de projetos expirados
   */
  private async handleCleanupExpired(panel: vscode.WebviewPanel): Promise<void> {
    try {
      console.log('🧹 Solicitação de limpeza de expirados...');

      const deletedCount = await this.dbManager.cleanupExpiredProjects();

      if (deletedCount > 0) {
        vscode.window.showInformationMessage(
          `🧹 ${deletedCount} projeto(s) expirado(s) removido(s) permanentemente.`
        );
      } else {
        vscode.window.showInformationMessage(
          '✅ Nenhum projeto expirado para limpar.'
        );
      }

      // Atualizar painel
      await this.refreshDeletedProjectsPanel(panel);

    } catch (error) {
      console.error('❌ Erro ao limpar expirados:', error);
      vscode.window.showErrorMessage(
        `Erro ao limpar projetos expirados: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Atualiza painel de projetos deletados
   */
  private async refreshDeletedProjectsPanel(panel: vscode.WebviewPanel): Promise<void> {
    try {
      const deletedProjects = await this.dbManager.getDeletedProjectsWithDays();

      const { DeletedProjectsPanel } = await import('../ui/deletedProjectsPanel.js');

      const stylePath = vscode.Uri.file(
        this.context.asAbsolutePath('src/ui/dashboard-styles.css')
      );
      const styleUri = panel.webview.asWebviewUri(stylePath);

      panel.webview.html = DeletedProjectsPanel.generateDeletedProjectsHtml(
        deletedProjects,
        styleUri
      );

      console.log(`✅ Painel atualizado (${deletedProjects.length} projetos)`);
    } catch (error) {
      console.error('❌ Erro ao atualizar painel:', error);
      throw error;
    }
  }
}