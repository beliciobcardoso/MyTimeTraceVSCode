import * as vscode from "vscode";
import { DatabaseManager } from "./modules/database";
import { StatusBarManager } from "./modules/statusBar";
import { TimeTracker } from "./modules/timeTracker";
import { StatsManager } from "./modules/stats";
import { CommandManager } from "./modules/commands";
import { getConfig } from "./modules/config";

// Variáveis globais para gerenciar a extensão
let globalContext: vscode.ExtensionContext | null = null;
let dbManager: DatabaseManager;
let statusBarManager: StatusBarManager;
let timeTracker: TimeTracker;
let statsManager: StatsManager;

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  
  // Logs de ativação
  console.log("=======================================");
  console.log('Extensão "my-time-trace-vscode" ativada!');
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
    timeTracker = new TimeTracker(dbManager, statusBarManager);
    statsManager = new StatsManager(dbManager);

    // Cria e configura o status bar
    statusBarManager.create();

    // Registra os comandos
    const commands = CommandManager.registerCommands(
      () => timeTracker.startTracking(),
      () => timeTracker.pauseTracking(),
      () => statsManager.showStats()
    );

    // Registra os eventos para monitoramento
    const eventEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
      timeTracker.onActiveEditorChange(editor);
    });

    const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
      timeTracker.onTextDocumentChange(event);
    });

    const eventWindowStateChange = vscode.window.onDidChangeWindowState((windowState) => {
      timeTracker.onWindowStateChange(windowState);
    });

    // Adiciona todos os subscriptions ao contexto
    context.subscriptions.push(...commands);
    context.subscriptions.push(eventEditorChange);
    context.subscriptions.push(eventTextChange);
    context.subscriptions.push(eventWindowStateChange);

    // Adiciona handlers de limpeza
    context.subscriptions.push({
      dispose: () => {
        timeTracker.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        statusBarManager.dispose();
      },
    });

    // Auto-iniciar se configurado
    const userConfig = getConfig();
    if (userConfig.autoStart) {
      setTimeout(() => {
        if (!timeTracker.isCurrentlyTracking()) {
          vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
        }
      }, 100);
    }

  } catch (error) {
    console.error("Falha ao inicializar a extensão:", error);
    vscode.window.showErrorMessage(
      "Monitoramento de tempo: Falha ao iniciar a extensão."
    );
  }
}

// Desativação da extensão
export function deactivate() {
  console.log("=======================================");
  console.log('Extensão "my-time-trace-vscode" desativada!');
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Limpa os recursos
  if (timeTracker) {
    timeTracker.dispose();
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
