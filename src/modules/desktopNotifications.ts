/**
 * Sistema de Notificações Desktop para MyTime Trace VSCode
 * 
 * Este módulo gerencia notificações nativas do sistema operacional,
 * integrando com o sistema visual e de sons da extensão.
 */

import * as vscode from 'vscode';

// Tipos de notificações
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  FOCUS_COMPLETE = 'focus_complete',
  BREAK_START = 'break_start',
  BREAK_COMPLETE = 'break_complete',
  POMODORO_CYCLE = 'pomodoro_cycle'
}

// Configurações de notificação
export interface NotificationConfig {
  title: string;
  message: string;
  type: NotificationType;
  duration?: number; // em segundos, 0 = permanente até ação
  actions?: NotificationAction[];
  sound?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresInteraction?: boolean;
  silent?: boolean;
  icon?: string;
  image?: string;
  tag?: string; // para agrupar notificações similares
}

// Ações disponíveis nas notificações
export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  onClick?: () => void | Promise<void>;
}

// Resultado de uma notificação
export interface NotificationResult {
  id: string;
  action?: string;
  dismissed: boolean;
  interactionTime?: Date;
}

// Configurações globais do sistema
export interface DesktopNotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  focusNotifications: boolean;
  breakNotifications: boolean;
  systemIntegration: boolean;
  doNotDisturb: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  priority: {
    minimumLevel: 'low' | 'normal' | 'high' | 'urgent';
    focusMode: boolean; // só notificações urgentes em modo foco
  };
}

/**
 * Gerenciador principal de notificações desktop
 */
export class DesktopNotificationManager {
  private static instance: DesktopNotificationManager;
  private context: vscode.ExtensionContext | null = null;
  private settings: DesktopNotificationSettings;
  private activeNotifications: Map<string, NotificationResult> = new Map();
  private notificationQueue: NotificationConfig[] = [];
  private isProcessingQueue = false;
  
  constructor() {
    this.settings = this.getDefaultSettings();
  }

  public static getInstance(): DesktopNotificationManager {
    if (!DesktopNotificationManager.instance) {
      DesktopNotificationManager.instance = new DesktopNotificationManager();
    }
    return DesktopNotificationManager.instance;
  }

  /**
   * Inicializa o gerenciador de notificações
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.loadSettings();
    this.startQueueProcessor();
    
    console.log('🔔 DesktopNotificationManager inicializado');
  }

  /**
   * Configurações padrão
   */
  private getDefaultSettings(): DesktopNotificationSettings {
    return {
      enabled: true,
      soundEnabled: true,
      focusNotifications: true,
      breakNotifications: true,
      systemIntegration: true,
      doNotDisturb: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      priority: {
        minimumLevel: 'normal',
        focusMode: false
      }
    };
  }

  /**
   * Carrega configurações do usuário
   */
  private loadSettings(): void {
    if (!this.context) {
      return;
    }

    const config = vscode.workspace.getConfiguration('myTimeTrace.notifications');
    
    this.settings = {
      enabled: config.get('enabled', true),
      soundEnabled: config.get('soundEnabled', true),
      focusNotifications: config.get('focusNotifications', true),
      breakNotifications: config.get('breakNotifications', true),
      systemIntegration: config.get('systemIntegration', true),
      doNotDisturb: config.get('doNotDisturb', false),
      quietHours: {
        enabled: config.get('quietHours.enabled', false),
        start: config.get('quietHours.start', '22:00'),
        end: config.get('quietHours.end', '08:00')
      },
      priority: {
        minimumLevel: config.get('priority.minimumLevel', 'normal'),
        focusMode: config.get('priority.focusMode', false)
      }
    };
  }

  /**
   * Exibe uma notificação desktop
   */
  public async showNotification(config: NotificationConfig): Promise<NotificationResult> {
    if (!this.shouldShowNotification(config)) {
      console.log(`🔕 Notificação suprimida: ${config.title}`);
      return {
        id: this.generateId(),
        dismissed: true
      };
    }

    const notificationId = this.generateId();
    
    try {
      // Log da notificação
      console.log(`🔔 Exibindo notificação: ${config.title} - ${config.message}`);
      
      const result = await this.displayNotification(notificationId, config);
      this.activeNotifications.set(notificationId, result);
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao exibir notificação:', error);
      return {
        id: notificationId,
        dismissed: true
      };
    }
  }

  /**
   * Verifica se deve exibir a notificação
   */
  private shouldShowNotification(config: NotificationConfig): boolean {
    // Notificações desabilitadas
    if (!this.settings.enabled) {
      return false;
    }
    
    // Modo não perturbe ativado
    if (this.settings.doNotDisturb && config.priority !== 'urgent') {
      return false;
    }
    
    // Verificar horário silencioso
    if (this.isQuietHours() && config.priority !== 'urgent') {
      return false;
    }
    
    // Verificar nível mínimo de prioridade
    const priorityLevels = ['low', 'normal', 'high', 'urgent'];
    const configPriority = priorityLevels.indexOf(config.priority || 'normal');
    const minPriority = priorityLevels.indexOf(this.settings.priority.minimumLevel);
    
    if (configPriority < minPriority) {
      return false;
    }
    
    // Verificar tipo específico
    if (config.type === NotificationType.FOCUS_COMPLETE && !this.settings.focusNotifications) {
      return false;
    }
    if ([NotificationType.BREAK_START, NotificationType.BREAK_COMPLETE].includes(config.type) && !this.settings.breakNotifications) {
      return false;
    }
    
    return true;
  }

  /**
   * Verifica se está em horário silencioso
   */
  private isQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = this.settings.quietHours.start;
    const end = this.settings.quietHours.end;
    
    // Verificar se o horário silencioso cruza a meia-noite
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Exibe a notificação usando a API do VS Code
   */
  private async displayNotification(id: string, config: NotificationConfig): Promise<NotificationResult> {
    const result: NotificationResult = {
      id,
      dismissed: false,
      interactionTime: new Date()
    };

    // Mapear tipo para método do VS Code
    let selectedAction: string | undefined;
    
    const actionLabels = config.actions?.map(action => action.title) || [];
    
    switch (config.type) {
      case NotificationType.ERROR:
        selectedAction = await vscode.window.showErrorMessage(
          `${config.title}: ${config.message}`,
          ...actionLabels
        );
        break;
        
      case NotificationType.WARNING:
        selectedAction = await vscode.window.showWarningMessage(
          `${config.title}: ${config.message}`,
          ...actionLabels
        );
        break;
        
      case NotificationType.SUCCESS:
      case NotificationType.FOCUS_COMPLETE:
      case NotificationType.BREAK_COMPLETE:
      case NotificationType.POMODORO_CYCLE:
        selectedAction = await vscode.window.showInformationMessage(
          `${config.title}: ${config.message}`,
          ...actionLabels
        );
        break;
        
      default:
        selectedAction = await vscode.window.showInformationMessage(
          `${config.title}: ${config.message}`,
          ...actionLabels
        );
        break;
    }

    // Processar ação selecionada
    if (selectedAction && config.actions) {
      const action = config.actions.find(a => a.title === selectedAction);
      if (action) {
        result.action = action.id;
        try {
          await action.onClick?.();
        } catch (error) {
          console.error(`❌ Erro ao executar ação ${action.id}:`, error);
        }
      }
    }

    result.dismissed = !selectedAction;
    
    return result;
  }

  /**
   * Adiciona notificação à fila
   */
  public queueNotification(config: NotificationConfig): void {
    this.notificationQueue.push(config);
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Processa fila de notificações
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.notificationQueue.length > 0) {
      const config = this.notificationQueue.shift();
      if (config) {
        await this.showNotification(config);
        
        // Pequena pausa entre notificações
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Inicia processador da fila
   */
  private startQueueProcessor(): void {
    // Processar fila a cada 2 segundos
    setInterval(() => {
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    }, 2000);
  }

  /**
   * Métodos de conveniência para tipos específicos
   */
  public showFocusCompleteNotification(duration: number, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '🎯 Foco Completo!',
      message: `Parabéns! Você focou por ${duration} minutos.`,
      type: NotificationType.FOCUS_COMPLETE,
      priority: 'high',
      requiresInteraction: true,
      actions: [
        {
          id: 'continue',
          title: 'Continuar Focando',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.startPomodoroFocus');
          }
        },
        {
          id: 'break',
          title: 'Fazer Pausa',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.startBreak');
          }
        }
      ],
      ...options
    });
  }

  public showBreakStartNotification(duration: number, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '☕ Hora da Pausa!',
      message: `Tempo de descansar por ${duration} minutos.`,
      type: NotificationType.BREAK_START,
      priority: 'normal',
      actions: [
        {
          id: 'ok',
          title: 'OK',
        },
        {
          id: 'skip',
          title: 'Pular Pausa',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.startPomodoroFocus');
          }
        }
      ],
      ...options
    });
  }

  public showBreakCompleteNotification(options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '⚡ Pausa Terminada!',
      message: 'Hora de voltar ao foco!',
      type: NotificationType.BREAK_COMPLETE,
      priority: 'normal',
      actions: [
        {
          id: 'focus',
          title: 'Iniciar Foco',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.startPomodoroFocus');
          }
        },
        {
          id: 'extend',
          title: 'Estender Pausa',
          onClick: () => console.log('🔄 Pausa estendida por mais 5 minutos')
        }
      ],
      ...options
    });
  }

  public showPomodoroCompleteNotification(cycles: number, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '🎉 Pomodoro Completo!',
      message: `Parabéns! Você completou ${cycles} ciclos de Pomodoro.`,
      type: NotificationType.POMODORO_CYCLE,
      priority: 'high',
      requiresInteraction: true,
      actions: [
        {
          id: 'stats',
          title: 'Ver Estatísticas',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.showStats');
          }
        },
        {
          id: 'continue',
          title: 'Novo Ciclo',
          onClick: async () => {
            await vscode.commands.executeCommand('my-time-trace-vscode.startPomodoroFocus');
          }
        }
      ],
      ...options
    });
  }

  public showSuccessNotification(message: string, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '✅ Sucesso',
      message,
      type: NotificationType.SUCCESS,
      priority: 'normal',
      ...options
    });
  }

  public showWarningNotification(message: string, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '⚠️ Atenção',
      message,
      type: NotificationType.WARNING,
      priority: 'normal',
      ...options
    });
  }

  public showErrorNotification(message: string, options?: Partial<NotificationConfig>): Promise<NotificationResult> {
    return this.showNotification({
      title: '❌ Erro',
      message,
      type: NotificationType.ERROR,
      priority: 'high',
      ...options
    });
  }

  /**
   * Gerenciamento de configurações
   */
  public updateSettings(newSettings: Partial<DesktopNotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getSettings(): DesktopNotificationSettings {
    return { ...this.settings };
  }

  private saveSettings(): void {
    if (!this.context) {
      return;
    }

    const config = vscode.workspace.getConfiguration('myTimeTrace.notifications');
    
    Object.keys(this.settings).forEach(key => {
      const value = (this.settings as any)[key];
      config.update(key, value, vscode.ConfigurationTarget.Global);
    });
  }

  /**
   * Controle de notificações ativas
   */
  public getActiveNotifications(): NotificationResult[] {
    return Array.from(this.activeNotifications.values());
  }

  public dismissNotification(id: string): boolean {
    if (this.activeNotifications.has(id)) {
      const notification = this.activeNotifications.get(id)!;
      notification.dismissed = true;
      return true;
    }
    return false;
  }

  public clearAllNotifications(): void {
    this.activeNotifications.clear();
    this.notificationQueue.length = 0;
  }

  /**
   * Métodos de teste
   */
  public async testNotificationSystem(): Promise<void> {
    console.log('🧪 Testando sistema de notificações...');
    
    const tests = [
      {
        title: 'Teste Informação',
        message: 'Esta é uma notificação de teste de informação.',
        type: NotificationType.INFO
      },
      {
        title: 'Teste Sucesso',
        message: 'Esta é uma notificação de teste de sucesso.',
        type: NotificationType.SUCCESS
      },
      {
        title: 'Teste Aviso',
        message: 'Esta é uma notificação de teste de aviso.',
        type: NotificationType.WARNING
      },
      {
        title: 'Teste Foco Completo',
        message: 'Simulação de foco completo.',
        type: NotificationType.FOCUS_COMPLETE
      }
    ];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`🔔 Teste ${i + 1}/${tests.length}: ${test.title}`);
      
      await this.showNotification(test as NotificationConfig);
      
      // Pausa entre testes
      if (i < tests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('✅ Teste do sistema de notificações concluído!');
  }

  /**
   * Utilities
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.clearAllNotifications();
    this.context = null;
    console.log('🔔 DesktopNotificationManager finalizado');
  }
}

// Exportar instância singleton
export const desktopNotificationManager = DesktopNotificationManager.getInstance();
