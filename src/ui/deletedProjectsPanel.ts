import * as vscode from 'vscode';

export interface DeletedProject {
  project: string;
  deleted_at: string;
  records_count: number;
}

/**
 * Gera HTML para o painel de projetos deletados
 */
export class DeletedProjectsPanel {
  /**
   * Gera HTML completo para visualização de projetos deletados
   */
  public static generateDeletedProjectsHtml(
    deletedProjects: DeletedProject[],
    styleUri: vscode.Uri
  ): string {
    const now = new Date();
    
    // Calcular dias restantes para cada projeto
    const projectsWithDaysLeft = deletedProjects.map(project => {
      const deletedDate = new Date(project.deleted_at);
      const daysAgo = Math.floor((now.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - daysAgo;
      
      return {
        ...project,
        daysAgo,
        daysLeft,
        canRestore: daysLeft > 0,
        urgency: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'normal'
      };
    });

    // Separar por status
    const recoverable = projectsWithDaysLeft.filter(p => p.canRestore);
    const expired = projectsWithDaysLeft.filter(p => !p.canRestore);

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${styleUri.scheme}: 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Projetos Deletados - MyTimeTrace</title>
  <link href="${styleUri}" rel="stylesheet">
  <style>
    body {
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      line-height: 1.6;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px 10px;
      border-bottom: 2px solid var(--vscode-panel-border);
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      border: 1px solid var(--vscode-button-border);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
      transition: all 0.2s;
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .btn:disabled,
    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .stats-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }

    .stat-card {
      padding: 20px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      border: 1px solid var(--vscode-panel-border);
    }

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 13px;
      opacity: 0.8;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .project-card {
      background: var(--vscode-editor-background);
      border: 2px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      transition: all 0.2s;
    }

    .project-card:hover {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .project-card.urgent-critical {
      border-left: 4px solid #f14c4c;
    }

    .project-card.urgent-warning {
      border-left: 4px solid #cca700;
    }

    .project-card.expired {
      opacity: 0.6;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .project-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .project-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .badge-recoverable {
      background: #1a7f37;
      color: white;
    }

    .badge-expiring {
      background: #cca700;
      color: white;
    }

    .badge-critical {
      background: #f14c4c;
      color: white;
      animation: pulse 2s infinite;
    }

    .badge-expired {
      background: #666;
      color: white;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .project-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 15px;
      padding: 15px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .info-label {
      font-size: 11px;
      opacity: 0.7;
      text-transform: uppercase;
    }

    .info-value {
      font-size: 14px;
      font-weight: bold;
    }

    .urgency-bar {
      height: 4px;
      background: var(--vscode-progressBar-background);
      border-radius: 2px;
      margin-bottom: 15px;
      overflow: hidden;
    }

    .urgency-fill {
      height: 100%;
      transition: width 0.3s;
    }

    .urgency-fill.normal {
      background: #1a7f37;
    }

    .urgency-fill.warning {
      background: #cca700;
    }

    .urgency-fill.critical {
      background: #f14c4c;
    }

    .project-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn-restore {
      background: #1a7f37;
      color: white;
      border: none;
    }

    .btn-restore:hover {
      background: #26a148;
    }

    .btn-delete-permanent {
      background: #e90d0dff;
      color: white;
      border: none;
    }

    .btn-delete-permanent:hover {
      background: #db4c4cff;
    }

    .btn-restore:disabled,
    .btn-delete-permanent:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .warning-message {
      padding: 15px;
      background: rgba(204, 167, 0, 0.1);
      border-left: 4px solid #cca700;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .info-message {
      padding: 15px;
      background: rgba(26, 127, 55, 0.1);
      border-left: 4px solid #1a7f37;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      font-size: 16px;
      color: var(--vscode-descriptionForeground);
    }

    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: var(--vscode-progressBar-background);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Modal de Confirmação - Estilo baseado em statsPanel.ts */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
    }

    .modal-container {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      max-width: 500px;
      min-width: 400px;
      display: flex;
      flex-direction: column;
      animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      color: var(--vscode-editor-foreground);
    }

    .modal-body {
      padding: 20px;
      color: var(--vscode-foreground);
    }

    .modal-warning {
      font-size: 14px;
      margin-bottom: 15px;
    }

    .modal-warning strong {
      color: var(--vscode-errorForeground);
    }

    .modal-info {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.6;
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      border-radius: 4px;
    }

    .modal-footer {
      padding: 20px;
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .modal-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .modal-btn-cancel {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .modal-btn-cancel:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .modal-btn-confirm {
      background: #1a7f37;
      color: white;
    }

    .modal-btn-confirm:hover {
      background: #26a148;
    }

    .modal-btn-delete {
      background: #D0021B;
      color: white;
    }

    .modal-btn-delete:hover {
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>
      <span>🗑️</span>
      Projetos Deletados
    </h1>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick="refreshData(); return false;">
        🔄 Atualizar
      </button>
      <button class="btn btn-secondary" onclick="cleanupExpired(); return false;" ${expired.length === 0 ? 'disabled' : ''}>
        🧹 Limpar Expirados
      </button>
    </div>
  </div>

  <div class="stats-summary">
    <div class="stat-card">
      <div class="stat-value">${recoverable.length}</div>
      <div class="stat-label">Recuperáveis</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${expired.length}</div>
      <div class="stat-label">Expirados (30+ dias)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${projectsWithDaysLeft.reduce((sum, p) => sum + p.records_count, 0)}</div>
      <div class="stat-label">Total de Registros</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${projectsWithDaysLeft.filter(p => p.urgency === 'critical').length}</div>
      <div class="stat-label">Críticos (≤7 dias)</div>
    </div>
  </div>

  ${recoverable.length > 0 ? `
    <div class="section">
      <h2 class="section-title">
        <span>♻️</span>
        Projetos Recuperáveis (${recoverable.length})
      </h2>
      
      ${recoverable.filter(p => p.urgency === 'critical').length > 0 ? `
        <div class="warning-message">
          ⚠️ <strong>Atenção!</strong> ${recoverable.filter(p => p.urgency === 'critical').length} projeto(s) serão deletados permanentemente em menos de 7 dias!
        </div>
      ` : ''}

      ${recoverable.map(project => `
        <div class="project-card urgent-${project.urgency}">
          <div class="project-header">
            <div>
              <div class="project-name">${project.project}</div>
            </div>
            <span class="project-badge badge-${project.urgency === 'critical' ? 'critical' : project.urgency === 'warning' ? 'expiring' : 'recoverable'}">
              ${project.urgency === 'critical' ? '🚨 CRÍTICO' : project.urgency === 'warning' ? '⚠️ EXPIRANDO' : '✅ RECUPERÁVEL'}
            </span>
          </div>

          <div class="urgency-bar">
            <div class="urgency-fill ${project.urgency}" style="width: ${(project.daysLeft / 30) * 100}%"></div>
          </div>

          <div class="project-info">
            <div class="info-item">
              <span class="info-label">Deletado há</span>
              <span class="info-value">${project.daysAgo} dia${project.daysAgo !== 1 ? 's' : ''}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dias restantes</span>
              <span class="info-value" style="color: ${project.urgency === 'critical' ? '#f14c4c' : project.urgency === 'warning' ? '#cca700' : '#1a7f37'}">
                ${project.daysLeft} dia${project.daysLeft !== 1 ? 's' : ''}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Registros</span>
              <span class="info-value">${project.records_count}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Deletado em</span>
              <span class="info-value">${new Date(project.deleted_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div class="project-actions">
            <button class="btn btn-restore" onclick="restoreProject('${project.project}'); return false;">
              ♻️ Restaurar Projeto
            </button>
            <button class="btn btn-delete-permanent" onclick="deletePermanently('${project.project}'); return false;">
              💥 Deletar Permanentemente
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  ${expired.length > 0 ? `
    <div class="section">
      <h2 class="section-title">
        <span>❌</span>
        Projetos Expirados (${expired.length})
      </h2>
      
      <div class="info-message">
        ℹ️ Estes projetos foram deletados há mais de 30 dias e serão removidos permanentemente em breve.
      </div>

      ${expired.map(project => `
        <div class="project-card expired">
          <div class="project-header">
            <div>
              <div class="project-name">${project.project}</div>
            </div>
            <span class="project-badge badge-expired">
              ❌ EXPIRADO
            </span>
          </div>

          <div class="project-info">
            <div class="info-item">
              <span class="info-label">Deletado há</span>
              <span class="info-value">${project.daysAgo} dias</span>
            </div>
            <div class="info-item">
              <span class="info-label">Expirou há</span>
              <span class="info-value">${Math.abs(project.daysLeft)} dia${Math.abs(project.daysLeft) !== 1 ? 's' : ''}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Registros</span>
              <span class="info-value">${project.records_count}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Deletado em</span>
              <span class="info-value">${new Date(project.deleted_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div class="project-actions">
            <button class="btn btn-delete-permanent" onclick="deletePermanently('${project.project.replace(/'/g, "\\'")}'); return false;">
              💥 Remover Agora
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  ${deletedProjects.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">✨</div>
      <h2>Nenhum Projeto Deletado</h2>
      <p>Seus projetos estão seguros! Quando você deletar um projeto,<br>ele aparecerá aqui e poderá ser recuperado dentro de 30 dias.</p>
    </div>
  ` : ''}

  <!-- Modal de Confirmação de Restauração -->
  <div id="restoreModal" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h3>♻️ Confirmar Restauração</h3>
      </div>
      <div class="modal-body">
        <p class="modal-warning">
          Tem certeza que deseja restaurar o projeto <strong id="projectToRestore"></strong>?
        </p>
        <p class="modal-info">
          📂 Todos os <strong id="restoreRecordsCount"></strong> registro(s) serão recuperados e voltarão a aparecer nas suas estatísticas.
        </p>
      </div>
      <div class="modal-footer">
        <button id="cancelRestore" class="modal-btn modal-btn-cancel">
          Cancelar
        </button>
        <button id="confirmRestore" class="modal-btn modal-btn-confirm">
          ♻️ Sim, Restaurar
        </button>
      </div>
    </div>
  </div>

  <!-- Modal de Confirmação de Exclusão Permanente -->
  <div id="deleteModal" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h3>⚠️ Confirmar Exclusão Permanente</h3>
      </div>
      <div class="modal-body">
        <p class="modal-warning">
          <strong>ATENÇÃO: Esta ação é PERMANENTE e IRREVERSÍVEL!</strong>
        </p>
        <p class="modal-warning">
          Deseja deletar permanentemente o projeto <strong id="projectToDelete"></strong>?
        </p>
        <p class="modal-info">
          🗑️ Todos os <strong id="deleteRecordsCount"></strong> registro(s) serão removidos para sempre.<br>
          ⚠️ Esta ação NÃO PODE SER DESFEITA!
        </p>
      </div>
      <div class="modal-footer">
        <button id="cancelDelete" class="modal-btn modal-btn-cancel">
          Cancelar
        </button>
        <button id="confirmDelete" class="modal-btn modal-btn-delete">
          💥 Sim, Deletar Permanentemente
        </button>
      </div>
    </div>
  </div>

  <!-- Modal de Limpeza de Projetos Expirados -->
  <div id="cleanupModal" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h3>🧹 Confirmar Limpeza</h3>
      </div>
      <div class="modal-body">
        <p class="modal-warning">
          Deseja remover permanentemente <strong id="expiredCount">${expired.length}</strong> projeto(s) expirado(s)?
        </p>
        <p class="modal-info">
          🗑️ Todos os projetos deletados há mais de 30 dias serão removidos permanentemente.<br>
          ⚠️ Esta ação não pode ser desfeita.
        </p>
      </div>
      <div class="modal-footer">
        <button id="cancelCleanup" class="modal-btn modal-btn-cancel">
          Cancelar
        </button>
        <button id="confirmCleanup" class="modal-btn modal-btn-delete">
          🧹 Sim, Limpar Expirados
        </button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    // Função para restaurar projeto - Abre modal de confirmação
    function restoreProject(projectName) {
      console.log('Restaurando projeto:', projectName);
      openRestoreModal(projectName);
    }

    // Função para deletar permanentemente - Abre modal de confirmação
    function deletePermanently(projectName) {
      console.log('Deletando permanentemente:', projectName);
      openDeleteModal(projectName);
    }

    // Função para atualizar dados
    function refreshData() {
      vscode.postMessage({
        command: 'refreshDeletedProjects'
      });
    }

    // Função para limpar expirados - Abre modal de confirmação
    function cleanupExpired() {
      console.log('Limpando projetos expirados');
      const expiredCount = ${expired.length};
      if (expiredCount === 0) {
        // Sem modal se não há projetos expirados
        return;
      }
      openCleanupModal();
    }

    // Função auxiliar para obter total de registros
    function getTotalRecords(projectName) {
      const projects = ${JSON.stringify(projectsWithDaysLeft)};
      const project = projects.find(p => p.project === projectName);
      return project ? project.records_count : 0;
    }

    /**
     * MODAIS DE CONFIRMAÇÃO CUSTOMIZADOS
     * Baseados no padrão do statsPanel.ts
     */

    // Modal de Restauração
    function openRestoreModal(projectName) {
      const modal = document.getElementById('restoreModal');
      const projectNameSpan = document.getElementById('projectToRestore');
      const recordsCountSpan = document.getElementById('restoreRecordsCount');
      const confirmBtn = document.getElementById('confirmRestore');
      const cancelBtn = document.getElementById('cancelRestore');
      
      if (!modal || !projectNameSpan || !confirmBtn || !cancelBtn) {
        console.error('Elementos do modal de restauração não encontrados!');
        return;
      }
      
      // Configurar conteúdo do modal
      const records = getTotalRecords(projectName);
      projectNameSpan.textContent = projectName;
      recordsCountSpan.textContent = records;
      
      // Mostrar modal
      modal.style.display = 'flex';
      
      // Remove listeners antigos
      const newConfirmBtn = confirmBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      
      // Handler de confirmação
      newConfirmBtn.addEventListener('click', function() {
        closeRestoreModal();
        executeProjectRestoration(projectName);
      });
      
      // Handler de cancelamento
      newCancelBtn.addEventListener('click', function() {
        closeRestoreModal();
      });
      
      // Fechar com ESC ou clique fora
      setupModalCloseHandlers(modal, closeRestoreModal);
    }

    function closeRestoreModal() {
      const modal = document.getElementById('restoreModal');
      if (modal) modal.style.display = 'none';
    }

    function executeProjectRestoration(projectName) {
      console.log('📤 Enviando solicitação de restauração:', projectName);
      vscode.postMessage({
        command: 'restoreProject',
        projectName: projectName
      });
    }

    // Modal de Exclusão Permanente
    function openDeleteModal(projectName) {
      const modal = document.getElementById('deleteModal');
      const projectNameSpan = document.getElementById('projectToDelete');
      const recordsCountSpan = document.getElementById('deleteRecordsCount');
      const confirmBtn = document.getElementById('confirmDelete');
      const cancelBtn = document.getElementById('cancelDelete');
      
      if (!modal || !projectNameSpan || !confirmBtn || !cancelBtn) {
        console.error('Elementos do modal de exclusão não encontrados!');
        return;
      }
      
      // Configurar conteúdo do modal
      const records = getTotalRecords(projectName);
      projectNameSpan.textContent = projectName;
      recordsCountSpan.textContent = records;
      
      // Mostrar modal
      modal.style.display = 'flex';
      
      // Remove listeners antigos
      const newConfirmBtn = confirmBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      
      // Handler de confirmação
      newConfirmBtn.addEventListener('click', function() {
        closeDeleteModal();
        executeProjectDeletion(projectName);
      });
      
      // Handler de cancelamento
      newCancelBtn.addEventListener('click', function() {
        closeDeleteModal();
      });
      
      // Fechar com ESC ou clique fora
      setupModalCloseHandlers(modal, closeDeleteModal);
    }

    function closeDeleteModal() {
      const modal = document.getElementById('deleteModal');
      if (modal) modal.style.display = 'none';
    }

    function executeProjectDeletion(projectName) {
      console.log('📤 Enviando solicitação de hard delete:', projectName);
      vscode.postMessage({
        command: 'hardDeleteProject',
        projectName: projectName
      });
    }

    // Modal de Limpeza de Expirados
    function openCleanupModal() {
      const modal = document.getElementById('cleanupModal');
      const confirmBtn = document.getElementById('confirmCleanup');
      const cancelBtn = document.getElementById('cancelCleanup');
      
      if (!modal || !confirmBtn || !cancelBtn) {
        console.error('Elementos do modal de limpeza não encontrados!');
        return;
      }
      
      // Mostrar modal
      modal.style.display = 'flex';
      
      // Remove listeners antigos
      const newConfirmBtn = confirmBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      
      // Handler de confirmação
      newConfirmBtn.addEventListener('click', function() {
        closeCleanupModal();
        executeCleanup();
      });
      
      // Handler de cancelamento
      newCancelBtn.addEventListener('click', function() {
        closeCleanupModal();
      });
      
      // Fechar com ESC ou clique fora
      setupModalCloseHandlers(modal, closeCleanupModal);
    }

    function closeCleanupModal() {
      const modal = document.getElementById('cleanupModal');
      if (modal) modal.style.display = 'none';
    }

    function executeCleanup() {
      console.log('📤 Enviando solicitação de limpeza de expirados');
      vscode.postMessage({
        command: 'cleanupExpiredProjects'
      });
    }

    // Função auxiliar para configurar fechar modal com ESC e clique fora
    function setupModalCloseHandlers(modal, closeFunction) {
      // Fechar ao clicar fora do modal
      modal.addEventListener('click', function modalClickHandler(e) {
        if (e.target === modal) {
          closeFunction();
          modal.removeEventListener('click', modalClickHandler);
        }
      });
      
      // Fechar com ESC
      function escHandler(e) {
        if (e.key === 'Escape') {
          closeFunction();
          document.removeEventListener('keydown', escHandler);
        }
      }
      document.addEventListener('keydown', escHandler);
    }

    // Auto-refresh a cada 60 segundos
    setInterval(refreshData, 60000);
    
    console.log('✅ Painel de projetos deletados carregado com modais customizados');
  </script>
</body>
</html>
    `;
  }
}
