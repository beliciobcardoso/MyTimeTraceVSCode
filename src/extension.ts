import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';
import { DatabaseManager } from "./modules/database";
import { StatusBarManager } from "./modules/statusBar";
import { timeTrace } from "./modules/timeTrace";
import { StatsManager } from "./modules/stats";
import { CommandManager } from "./modules/commands";
import { getConfig } from "./modules/config";
import { PomodoroManager } from "./modules/pomodoro";
import { ModalManager } from "./modules/modal";
import { FocusCompleteModal } from "./ui/focusCompleteModal";

// Variáveis globais para gerenciar a extensão
let globalContext: vscode.ExtensionContext | null = null;
let dbManager: DatabaseManager;
let statusBarManager: StatusBarManager;
let myTimeTrace: timeTrace;
let statsManager: StatsManager;
let pomodoroManager: PomodoroManager;
let modalManager: ModalManager;
let focusCompleteModal: FocusCompleteModal;

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  
  // Logs de ativação
  console.log("=======================================");
  console.log(localize('extension.activated', 'Extension "my-time-trace-vscode" activated!'));
  console.log("Versão: 0.2.0");
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Inicializa os módulos
  try {
    // Inicializa o banco de dados
    dbManager = new DatabaseManager();
    await dbManager.initialize(context.globalStorageUri.fsPath);

    // Inicializa os gerenciadores
    statusBarManager = new StatusBarManager();
    myTimeTrace = new timeTrace(dbManager, statusBarManager);
    statsManager = new StatsManager(dbManager);
    
    // Inicializa o Modal Manager
    modalManager = ModalManager.getInstance();
    modalManager.initialize(context);
    
    // Inicializa o Pomodoro Manager com referência ao timeTrace
    pomodoroManager = new PomodoroManager(dbManager, statusBarManager, myTimeTrace);
    await pomodoroManager.initialize();

    // Inicializa o Focus Complete Modal
    focusCompleteModal = FocusCompleteModal.getInstance();
    focusCompleteModal.initialize(pomodoroManager);

    // Conecta eventos do Pomodoro com o Modal
    pomodoroManager.setEvents({
      onFocusComplete: async () => {
        // Disparar modal quando foco completa (45 minutos)
        await focusCompleteModal.showFocusCompleteAlert({
          focusDuration: 45, // minutos
          canContinue: true,
          continueMinutes: 5
        });
      }
    });

    // Cria e configura o status bar
    statusBarManager.create();

    // Registra os comandos
    const commands = CommandManager.registerCommands(
      () => myTimeTrace.startTracking(),
      () => myTimeTrace.pauseTracking(),
      () => statsManager.showStats(),
      // Comandos do Pomodoro
      () => pomodoroManager.startFocusSession(),
      () => pomodoroManager.pauseSession(),
      () => pomodoroManager.stopSession(),
      async () => {
        // Placeholder para configurações do Pomodoro - será implementado na FASE 3
        vscode.window.showInformationMessage('Configurações do Pomodoro em desenvolvimento...');
      }
    );

    // Comando de teste para modais (apenas durante desenvolvimento)
    const testModalCommand = vscode.commands.registerCommand('my-time-trace-vscode.testModal', async () => {
      try {
        // Teste básico inline para validar sistema de modal
        const testConfig = {
          id: 'test-modal-basic',
          title: 'Teste Sistema Modal',
          content: `
            <div class="text-center">
              <div class="modal-icon">🧪</div>
              <h3>Sistema de Modal Base</h3>
              <p>TAREFA 1 - Sistema funcionando!</p>
            </div>
          `,
          buttons: [{
            id: 'ok',
            text: 'OK',
            primary: true,
            onClick: () => modalManager.closeModal('test-modal-basic')
          }],
          width: '400px',
          height: '300px'
        };
        
        await modalManager.showModal(testConfig);
        console.log('✅ Teste de modal executado com sucesso');
      } catch (error) {
        console.error('❌ Erro ao testar modal:', error);
        vscode.window.showErrorMessage('Erro ao testar sistema de modais');
      }
    });
    
    // Comando de teste para Focus Complete Modal
    const testFocusModalCommand = vscode.commands.registerCommand('my-time-trace-vscode.testFocusCompleteModal', async () => {
      try {
        console.log('🧪 Testando Focus Complete Modal...');
        await focusCompleteModal.showFocusCompleteAlert({
          focusDuration: 45,
          canContinue: true,
          continueMinutes: 5
        });
        console.log('✅ Focus Complete Modal testado com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar Focus Complete Modal:', error);
        vscode.window.showErrorMessage('Erro ao testar Focus Complete Modal');
      }
    });
    
    // Comando de teste para integração automática (simular disparo real)
    const testPomodoroIntegrationCommand = vscode.commands.registerCommand('my-time-trace-vscode.testPomodoroIntegration', async () => {
      try {
        console.log('🔗 Testando integração automática Pomodoro...');
        
        // Verificar se Pomodoro está configurado
        if (!pomodoroManager) {
          vscode.window.showErrorMessage('PomodoroManager não inicializado');
          return;
        }
        
        // Simular evento de foco completo diretamente
        vscode.window.showInformationMessage('🧪 Simulando completar 45 minutos de foco...');
        
        // Aguardar 2 segundos para parecer real
        setTimeout(async () => {
          // Disparar evento manualmente para testar
          await focusCompleteModal.showFocusCompleteAlert({
            focusDuration: 45,
            canContinue: true,
            continueMinutes: 5
          });
          
          vscode.window.showInformationMessage('✅ Teste de integração concluído! Modal deve ter aparecido automaticamente.');
        }, 2000);
        
      } catch (error) {
        console.error('❌ Erro ao testar integração:', error);
        vscode.window.showErrorMessage('Erro ao testar integração Pomodoro');
      }
    });
    
    // Comando para testar Pomodoro real com tempo acelerado (desenvolvimento)
    const testRealPomodoroCommand = vscode.commands.registerCommand('my-time-trace-vscode.testRealPomodoro', async () => {
      try {
        console.log('⚡ Iniciando Pomodoro real com tempo acelerado...');
        
        if (!pomodoroManager) {
          vscode.window.showErrorMessage('PomodoroManager não inicializado');
          return;
        }
        
        // Informar ao usuário
        const choice = await vscode.window.showInformationMessage(
          '⚡ Iniciar Pomodoro real com 10 segundos (em vez de 45 minutos) para testar integração?',
          'Sim, testar', 'Cancelar'
        );
        
        if (choice !== 'Sim, testar') {
          return;
        }
        
        // Modificar temporariamente a configuração para teste rápido
        const originalConfig = pomodoroManager.getConfig();
        if (originalConfig) {
          await pomodoroManager.updateConfig({
            focusDuration: 0.1, // 6 segundos em vez de 45 minutos para teste rápido
            shortBreakDuration: 0.1, // 6 segundos também
            autoStartBreaks: true
          });
        }
        
        // Iniciar sessão de foco
        await pomodoroManager.startFocusSession();
        
        vscode.window.showInformationMessage(
          '⏱️ Pomodoro iniciado! O modal deve aparecer automaticamente em ~6 segundos. Certifique-se de estar codificando para ativar o timer.',
          'OK'
        );
        
      } catch (error) {
        console.error('❌ Erro ao testar Pomodoro real:', error);
        vscode.window.showErrorMessage('Erro ao iniciar Pomodoro de teste');
      }
    });
    
    commands.push(testModalCommand);
    commands.push(testFocusModalCommand);
    commands.push(testPomodoroIntegrationCommand);
    commands.push(testRealPomodoroCommand);

    // Registra os eventos para monitoramento
    const eventEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
      myTimeTrace.onActiveEditorChange(editor);
      // Notificar Pomodoro sobre atividade
      pomodoroManager.onUserActivity();
    });

    const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
      myTimeTrace.onTextDocumentChange(event);
      // Notificar Pomodoro sobre atividade
      pomodoroManager.onUserActivity();
    });

    const eventWindowStateChange = vscode.window.onDidChangeWindowState((windowState) => {
      myTimeTrace.onWindowStateChange(windowState);
      // Notificar Pomodoro sobre atividade se janela estiver focada
      if (windowState.focused) {
        pomodoroManager.onUserActivity();
      }
    });

    // Adiciona todos os subscriptions ao contexto
    context.subscriptions.push(...commands);
    context.subscriptions.push(eventEditorChange);
    context.subscriptions.push(eventTextChange);
    context.subscriptions.push(eventWindowStateChange);

    // Adiciona handlers de limpeza
    context.subscriptions.push({
      dispose: () => {
        myTimeTrace.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        statusBarManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        pomodoroManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        modalManager.dispose();
      },
    });

    // Auto-iniciar se configurado
    const userConfig = getConfig();
    if (userConfig.autoStart) {
      setTimeout(() => {
        if (!myTimeTrace.isCurrentlyTracking()) {
          vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
        }
      }, 100);
    }

  } catch (error) {
    console.error("Falha ao inicializar a extensão:", error);
    vscode.window.showErrorMessage(
      localize('extension.initializationFailed', 'Time Tracking: Failed to initialize the extension.')
    );
  }
}

// Desativação da extensão
export function deactivate() {
  console.log("=======================================");
  console.log(localize('extension.deactivated', 'Extension "my-time-trace-vscode" deactivated!'));
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Limpa os recursos
  if (myTimeTrace) {
    myTimeTrace.dispose();
  }

  if (statusBarManager) {
    statusBarManager.dispose();
  }

  if (dbManager) {
    dbManager.close().catch((err) => {
      console.error("Erro ao fechar banco de dados:", err);
    });
  }

  // Limpa a referência ao contexto global
  globalContext = null;
}
