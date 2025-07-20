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

// Variáveis globais para gerenciar a extensão
let globalContext: vscode.ExtensionContext | null = null;
let dbManager: DatabaseManager;
let statusBarManager: StatusBarManager;
let myTimeTrace: timeTrace;
let statsManager: StatsManager;
let pomodoroManager: PomodoroManager;

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
    
    // Inicializa o Pomodoro Manager
    pomodoroManager = new PomodoroManager(dbManager, statusBarManager);
    await pomodoroManager.initialize();

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
