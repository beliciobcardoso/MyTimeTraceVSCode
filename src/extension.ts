import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DatabaseManager } from "./modules/database";
import { StatusBarManager } from "./modules/statusBar";
import { timeTrace } from "./modules/timeTrace";
import { StatsManager } from "./modules/stats";
import { CommandManager } from "./modules/commands";
import { getConfig } from "./modules/config";
import { ApiKeyManager } from "./modules/apiKeyManager";
import { DeviceManager } from "./modules/deviceManager";
import { SyncManager } from "./modules/syncManager";
import { CLEANUP_INTERVAL, CLEANUP_INITIAL_DELAY } from "./config/constants";

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

// Variáveis globais para gerenciar a extensão
let globalContext: vscode.ExtensionContext | null = null;
let dbManager: DatabaseManager;
let statusBarManager: StatusBarManager;
let myTimeTrace: timeTrace;
let statsManager: StatsManager;
let apiKeyManager: ApiKeyManager;
let deviceManager: DeviceManager;
let syncManager: SyncManager;
let cleanupInterval: NodeJS.Timeout | undefined; // Timer para cleanup automático

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  
  // Logs de ativação
  console.log("=======================================");
  console.log(localize('extension.activated', 'Extension "my-time-trace-vscode" activated!'));
  console.log("Versão: 0.5.4");
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
    statsManager = new StatsManager(dbManager, context);
    
    // Inicializa gerenciadores de sincronização
    apiKeyManager = new ApiKeyManager(context);
    deviceManager = new DeviceManager(context);
    syncManager = new SyncManager(
      apiKeyManager,
      deviceManager,
      dbManager,
      statusBarManager
    );

    // Cria e configura o status bar
    statusBarManager.create();

    // Registra os comandos
    const commands = CommandManager.registerCommands(
      () => myTimeTrace.startTracking(),
      () => myTimeTrace.pauseTracking(),
      () => statsManager.showStats(),
      () => statsManager.showDeletedProjects()
    );
    
    // Registra comandos de sincronização
    const syncCommands = CommandManager.registerSyncCommands(
      context,
      apiKeyManager,
      deviceManager,
      syncManager
    );
    
    // Registra comandos de operações de sync
    const syncOpsCommands = CommandManager.registerSyncOperationsCommands(
      context,
      apiKeyManager,
      deviceManager,
      syncManager,
      dbManager
    );

    // Registra os eventos para monitoramento
    const eventEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
      myTimeTrace.onActiveEditorChange(editor);
    });

    const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
      myTimeTrace.onTextDocumentChange(event);
    });

    const eventWindowStateChange = vscode.window.onDidChangeWindowState((windowState) => {
      myTimeTrace.onWindowStateChange(windowState);
    });

    // Adiciona todos os subscriptions ao contexto
    context.subscriptions.push(...commands);
    context.subscriptions.push(...syncCommands);
    context.subscriptions.push(...syncOpsCommands);
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

    // Auto-iniciar se configurado
    const userConfig = getConfig();
    if (userConfig.autoStart) {
      setTimeout(() => {
        if (!myTimeTrace.isCurrentlyTracking()) {
          vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
        }
      }, 100);
    }
    
    // Inicializar SyncManager (busca config do servidor e agenda auto-sync)
    console.log("🔄 Inicializando SyncManager...");
    await syncManager.initialize();

    // ========================================
    // 🧹 CLEANUP AUTOMÁTICO DE PROJETOS EXPIRADOS (>30 DIAS)
    // ========================================
    console.log("🧹 Iniciando cleanup automático de projetos expirados...");
    
    // Executar cleanup imediatamente ao iniciar (após 5 minutos)
    setTimeout(async () => {
      try {
        const deletedCount = await dbManager.cleanupExpiredProjects();
        if (deletedCount > 0) {
          console.log(`🧹 Cleanup inicial: ${deletedCount} projeto(s) expirado(s) removido(s)`);
          vscode.window.showInformationMessage(
            localize(
              'cleanup.automatic', 
              'My Time Trace: {0} expired project(s) automatically cleaned up',
              deletedCount
            )
          );
        } else {
          console.log("✅ Nenhum projeto expirado para limpar (inicial)");
        }
      } catch (error) {
        console.error('❌ Erro no cleanup automático inicial:', error);
      }
    }, CLEANUP_INITIAL_DELAY);
    
    // Executar cleanup periodicamente (a cada 24 horas)
    cleanupInterval = setInterval(async () => {
      try {
        const deletedCount = await dbManager.cleanupExpiredProjects();
        if (deletedCount > 0) {
          console.log(`🧹 Cleanup automático: ${deletedCount} projeto(s) expirado(s) removido(s)`);
          vscode.window.showInformationMessage(
            localize(
              'cleanup.automatic',
              'My Time Trace: {0} expired project(s) automatically cleaned up',
              deletedCount
            )
          );
        } else {
          console.log("✅ Nenhum projeto expirado para limpar (periódico)");
        }
      } catch (error) {
        console.error('❌ Erro no cleanup automático periódico:', error);
      }
    }, CLEANUP_INTERVAL);
    
    // Registrar cleanup para ser cancelado ao desativar extensão
    context.subscriptions.push({
      dispose: () => {
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          console.log("🛑 Cleanup automático desativado");
        }
      }
    });
    
    console.log("✅ Cleanup automático configurado (executa a cada 24h)");
    // ========================================

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

  // Parar cleanup automático
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    console.log("🛑 Cleanup automático cancelado na desativação");
  }

  if (dbManager) {
    dbManager.close().catch((err) => {
      console.error("Erro ao fechar banco de dados:", err);
    });
  }

  // Limpa a referência ao contexto global
  globalContext = null;
}
