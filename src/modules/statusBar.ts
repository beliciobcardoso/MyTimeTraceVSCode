import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';
import * as path from "path";
import { getConfig } from "./config";
import { VisualEffectsManager, VisualState } from "./visualEffectsManager";

/**
 * Classe responsável por gerenciar o status bar item
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem | undefined;
  private pomodoroStatusBarItem: vscode.StatusBarItem | undefined;
  private isPomodoroActive: boolean = false;
  private visualEffects: VisualEffectsManager;

  constructor() {
    this.visualEffects = VisualEffectsManager.getInstance();
  }

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
      
      // Inicializar efeitos visuais com o status bar principal
      this.visualEffects.initialize(this.statusBarItem);
    }

    // Criar status bar do Pomodoro
    if (!this.pomodoroStatusBarItem) {
      this.pomodoroStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        999 // Prioridade ligeiramente menor que o principal
      );
      this.pomodoroStatusBarItem.command = "my-time-trace-vscode.showPomodoroConfig";
      this.pomodoroStatusBarItem.tooltip = "Pomodoro Timer - Click to configure";
    }

    const userConfig = getConfig();
    if (userConfig.showInStatusBar) {
      this.statusBarItem.show();
      // Pomodoro status só aparece quando ativo
      if (this.isPomodoroActive) {
        this.pomodoroStatusBarItem.show();
      }
    } else {
      this.statusBarItem.hide();
      this.pomodoroStatusBarItem.hide();
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

    this.statusBarItem.text = `$(clock) ${fileName} > ${timeFormatted}`;

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
   * Atualiza o status bar do Pomodoro
   */
  updatePomodoro(icon: string, state: string, time: string, isActive: boolean): void {
    if (!this.pomodoroStatusBarItem) {
      return;
    }

    this.isPomodoroActive = isActive;

    if (isActive) {
      this.pomodoroStatusBarItem.text = `${icon} ${state} ${time}`;
      
      // Cores baseadas no estado
      if (state.includes('Foco')) {
        this.pomodoroStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      } else if (state.includes('Pausado')) {
        this.pomodoroStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      } else if (state.includes('Pausa')) {
        this.pomodoroStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
      } else {
        this.pomodoroStatusBarItem.backgroundColor = undefined;
      }

      const userConfig = getConfig();
      if (userConfig.showInStatusBar) {
        this.pomodoroStatusBarItem.show();
      }
    } else {
      this.pomodoroStatusBarItem.hide();
      this.pomodoroStatusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * Oculta o status bar do Pomodoro
   */
  hidePomodoroStatus(): void {
    this.isPomodoroActive = false;
    if (this.pomodoroStatusBarItem) {
      this.pomodoroStatusBarItem.hide();
      this.pomodoroStatusBarItem.backgroundColor = undefined;
    }
    // Resetar estado visual
    this.visualEffects.setState(VisualState.IDLE);
  }

  /**
   * Controles de efeitos visuais
   */
  
  /**
   * Define estado visual do sistema
   */
  setVisualState(state: VisualState, options?: {
    animated?: boolean;
    message?: string;
    duration?: number;
  }): void {
    this.visualEffects.setState(state, options);
  }

  /**
   * Exibe notificação flash
   */
  showNotificationFlash(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.visualEffects.notificationFlash(message, type);
  }

  /**
   * Inicia efeito de pulsação
   */
  startPulseEffect(state: VisualState, interval?: number): void {
    this.visualEffects.startPulseEffect(state, interval);
  }

  /**
   * Para efeito de pulsação
   */
  stopPulseEffect(): void {
    this.visualEffects.stopPulseEffect();
  }

  /**
   * Atualiza progresso visual
   */
  updateVisualProgress(percentage: number, state: VisualState): void {
    this.visualEffects.updateProgress(percentage, state);
  }

  /**
   * Obtém manager de efeitos visuais
   */
  getVisualEffects(): VisualEffectsManager {
    return this.visualEffects;
  }

  dispose(): void {
    // Limpar efeitos visuais
    this.visualEffects.dispose();
    
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
      console.log("StatusBarItem limpo.");
    }
    if (this.pomodoroStatusBarItem) {
      this.pomodoroStatusBarItem.dispose();
      this.pomodoroStatusBarItem = undefined;
      console.log("Pomodoro StatusBarItem limpo.");
    }
  }
}
