import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';
import { DatabaseManager, PomodoroConfig, PomodoroSession } from './database';
import { StatusBarManager } from './statusBar';
import { timeTrace } from './timeTrace';
import { VisualState } from './visualEffectsManager';

/**
 * Estados possíveis do Pomodoro
 */
export enum PomodoroState {
  INACTIVE = 'inactive',        // Pomodoro não está ativo
  FOCUS = 'focus',             // Sessão de foco ativa
  FOCUS_PAUSED = 'focus_paused', // Sessão de foco pausada
  SHORT_BREAK = 'short_break',  // Pausa curta
  LONG_BREAK = 'long_break',    // Pausa longa
  BREAK_EXTENDED = 'break_extended' // Pausa estendida
}

/**
 * Tipos de atividade para registro no banco
 */
export enum ActivityType {
  FOCUS = 'foco',
  BREAK = 'descanso', 
  BREAK_EXTENDED = 'descanso_estendido',
  IDLE = 'ocioso'
}

/**
 * Interface para eventos do Pomodoro
 */
export interface PomodoroEvents {
  onStateChange?: (state: PomodoroState) => void;
  onTimeUpdate?: (remainingSeconds: number) => void;
  onFocusStart?: (duration: number) => void;
  onFocusComplete?: () => void;
  onBreakStart?: (duration: number, type: 'short' | 'long') => void;
  onBreakComplete?: () => void;
  onSessionComplete?: (session: PomodoroSession) => void;
}

/**
 * Classe principal para gerenciar funcionalidades Pomodoro
 */
export class PomodoroManager {
  private currentState: PomodoroState = PomodoroState.INACTIVE;
  private currentSession: PomodoroSession | null = null;
  private config: PomodoroConfig | null = null;
  
  // Timers
  private focusTimer: NodeJS.Timeout | null = null;
  private breakTimer: NodeJS.Timeout | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;
  
  // Contadores de tempo (em segundos)
  private currentFocusTime: number = 0;
  private currentBreakTime: number = 0;
  private remainingTime: number = 0;
  
  // Controle de atividade
  private lastActivityTime: number = Date.now();
  private isUserActive: boolean = false;
  private sessionsCompletedToday: number = 0;
  
  // Eventos
  private events: PomodoroEvents = {};
  
  constructor(
    private dbManager: DatabaseManager,
    private statusBarManager: StatusBarManager,
    private timeTraceInstance?: timeTrace
  ) {
    console.log('🍅 PomodoroManager inicializado');
  }

  /**
   * Inicializa o Pomodoro Manager
   */
  async initialize(): Promise<void> {
    try {
      // Carregar configuração do banco
      await this.loadConfig();
      
      // Verificar se deve iniciar automaticamente
      if (this.config?.autoStartFocus) {
        console.log('🍅 Auto-start habilitado, aguardando atividade...');
      }
      
      // Inicializar timer de verificação de inatividade
      this.startInactivityCheck();
      
      console.log('🍅 PomodoroManager inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar PomodoroManager:', error);
      vscode.window.showErrorMessage(
        localize('pomodoro.initError', 'Error initializing Pomodoro system: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Carrega configuração do banco de dados
   */
  private async loadConfig(): Promise<void> {
    this.config = await this.dbManager.getPomodoroConfig();
    
    if (!this.config) {
      // Criar configuração padrão
      this.config = {
        focusDuration: 45,
        shortBreakDuration: 15,
        longBreakDuration: 30,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: true,
        autoStartFocus: false, // Padrão desativado para não incomodar
        enableSoundAlerts: true,
        enableDesktopNotifications: true,
        enableStatusBarTimer: true,
        dailyGoalSessions: 8
      };
      
      await this.dbManager.savePomodoroConfig(this.config);
      console.log('🍅 Configuração padrão do Pomodoro criada');
    }
  }

  /**
   * Registra eventos do Pomodoro
   */
  setEvents(events: PomodoroEvents): void {
    this.events = events;
  }

  /**
   * Notifica sobre mudança de estado
   */
  private notifyStateChange(newState: PomodoroState): void {
    const oldState = this.currentState;
    this.currentState = newState;
    
    // Aplicar efeitos visuais baseados no estado
    this.applyVisualEffects(newState, oldState);
    
    this.events.onStateChange?.(newState);
    this.updateStatusBar();
  }

  /**
   * Notifica sobre atualização de tempo
   */
  private notifyTimeUpdate(): void {
    this.events.onTimeUpdate?.(this.remainingTime);
    this.updateStatusBar();
    this.updateVisualProgress();
  }

  /**
   * Aplica efeitos visuais baseados no estado do Pomodoro
   */
  private applyVisualEffects(newState: PomodoroState, oldState: PomodoroState): void {
    const visualState = this.mapPomodoroToVisualState(newState);
    const isTransition = oldState !== newState;
    
    console.log(`🎨 Aplicando efeito visual: ${oldState} → ${newState} (${visualState})`);
    
    // Definir estado visual com animação se for transição
    this.statusBarManager.setVisualState(visualState, {
      animated: isTransition,
      duration: isTransition ? 1000 : 0
    });
    
    // Efeitos especiais para estados específicos
    switch (newState) {
      case PomodoroState.FOCUS:
        // Pulsação sutil durante foco
        this.statusBarManager.startPulseEffect(VisualState.FOCUS_ACTIVE, 3000);
        this.statusBarManager.showNotificationFlash('🎯 Sessão de foco iniciada!', 'info');
        break;
        
      case PomodoroState.FOCUS_PAUSED:
        this.statusBarManager.stopPulseEffect();
        this.statusBarManager.showNotificationFlash('⏸️ Foco pausado', 'warning');
        break;
        
      case PomodoroState.SHORT_BREAK:
      case PomodoroState.LONG_BREAK:
        this.statusBarManager.stopPulseEffect();
        this.statusBarManager.showNotificationFlash('☕ Hora do intervalo!', 'success');
        break;
        
      case PomodoroState.INACTIVE:
        this.statusBarManager.stopPulseEffect();
        break;
    }
  }

  /**
   * Mapeia estado do Pomodoro para estado visual
   */
  private mapPomodoroToVisualState(pomodoroState: PomodoroState): VisualState {
    switch (pomodoroState) {
      case PomodoroState.FOCUS:
        return VisualState.FOCUS_ACTIVE;
      case PomodoroState.FOCUS_PAUSED:
        return VisualState.PAUSED;
      case PomodoroState.SHORT_BREAK:
      case PomodoroState.LONG_BREAK:
      case PomodoroState.BREAK_EXTENDED:
        return VisualState.BREAK_ACTIVE;
      case PomodoroState.INACTIVE:
      default:
        return VisualState.IDLE;
    }
  }

  /**
   * Atualiza progresso visual baseado no tempo restante
   */
  private updateVisualProgress(): void {
    if (!this.config || this.currentState === PomodoroState.INACTIVE) {
      return;
    }

    let totalTime: number;
    let visualState: VisualState;

    switch (this.currentState) {
      case PomodoroState.FOCUS:
      case PomodoroState.FOCUS_PAUSED:
        totalTime = this.config.focusDuration * 60;
        visualState = this.currentState === PomodoroState.FOCUS 
          ? VisualState.FOCUS_ACTIVE 
          : VisualState.PAUSED;
        break;
      case PomodoroState.SHORT_BREAK:
        totalTime = this.config.shortBreakDuration * 60;
        visualState = VisualState.BREAK_ACTIVE;
        break;
      case PomodoroState.LONG_BREAK:
        totalTime = this.config.longBreakDuration * 60;
        visualState = VisualState.BREAK_ACTIVE;
        break;
      default:
        return;
    }

    const elapsed = totalTime - this.remainingTime;
    const percentage = Math.round((elapsed / totalTime) * 100);
    
    // Mudar para estado de "ending" nos últimos 10%
    if (percentage >= 90) {
      if (this.currentState === PomodoroState.FOCUS) {
        visualState = VisualState.FOCUS_ENDING;
      } else if (this.currentState === PomodoroState.SHORT_BREAK || this.currentState === PomodoroState.LONG_BREAK) {
        visualState = VisualState.BREAK_ENDING;
      }
    }

    this.statusBarManager.updateVisualProgress(percentage, visualState);
    
    // Alertas visuais em momentos chave
    if (percentage === 75) {
      this.statusBarManager.showNotificationFlash('75% completo!', 'info');
    } else if (percentage === 90) {
      this.statusBarManager.showNotificationFlash('Quase terminando...', 'warning');
    }
  }

  /**
   * Inicia sessão de foco
   */
  async startFocusSession(): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    try {
      // Parar qualquer timer existente
      this.stopAllTimers();
      
      // Criar nova sessão
      this.currentSession = {
        sessionType: 'focus',
        plannedDuration: this.config!.focusDuration * 60, // converter para segundos
        startTime: Math.floor(Date.now() / 1000),
        wasCompleted: false,
        wasInterrupted: false,
        associatedActivity: await this.getCurrentActivity()
      };
      
      // Resetar contadores
      this.currentFocusTime = 0;
      this.remainingTime = this.config!.focusDuration * 60;
      
      // Notificar mudança de estado
      this.notifyStateChange(PomodoroState.FOCUS);
      
      // Iniciar timer de foco
      this.startFocusTimer();
      
      // Disparar evento de início de foco
      this.events.onFocusStart?.(this.config!.focusDuration);
      
      // Mostrar notificação
      if (this.config!.enableDesktopNotifications) {
        vscode.window.showInformationMessage(
          localize('pomodoro.focusStarted', 'Pomodoro focus session started! 🍅 {0} minutes', this.config!.focusDuration)
        );
      }
      
      console.log(`🍅 Sessão de foco iniciada: ${this.config!.focusDuration} minutos`);
    } catch (error) {
      console.error('❌ Erro ao iniciar sessão de foco:', error);
      vscode.window.showErrorMessage(
        localize('pomodoro.focusStartError', 'Error starting focus session: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Inicia sessão de pausa
   */
  async startBreakSession(type: 'short' | 'long' = 'short'): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    try {
      // Parar timers existentes
      this.stopAllTimers();
      
      const duration = type === 'short' 
        ? this.config!.shortBreakDuration 
        : this.config!.longBreakDuration;
      
      // Criar nova sessão de pausa
      this.currentSession = {
        sessionType: type === 'short' ? 'short_break' : 'long_break',
        plannedDuration: duration * 60,
        startTime: Math.floor(Date.now() / 1000),
        wasCompleted: false,
        wasInterrupted: false
      };
      
      // Resetar contadores
      this.currentBreakTime = 0;
      this.remainingTime = duration * 60;
      
      // Notificar mudança de estado
      this.notifyStateChange(type === 'short' ? PomodoroState.SHORT_BREAK : PomodoroState.LONG_BREAK);
      
      // Iniciar timer de pausa
      this.startBreakTimer();
      
      // Disparar evento de início de pausa
      this.events.onBreakStart?.(duration, type);
      
      // Mostrar notificação
      if (this.config!.enableDesktopNotifications) {
        const breakType = type === 'short' ? 'short' : 'long';
        vscode.window.showInformationMessage(
          localize('pomodoro.breakStarted', '{0} break started! ☕ {1} minutes', breakType, duration)
        );
      }
      
      console.log(`☕ Sessão de pausa ${type} iniciada: ${duration} minutos`);
    } catch (error) {
      console.error('❌ Erro ao iniciar sessão de pausa:', error);
      vscode.window.showErrorMessage(
        localize('pomodoro.breakStartError', 'Error starting break session: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Pausa a sessão atual
   */
  async pauseSession(): Promise<void> {
    if (this.currentState === PomodoroState.FOCUS) {
      this.stopFocusTimer();
      this.notifyStateChange(PomodoroState.FOCUS_PAUSED);
      
      console.log('⏸️ Sessão de foco pausada');
      
      if (this.config?.enableDesktopNotifications) {
        vscode.window.showWarningMessage(
          localize('pomodoro.focusPaused', 'Focus session paused due to inactivity')
        );
      }
    }
  }

  /**
   * Resume a sessão pausada
   */
  async resumeSession(): Promise<void> {
    if (this.currentState === PomodoroState.FOCUS_PAUSED) {
      this.notifyStateChange(PomodoroState.FOCUS);
      this.startFocusTimer();
      
      console.log('▶️ Sessão de foco resumida');
      
      if (this.config?.enableDesktopNotifications) {
        vscode.window.showInformationMessage(
          localize('pomodoro.focusResumed', 'Focus session resumed! 🍅')
        );
      }
    }
  }

  /**
   * Completa a sessão atual
   */
  async completeSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      // Atualizar sessão com dados finais
      const now = Math.floor(Date.now() / 1000);
      this.currentSession.endTime = now;
      this.currentSession.actualDuration = now - this.currentSession.startTime;
      this.currentSession.wasCompleted = true;
      
      // Salvar no banco
      const sessionId = await this.dbManager.savePomodoroSession(this.currentSession);
      
      // Registrar como atividade também
      await this.saveAsActivity();
      
      // Notificar evento
      this.events.onSessionComplete?.(this.currentSession);
      
      // Incrementar contador de sessões
      if (this.currentSession.sessionType === 'focus') {
        this.sessionsCompletedToday++;
        this.events.onFocusComplete?.();
      } else {
        this.events.onBreakComplete?.();
      }
      
      console.log(`✅ Sessão ${this.currentSession.sessionType} completada (ID: ${sessionId})`);
      
      // Limpar sessão atual
      this.currentSession = null;
      this.notifyStateChange(PomodoroState.INACTIVE);
      
    } catch (error) {
      console.error('❌ Erro ao completar sessão:', error);
    }
  }

  /**
   * Para a sessão atual
   */
  async stopSession(): Promise<void> {
    if (this.currentSession) {
      // Marcar como interrompida
      this.currentSession.wasInterrupted = true;
      this.currentSession.endTime = Math.floor(Date.now() / 1000);
      this.currentSession.actualDuration = this.currentSession.endTime - this.currentSession.startTime;
      
      // Salvar sessão interrompida
      await this.dbManager.savePomodoroSession(this.currentSession);
      
      console.log(`⏹️ Sessão ${this.currentSession.sessionType} interrompida`);
    }
    
    this.stopAllTimers();
    this.currentSession = null;
    this.notifyStateChange(PomodoroState.INACTIVE);
  }

  /**
   * Estende tempo de foco
   */
  async extendFocus(additionalMinutes: number = 5): Promise<void> {
    if (this.currentState === PomodoroState.FOCUS || this.currentState === PomodoroState.FOCUS_PAUSED) {
      this.remainingTime += additionalMinutes * 60;
      
      if (this.currentSession) {
        this.currentSession.plannedDuration += additionalMinutes * 60;
      }
      
      console.log(`⏰ Sessão de foco estendida por ${additionalMinutes} minutos`);
      
      if (this.config?.enableDesktopNotifications) {
        vscode.window.showInformationMessage(
          localize('pomodoro.focusExtended', 'Focus session extended by {0} minutes 🍅', additionalMinutes)
        );
      }
      
      this.notifyTimeUpdate();
    }
  }

  /**
   * Notifica sobre atividade do usuário
   */
  onUserActivity(): void {
    const now = Date.now();
    this.lastActivityTime = now;
    this.isUserActive = true;
    
    // Auto-start se configurado e condições forem atendidas
    if (this.shouldAutoStartFocus()) {
      console.log('🍅 Auto-iniciando sessão de foco - atividade de codificação detectada');
      this.startFocusSession();
    }
    
    // Resume sessão pausada se dentro do limite
    if (this.currentState === PomodoroState.FOCUS_PAUSED) {
      const inactiveTime = now - this.lastActivityTime;
      const breakDuration = (this.config?.shortBreakDuration || 15) * 60 * 1000; // em ms
      
      if (inactiveTime < breakDuration) {
        this.resumeSession();
      } else {
        // Muito tempo inativo, reiniciar
        this.resetSession();
      }
    }
  }

  /**
   * Reseta a sessão atual
   */
  async resetSession(): Promise<void> {
    console.log('🔄 Resetando sessão devido à inatividade prolongada');
    
    if (this.currentSession) {
      this.currentSession.wasInterrupted = true;
      this.currentSession.interruptionReason = 'Extended inactivity';
      await this.completeSession();
    }
    
    this.stopAllTimers();
    this.notifyStateChange(PomodoroState.INACTIVE);
  }

  /**
   * Verifica se deve mostrar modal de pausa
   */
  async checkForBreakModal(): Promise<boolean> {
    if (this.currentState === PomodoroState.FOCUS && this.remainingTime <= 0) {
      await this.completeSession();
      
      // Mostrar modal de pausa será implementado na FASE 3
      console.log('🔔 Tempo de mostrar modal de pausa!');
      
      return true;
    }
    
    return false;
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): PomodoroConfig | null {
    return this.config;
  }

  /**
   * Atualiza configuração
   */
  async updateConfig(newConfig: Partial<PomodoroConfig>): Promise<void> {
    if (this.config) {
      this.config = { ...this.config, ...newConfig };
      await this.dbManager.savePomodoroConfig(this.config);
      
      console.log('🍅 Configuração do Pomodoro atualizada');
    }
  }

  /**
   * Obtém estado atual
   */
  getCurrentState(): PomodoroState {
    return this.currentState;
  }

  /**
   * Obtém tempo restante em segundos
   */
  getRemainingTime(): number {
    return this.remainingTime;
  }

  /**
   * Verifica se Pomodoro está ativo
   */
  isActive(): boolean {
    return this.currentState !== PomodoroState.INACTIVE;
  }

  /**
   * Timer de foco
   */
  private startFocusTimer(): void {
    this.focusTimer = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.currentFocusTime++;
        this.notifyTimeUpdate();
      } else {
        this.checkForBreakModal();
      }
    }, 1000);
  }

  /**
   * Timer de pausa
   */
  private startBreakTimer(): void {
    this.breakTimer = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.currentBreakTime++;
        this.notifyTimeUpdate();
      } else {
        this.completeSession();
        
        // Auto-start próxima sessão se configurado
        if (this.config?.autoStartFocus) {
          setTimeout(() => this.startFocusSession(), 1000);
        }
      }
    }, 1000);
  }

  /**
   * Para timer de foco
   */
  private stopFocusTimer(): void {
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = null;
    }
  }

  /**
   * Para timer de pausa
   */
  private stopBreakTimer(): void {
    if (this.breakTimer) {
      clearInterval(this.breakTimer);
      this.breakTimer = null;
    }
  }

  /**
   * Para todos os timers
   */
  private stopAllTimers(): void {
    this.stopFocusTimer();
    this.stopBreakTimer();
  }

  /**
   * Inicia verificação de inatividade
   */
  private startInactivityCheck(): void {
    this.inactivityTimer = setInterval(() => {
      this.checkInactivity();
    }, 30000); // Verificar a cada 30 segundos
  }

  /**
   * Verifica inatividade do usuário
   */
  private checkInactivity(): void {
    const now = Date.now();
    const inactiveTime = now - this.lastActivityTime;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutos em ms
    
    // Se inativo por mais de 5 minutos durante foco, pausar
    if (inactiveTime > fiveMinutes && this.currentState === PomodoroState.FOCUS) {
      console.log('😴 Usuário inativo por mais de 5 minutos, pausando sessão');
      this.pauseSession();
    }
  }

  /**
   * Atualiza status bar com informações do Pomodoro
   */
  private updateStatusBar(): void {
    if (!this.config?.enableStatusBarTimer) {
      return;
    }

    if (this.currentState === PomodoroState.INACTIVE) {
      // Ocultar status bar do Pomodoro quando inativo
      this.statusBarManager.hidePomodoroStatus();
      return;
    }

    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    let icon = '';
    let stateText = '';
    
    switch (this.currentState) {
      case PomodoroState.FOCUS:
        icon = '🍅';
        stateText = 'Foco';
        break;
      case PomodoroState.FOCUS_PAUSED:
        icon = '⏸️';
        stateText = 'Pausado';
        break;
      case PomodoroState.SHORT_BREAK:
        icon = '☕';
        stateText = 'Pausa';
        break;
      case PomodoroState.LONG_BREAK:
        icon = '🏖️';
        stateText = 'Pausa Longa';
        break;
      case PomodoroState.BREAK_EXTENDED:
        icon = '⏰';
        stateText = 'Pausa Extra';
        break;
    }
    
    // Integrar com statusBarManager existente
    this.updatePomodoroStatusBar(icon, stateText, timeStr);
  }

  /**
   * Atualiza status bar especificamente para Pomodoro
   */
  private updatePomodoroStatusBar(icon: string, state: string, time: string): void {
    this.statusBarManager.updatePomodoro(icon, state, time, true);
  }

  /**
   * Verifica se a atividade atual é de codificação
   */
  private isCodingActivity(): boolean {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }
    
    const fileName = editor.document.fileName.toLowerCase();
    const codingExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
      '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.vue',
      '.html', '.css', '.scss', '.sass', '.less', '.sql', '.json',
      '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'
    ];
    
    return codingExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Verifica se deve iniciar sessão automaticamente
   */
  private shouldAutoStartFocus(): boolean {
    return (
      this.config?.autoStartFocus === true &&
      this.currentState === PomodoroState.INACTIVE &&
      this.isCodingActivity() &&
      this.timeTraceInstance?.isActivelyCoding() === true
    );
  }
  /**
   * Obtém atividade atual (usando dados do timeTrace quando disponível)
   */
  private async getCurrentActivity(): Promise<string> {
    // Tentar obter dados do timeTrace primeiro
    if (this.timeTraceInstance) {
      const currentProject = this.timeTraceInstance.getCurrentProject();
      const currentFile = this.timeTraceInstance.getCurrentFile();
      
      if (currentProject && currentFile) {
        return `${currentProject} - ${currentFile}`;
      }
    }
    
    // Fallback para dados diretos do VSCode
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const fileName = editor.document.fileName;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const projectName = workspaceFolder?.name || 'Unknown Project';
      
      return `${projectName} - ${fileName}`;
    }
    
    return 'General Development';
  }

  /**
   * Salva sessão como atividade no sistema existente
   */
  private async saveAsActivity(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      let activityType: string;
      
      switch (this.currentSession.sessionType) {
        case 'focus':
          activityType = ActivityType.FOCUS;
          break;
        case 'short_break':
        case 'long_break':
          activityType = ActivityType.BREAK;
          break;
        default:
          activityType = ActivityType.IDLE;
      }
      
      // Salvar como ActivityData compatível com sistema existente
      await this.dbManager.saveActivityData({
        timestamp: new Date(this.currentSession.startTime * 1000).toISOString(),
        project: await this.getCurrentActivity(),
        file: vscode.window.activeTextEditor?.document.fileName,
        duration: this.currentSession.actualDuration || 0,
        isIdle: activityType === ActivityType.IDLE
      });
      
      console.log(`💾 Sessão salva como atividade: ${activityType}`);
    } catch (error) {
      console.error('❌ Erro ao salvar atividade:', error);
    }
  }

  /**
   * Cleanup ao desativar extensão
   */
  dispose(): void {
    console.log('🍅 Fazendo cleanup do PomodoroManager...');
    
    // Parar todos os timers
    this.stopAllTimers();
    
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    // Salvar sessão atual se existir
    if (this.currentSession) {
      this.currentSession.wasInterrupted = true;
      this.currentSession.interruptionReason = 'Extension deactivated';
      this.dbManager.savePomodoroSession(this.currentSession)
        .catch(error => console.error('❌ Erro ao salvar sessão final:', error));
    }
    
    console.log('✅ PomodoroManager cleanup concluído');
  }
}
