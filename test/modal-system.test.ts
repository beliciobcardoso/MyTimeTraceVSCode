import { ModalManager, ModalConfig } from '../src/modules/modal';
import * as vscode from 'vscode';

/**
 * Teste básico do sistema de modais
 * TAREFA 1 - Sistema de Modal Base
 */
async function testModalSystem() {
  console.log('🧪 Iniciando teste do sistema de modais...');

  try {
    // Obter instância do ModalManager
    const modalManager = ModalManager.getInstance();
    
    // Verificar se foi inicializado
    if (!modalManager) {
      throw new Error('ModalManager não disponível');
    }

    // Configuração de teste
    const testModalConfig: ModalConfig = {
      id: 'test-modal',
      title: 'Teste do Sistema de Modal',
      content: `
        <div class="text-center">
          <div class="modal-icon">🧪</div>
          <h3 class="text-large margin-bottom">Sistema de Modal Funcionando!</h3>
          <p class="text-medium margin-bottom">
            Este é um teste básico do sistema de modais da extensão My Time Trace.
          </p>
          <p class="text-small">
            • Modal criado com sucesso<br>
            • Estilos aplicados corretamente<br>
            • Botões funcionais<br>
            • Sistema de eventos ativo
          </p>
        </div>
      `,
      buttons: [
        {
          id: 'test-action',
          text: 'Testar Ação',
          className: 'secondary',
          onClick: () => {
            console.log('✅ Botão de teste clicado!');
            vscode.window.showInformationMessage('Modal funcionando corretamente! 🎉');
          }
        },
        {
          id: 'close',
          text: 'Fechar',
          primary: true,
          onClick: () => {
            modalManager.closeModal('test-modal');
            console.log('🔒 Modal de teste fechado');
          }
        }
      ],
      width: '500px',
      height: '400px',
      className: 'modal-settings',
      closable: true
    };

    // Exibir modal de teste
    console.log('🎨 Criando modal de teste...');
    const panel = await modalManager.showModal(testModalConfig, {
      onShow: () => console.log('📺 Modal exibido'),
      onDestroy: () => console.log('🗑️ Modal destruído')
    });

    if (panel) {
      console.log('✅ Modal criado com sucesso!');
      
      // Testar se modal está ativo
      const isActive = modalManager.isModalActive('test-modal');
      console.log(`🔍 Modal ativo: ${isActive}`);
      
      // Listar modais ativos
      const activeModals = modalManager.getActiveModals();
      console.log(`📋 Modais ativos: ${activeModals.join(', ')}`);
      
      // Testar atualização de conteúdo após 3 segundos
      setTimeout(() => {
        modalManager.updateModalContent('test-modal', `
          <div class="text-center">
            <div class="modal-icon">🔄</div>
            <h3 class="text-large margin-bottom">Conteúdo Atualizado!</h3>
            <p class="text-medium">
              O sistema de atualização dinâmica também está funcionando.
            </p>
          </div>
        `);
        console.log('🔄 Conteúdo do modal atualizado');
      }, 3000);

      return panel;
    } else {
      throw new Error('Falha ao criar modal');
    }

  } catch (error) {
    console.error('❌ Erro no teste do sistema de modais:', error);
    vscode.window.showErrorMessage(`Erro no teste de modal: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Teste de múltiplos modais
 */
async function testMultipleModals() {
  console.log('🧪 Testando múltiplos modais...');
  
  const modalManager = ModalManager.getInstance();
  
  // Modal 1
  await modalManager.showModal({
    id: 'modal-1',
    title: 'Modal 1',
    content: '<p>Primeiro modal</p>',
    buttons: [{
      id: 'close1',
      text: 'Fechar',
      primary: true,
      onClick: () => modalManager.closeModal('modal-1')
    }]
  });

  // Modal 2 (após 1 segundo)
  setTimeout(async () => {
    await modalManager.showModal({
      id: 'modal-2', 
      title: 'Modal 2',
      content: '<p>Segundo modal</p>',
      buttons: [{
        id: 'close2',
        text: 'Fechar',
        primary: true,
        onClick: () => modalManager.closeModal('modal-2')
      }]
    });
    
    console.log(`📊 Total de modais ativos: ${modalManager.getActiveModals().length}`);
  }, 1000);
}

/**
 * Teste de responsividade
 */
async function testResponsiveModal() {
  console.log('🧪 Testando responsividade...');
  
  const modalManager = ModalManager.getInstance();
  
  await modalManager.showModal({
    id: 'responsive-test',
    title: 'Teste de Responsividade',
    content: `
      <div>
        <h3>Teste de Responsividade</h3>
        <p>Este modal deve se adaptar a diferentes tamanhos de tela.</p>
        <div style="height: 200px; background: var(--vscode-textCodeBlock-background); margin: 16px 0; padding: 16px; border-radius: 4px;">
          <p>Conteúdo com scroll se necessário...</p>
          ${Array.from({length: 10}, (_, i) => `<p>Linha ${i + 1} de conteúdo de teste</p>`).join('')}
        </div>
      </div>
    `,
    buttons: [{
      id: 'close-responsive',
      text: 'OK',
      primary: true,
      onClick: () => modalManager.closeModal('responsive-test')
    }],
    width: '80vw',
    height: '70vh'
  });
}

// Exportar funções de teste
export { 
  testModalSystem, 
  testMultipleModals, 
  testResponsiveModal 
};
