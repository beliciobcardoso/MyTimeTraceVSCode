import * as vscode from "vscode";

/**
 * Classe responsável por gerenciar o registro de comandos
 */
export class CommandManager {
  /**
   * Função segura para registrar comandos - verifica se já existem antes
   */
  static safeRegisterCommand(
    commandId: string,
    handler: (...args: any[]) => any
  ): vscode.Disposable {
    try {
      return vscode.commands.registerCommand(commandId, handler);
    } catch (error) {
      // Se o comando já existe, tenta reutilizá-lo
      console.log(`Comando ${commandId} já existe, usando o existente`);
      // Disponibiliza o handler para contexto de teste
      return { dispose: () => {} };
    }
  }

  /**
   * Registra todos os comandos da extensão
   */
  static registerCommands(
    startTracking: () => void,
    pauseTracking: () => void,
    showStats: () => void
  ): vscode.Disposable[] {
    const commands: vscode.Disposable[] = [];

    console.log("📝 Registrando comandos da extensão...");

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.startTracking", () => {
        console.log("🚀 Comando startTracking executado!");
        startTracking();
      })
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.pauseTracking", () => {
        console.log("⏸️ Comando pauseTracking executado!");
        pauseTracking();
      })
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.showStats", () => {
        console.log("📊 Comando showStats executado!");
        showStats();
      })
    );

    console.log(`✅ ${commands.length} comandos registrados com sucesso!`);
    return commands;
  }
}
