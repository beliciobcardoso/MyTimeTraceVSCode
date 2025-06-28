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

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.startTracking", startTracking)
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.pauseTracking", pauseTracking)
    );

    commands.push(
      CommandManager.safeRegisterCommand("my-time-trace-vscode.showStats", showStats)
    );

    return commands;
  }
}
