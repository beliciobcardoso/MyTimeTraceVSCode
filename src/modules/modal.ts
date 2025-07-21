import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';

/**
 * Interface para configuração de modal
 */
export interface ModalConfig {
  id: string;
  title: string;
  content: string;
  buttons?: ModalButton[];
  closable?: boolean;
  width?: string;
  height?: string;
  className?: string;
  onClose?: () => void;
}

/**
 * Interface para botões do modal
 */
export interface ModalButton {
  id: string;
  text: string;
  className?: string;
  primary?: boolean;
  onClick: () => void | Promise<void>;
}

/**
 * Interface para eventos do modal
 */
export interface ModalEvents {
  onShow?: () => void;
  onHide?: () => void;
  onDestroy?: () => void;
}

/**
 * Classe para gerenciar modais na extensão VSCode
 */
export class ModalManager {
  private static instance: ModalManager;
  private activeModals: Map<string, vscode.WebviewPanel> = new Map();
  private modalConfigs: Map<string, ModalConfig> = new Map();
  private context: vscode.ExtensionContext | null = null;

  private constructor() {}

  /**
   * Singleton para garantir uma única instância
   */
  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  /**
   * Inicializa o ModalManager com contexto da extensão
   */
  initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    console.log('🎨 ModalManager inicializado');
  }

  /**
   * Cria e exibe um modal
   */
  async showModal(config: ModalConfig, events?: ModalEvents): Promise<vscode.WebviewPanel> {
    if (!this.context) {
      throw new Error('ModalManager não foi inicializado com contexto');
    }

    // Fechar modal existente com mesmo ID
    if (this.activeModals.has(config.id)) {
      this.closeModal(config.id);
    }

    // Criar painel webview
    const panel = vscode.window.createWebviewPanel(
      `modal_${config.id}`,
      config.title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'ui'),
          vscode.Uri.joinPath(this.context.extensionUri, 'assets')
        ]
      }
    );

    // Configurar HTML do modal
    panel.webview.html = this.generateModalHTML(config, panel.webview);

    // Configurar handlers de mensagens
    panel.webview.onDidReceiveMessage(
      message => this.handleModalMessage(config.id, message),
      undefined,
      this.context.subscriptions
    );

    // Handler de fechamento
    panel.onDidDispose(() => {
      this.activeModals.delete(config.id);
      this.modalConfigs.delete(config.id);
      config.onClose?.();
      events?.onDestroy?.();
      console.log(`🗑️ Modal ${config.id} destruído`);
    });

    // Armazenar modal
    this.activeModals.set(config.id, panel);
    this.modalConfigs.set(config.id, config);

    // Disparar evento de exibição
    events?.onShow?.();

    console.log(`🎨 Modal ${config.id} criado e exibido`);
    return panel;
  }

  /**
   * Fecha um modal específico
   */
  closeModal(modalId: string): void {
    const panel = this.activeModals.get(modalId);
    if (panel) {
      panel.dispose();
      console.log(`🔒 Modal ${modalId} fechado`);
    }
  }

  /**
   * Fecha todos os modais ativos
   */
  closeAllModals(): void {
    for (const [id, panel] of this.activeModals) {
      panel.dispose();
    }
    this.activeModals.clear();
    this.modalConfigs.clear();
    console.log('🔒 Todos os modais fechados');
  }

  /**
   * Verifica se um modal está ativo
   */
  isModalActive(modalId: string): boolean {
    return this.activeModals.has(modalId);
  }

  /**
   * Obtém lista de modais ativos
   */
  getActiveModals(): string[] {
    return Array.from(this.activeModals.keys());
  }

  /**
   * Envia mensagem para um modal específico
   */
  sendMessageToModal(modalId: string, message: any): void {
    const panel = this.activeModals.get(modalId);
    if (panel) {
      panel.webview.postMessage(message);
    }
  }

  /**
   * Atualiza o conteúdo de um modal
   */
  updateModalContent(modalId: string, newContent: string): void {
    const panel = this.activeModals.get(modalId);
    const config = this.modalConfigs.get(modalId);
    
    if (panel && config) {
      config.content = newContent;
      this.sendMessageToModal(modalId, {
        type: 'updateContent',
        content: newContent
      });
    }
  }

  /**
   * Manipula mensagens recebidas dos modais
   */
  private handleModalMessage(modalId: string, message: any): void {
    const config = this.modalConfigs.get(modalId);
    if (!config) {
      return;
    }

    switch (message.type) {
      case 'buttonClick':
        const button = config.buttons?.find(b => b.id === message.buttonId);
        if (button) {
          Promise.resolve(button.onClick()).catch(error => {
            console.error(`❌ Erro ao executar ação do botão ${message.buttonId}:`, error);
            vscode.window.showErrorMessage(
              localize('modal.buttonError', 'Error executing button action: {0}', error.message)
            );
          });
        }
        break;

      case 'close':
        this.closeModal(modalId);
        break;

      case 'ready':
        console.log(`✅ Modal ${modalId} pronto`);
        break;

      default:
        console.warn(`⚠️ Mensagem desconhecida do modal ${modalId}:`, message);
    }
  }

  /**
   * Gera HTML do modal
   */
  private generateModalHTML(config: ModalConfig, webview: vscode.Webview): string {
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context!.extensionUri, 'src', 'ui', 'modal-styles.css')
    );

    const buttonsHTML = config.buttons?.map(button => `
      <button 
        class="modal-button ${button.className || ''} ${button.primary ? 'primary' : ''}"
        onclick="handleButtonClick('${button.id}')"
      >
        ${button.text}
      </button>
    `).join('') || '';

    const closeButtonHTML = config.closable !== false ? `
      <button class="modal-close" onclick="closeModal()" title="${localize('modal.close', 'Close')}">
        ✕
      </button>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.title}</title>
        <link rel="stylesheet" href="${stylesUri}">
        <style>
          .modal-container {
            width: ${config.width || 'auto'};
            height: ${config.height || 'auto'};
          }
          ${config.className ? `.${config.className} { /* Custom styles */ }` : ''}
        </style>
      </head>
      <body>
        <div class="modal-overlay">
          <div class="modal-container ${config.className || ''}">
            <div class="modal-header">
              <h2 class="modal-title">${config.title}</h2>
              ${closeButtonHTML}
            </div>
            <div class="modal-content">
              ${config.content}
            </div>
            ${config.buttons ? `
              <div class="modal-footer">
                ${buttonsHTML}
              </div>
            ` : ''}
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function handleButtonClick(buttonId) {
            vscode.postMessage({
              type: 'buttonClick',
              buttonId: buttonId
            });
          }

          function closeModal() {
            vscode.postMessage({
              type: 'close'
            });
          }

          // Listener para atualizações de conteúdo
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'updateContent':
                const contentElement = document.querySelector('.modal-content');
                if (contentElement) {
                  contentElement.innerHTML = message.content;
                }
                break;
            }
          });

          // Notificar que modal está pronto
          vscode.postMessage({
            type: 'ready'
          });

          // Fechar modal com Escape
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && ${config.closable !== false}) {
              closeModal();
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Cleanup ao desativar extensão
   */
  dispose(): void {
    this.closeAllModals();
    console.log('🧹 ModalManager cleanup concluído');
  }
}
