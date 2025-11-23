import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from "path";
import { getConfig } from "./config";

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Classe responsável por gerenciar o status bar item
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem | undefined;
  private isSyncing: boolean = false;

  /**
   * Cria e configura o status bar item
   */
  create(): void {
    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        1000 // Prioridade alta
      );
      this.statusBarItem.command = "my-time-trace-vscode.showStats";
      this.statusBarItem.tooltip = localize('statusBar.tooltip', 'Click to see time statistics');
    }

    const userConfig = getConfig();
    if (userConfig.showInStatusBar) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  /**
   * Atualiza o texto do status bar item
   */
  update(currentFile: string | undefined, timeSpentOnFile: number, isTracking: boolean): void {
    const userConfig = getConfig();
    if (!this.statusBarItem || !userConfig.showInStatusBar) {
      return;
    }

    const fileName = currentFile ? path.basename(currentFile) : localize('statusBar.noFile', 'No file');
    const timeFormatted = this.formatTime(Math.round(timeSpentOnFile / 1000));

    // Adiciona indicador de sync se estiver sincronizando
    const syncIndicator = this.isSyncing ? '$(sync~spin) ' : '';
    this.statusBarItem.text = `${syncIndicator}$(clock) ${fileName} > ${timeFormatted}`;

    if (isTracking) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.activeBackground"
      );
    } else {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    }
  }

  /**
   * Define o estado de sincronização e atualiza o visual
   * 
   * @param syncing - true se está sincronizando, false caso contrário
   */
  setSyncStatus(syncing: boolean): void {
    this.isSyncing = syncing;
    console.log(`🔄 Status Bar: Sync ${syncing ? 'INICIADO' : 'FINALIZADO'}`);
  }

  /**
   * Formata o tempo em HH:MM:SS
   */
  private formatTime(timeInSeconds: number): string {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return [
      hours > 0 ? `${hours}h` : "",
      minutes > 0 ? `${minutes}m` : "",
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  /**
   * Libera os recursos do status bar item
   */
  dispose(): void {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
      console.log("StatusBarItem limpo.");
    }
  }
}
