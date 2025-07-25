import * as vscode from 'vscode';

/**
 * Estados visuais possíveis do Pomodoro
 */
export enum VisualState {
  IDLE = 'idle',
  FOCUS_ACTIVE = 'focus_active',
  FOCUS_ENDING = 'focus_ending',
  BREAK_ACTIVE = 'break_active',
  BREAK_ENDING = 'break_ending',
  PAUSED = 'paused',
  NOTIFICATION = 'notification',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Configuração de tema visual
 */
export interface VisualTheme {
  name: string;
  colors: {
    idle: string;
    focus: string;
    focusEnding: string;
    break: string;
    breakEnding: string;
    paused: string;
    notification: string;
    success: string;
    warning: string;
    error: string;
  };
  icons: {
    idle: string;
    focus: string;
    focusEnding: string;
    break: string;
    breakEnding: string;
    paused: string;
    notification: string;
    success: string;
    warning: string;
    error: string;
  };
}

/**
 * Efeito de animação
 */
export interface AnimationEffect {
  type: 'pulse' | 'fade' | 'blink' | 'slide' | 'bounce' | 'rotate';
  duration: number; // em milissegundos
  intensity: 'low' | 'medium' | 'high';
  repeat?: number; // quantas vezes repetir (0 = infinito)
}

/**
 * Configuração de alerta visual
 */
export interface VisualAlert {
  state: VisualState;
  message: string;
  duration: number; // duração do alerta em ms
  animation?: AnimationEffect;
  color?: string;
  icon?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Gerenciador de efeitos visuais para a extensão
 * Controla animações, cores dinâmicas e alertas visuais
 */
export class VisualEffectsManager {
  private static instance: VisualEffectsManager;
  private statusBarItem: vscode.StatusBarItem | null = null;
  private currentState: VisualState = VisualState.IDLE;
  private currentTheme: VisualTheme;
  private animationTimer: NodeJS.Timeout | null = null;
  private alertQueue: VisualAlert[] = [];
  private isAnimating: boolean = false;

  private constructor() {
    this.currentTheme = this.getDefaultTheme();
  }

  public static getInstance(): VisualEffectsManager {
    if (!VisualEffectsManager.instance) {
      VisualEffectsManager.instance = new VisualEffectsManager();
    }
    return VisualEffectsManager.instance;
  }

  /**
   * Inicializa o gerenciador com referência à barra de status
   */
  public initialize(statusBarItem: vscode.StatusBarItem): void {
    this.statusBarItem = statusBarItem;
    this.applyVisualState(VisualState.IDLE);
    console.log('🎨 VisualEffectsManager inicializado');
  }

  /**
   * Tema visual padrão
   */
  private getDefaultTheme(): VisualTheme {
    return {
      name: 'Produtividade Clássica',
      colors: {
        idle: '#858585',           // Cinza neutro
        focus: '#4A90E2',          // Azul produtivo
        focusEnding: '#F5A623',    // Amarelo alerta
        break: '#7ED321',          // Verde relaxante
        breakEnding: '#F5A623',    // Amarelo alerta
        paused: '#BD10E0',         // Roxo pausa
        notification: '#50E3C2',   // Ciano notificação
        success: '#7ED321',        // Verde sucesso
        warning: '#F5A623',        // Amarelo aviso
        error: '#D0021B'           // Vermelho erro
      },
      icons: {
        idle: '$(clock)',
        focus: '$(target)',
        focusEnding: '$(warning)',
        break: '$(coffee)',
        breakEnding: '$(bell)',
        paused: '$(debug-pause)',
        notification: '$(bell)',
        success: '$(check)',
        warning: '$(warning)',
        error: '$(error)'
      }
    };
  }

  /**
   * Define o estado visual atual
   */
  public setState(state: VisualState, options?: {
    message?: string;
    animated?: boolean;
    duration?: number;
  }): void {
    if (this.currentState === state && !options?.animated) {
      return; // Não mudar se já está no mesmo estado
    }

    console.log(`🎨 Mudando estado visual: ${this.currentState} → ${state}`);
    
    this.currentState = state;
    
    if (options?.animated) {
      this.animateStateTransition(state, options.duration || 1000);
    } else {
      this.applyVisualState(state, options?.message);
    }
  }

  /**
   * Aplica o estado visual à barra de status
   */
  private applyVisualState(state: VisualState, customMessage?: string): void {
    if (!this.statusBarItem) {
      console.warn('🚨 StatusBarItem não disponível para aplicar estado visual');
      return;
    }

    const theme = this.currentTheme;
    const colorKey = this.getColorKey(state);
    const iconKey = this.getIconKey(state);
    const color = theme.colors[colorKey];
    const icon = theme.icons[iconKey];
    
    console.log(`🔍 Debug estado visual: ${state}`);
    console.log(`🔍 Chave cor: ${colorKey} → ${color}`);
    console.log(`🔍 Chave ícone: ${iconKey} → ${icon}`);
    
    // Verificar se cor e ícone existem
    if (!color) {
      console.error(`❌ Cor não encontrada para estado ${state} (chave: ${colorKey})`);
      console.log('🎨 Tema atual:', theme.name);
      console.log('🎨 Cores disponíveis:', Object.keys(theme.colors));
      return;
    }
    
    if (!icon) {
      console.error(`❌ Ícone não encontrado para estado ${state} (chave: ${iconKey})`);
      console.log('🎨 Ícones disponíveis:', Object.keys(theme.icons));
      return;
    }
    
    // Aplicar cor
    this.statusBarItem.color = color;
    
    // Aplicar ícone se uma mensagem customizada não foi fornecida
    if (!customMessage && this.statusBarItem.text) {
      // Preservar texto atual mas atualizar ícone
      const currentText = this.statusBarItem.text;
      const textWithoutIcon = currentText.replace(/\$\([^)]+\)\s*/, '');
      this.statusBarItem.text = `${icon} ${textWithoutIcon}`;
    }

    console.log(`🎨 Estado aplicado: ${state} (cor: ${color}, ícone: ${icon})`);
  }

  /**
   * Anima transição entre estados
   */
  private animateStateTransition(targetState: VisualState, duration: number): void {
    if (this.isAnimating) {
      this.stopCurrentAnimation();
    }

    this.isAnimating = true;
    const steps = 10;
    const stepDuration = duration / steps;
    let currentStep = 0;

    console.log(`🎬 Iniciando animação para ${targetState} (${duration}ms)`);

    const animate = () => {
      if (currentStep >= steps) {
        this.isAnimating = false;
        this.applyVisualState(targetState);
        console.log(`🎬 Animação concluída: ${targetState}`);
        return;
      }

      // Efeito de fade/pulse durante transição
      if (this.statusBarItem) {
        const progress = currentStep / steps;
        const opacity = Math.sin(progress * Math.PI); // Efeito senoidal
        
        // Simular fade alterando entre cores
        if (currentStep % 2 === 0) {
          this.applyVisualState(targetState);
        } else {
          this.applyVisualState(this.currentState);
        }
      }

      currentStep++;
      this.animationTimer = setTimeout(animate, stepDuration);
    };

    animate();
  }

  /**
   * Para animação atual
   */
  private stopCurrentAnimation(): void {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    this.isAnimating = false;
  }

  /**
   * Exibe alerta visual temporário
   */
  public showAlert(alert: VisualAlert): void {
    console.log(`🚨 Exibindo alerta: ${alert.state} - ${alert.message}`);
    
    this.alertQueue.push(alert);
    
    if (!this.isAnimating) {
      this.processNextAlert();
    }
  }

  /**
   * Processa próximo alerta na fila
   */
  private processNextAlert(): void {
    if (this.alertQueue.length === 0) {
      return;
    }

    const alert = this.alertQueue.shift()!;
    const originalState = this.currentState;
    
    // Aplicar estado do alerta
    this.setState(alert.state, { 
      message: alert.message, 
      animated: !!alert.animation 
    });

    // Programar retorno ao estado anterior
    setTimeout(() => {
      this.setState(originalState);
      this.processNextAlert(); // Processar próximo alerta
    }, alert.duration);
  }

  /**
   * Inicia efeito de pulsação contínua
   */
  public startPulseEffect(state: VisualState, interval: number = 1000): void {
    this.stopCurrentAnimation();
    
    console.log(`💓 Iniciando efeito de pulsação: ${state}`);
    
    let isPulsing = false;
    
    const pulse = () => {
      if (!this.statusBarItem) {
        return;
      }

      isPulsing = !isPulsing;
      
      if (isPulsing) {
        // Estado pulsante (mais brilhante)
        this.applyVisualState(state);
        this.statusBarItem.color = this.brightenColor(this.currentTheme.colors[this.getColorKey(state)]);
      } else {
        // Estado normal
        this.applyVisualState(state);
      }
    };

    // Iniciar pulsação
    this.animationTimer = setInterval(pulse, interval);
  }

  /**
   * Para efeito de pulsação
   */
  public stopPulseEffect(): void {
    this.stopCurrentAnimation();
    this.applyVisualState(this.currentState);
    console.log('💓 Efeito de pulsação parado');
  }

  /**
   * Efeito de notificação rápida
   */
  public notificationFlash(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const stateMap = {
      info: VisualState.NOTIFICATION,
      success: VisualState.SUCCESS,
      warning: VisualState.WARNING,
      error: VisualState.ERROR
    };

    this.showAlert({
      state: stateMap[type],
      message,
      duration: 2000,
      animation: {
        type: 'blink',
        duration: 200,
        intensity: 'medium',
        repeat: 3
      },
      priority: 'medium'
    });
  }

  /**
   * Progresso visual (para contagem regressiva)
   */
  public updateProgress(percentage: number, state: VisualState): void {
    if (!this.statusBarItem) {
      return;
    }

    // Determinar cor baseada no progresso
    let color = this.currentTheme.colors[this.getColorKey(state)];
    
    if (percentage <= 10) {
      // Últimos 10% - cor de alerta
      color = this.currentTheme.colors.warning;
    } else if (percentage <= 25) {
      // Últimos 25% - cor de atenção
      color = this.mixColors(
        this.currentTheme.colors[this.getColorKey(state)],
        this.currentTheme.colors.warning,
        0.5
      );
    }

    this.statusBarItem.color = color;
    
    // Adicionar indicador visual de progresso no texto se desejar
    // Exemplo: "🎯 Focus (██████░░░░) 60%"
  }

  /**
   * Utilitários de cor
   */
  private brightenColor(hexColor: string, factor: number = 0.3): string {
    // Simplificado - em produção usaria biblioteca de cor
    const hex = hexColor.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.round(255 * factor));
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.round(255 * factor));
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.round(255 * factor));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private mixColors(color1: string, color2: string, factor: number): string {
    // Simplificado - mistura duas cores
    return factor > 0.5 ? color2 : color1;
  }

  /**
   * Mapeia estado para chave de cor
   */
  private getColorKey(state: VisualState): keyof VisualTheme['colors'] {
    const mapping: Record<VisualState, keyof VisualTheme['colors']> = {
      [VisualState.IDLE]: 'idle',
      [VisualState.FOCUS_ACTIVE]: 'focus',
      [VisualState.FOCUS_ENDING]: 'focusEnding',
      [VisualState.BREAK_ACTIVE]: 'break',
      [VisualState.BREAK_ENDING]: 'breakEnding',
      [VisualState.PAUSED]: 'paused',
      [VisualState.NOTIFICATION]: 'notification',
      [VisualState.SUCCESS]: 'success',
      [VisualState.WARNING]: 'warning',
      [VisualState.ERROR]: 'error'
    };
    return mapping[state];
  }

  /**
   * Mapeia estado para chave de ícone
   */
  private getIconKey(state: VisualState): keyof VisualTheme['icons'] {
    return this.getColorKey(state) as keyof VisualTheme['icons'];
  }

  /**
   * Obtém estado atual
   */
  public getCurrentState(): VisualState {
    return this.currentState;
  }

  /**
   * Obtém tema atual
   */
  public getCurrentTheme(): VisualTheme {
    return this.currentTheme;
  }

  /**
   * Define tema personalizado
   */
  public setTheme(theme: VisualTheme): void {
    this.currentTheme = theme;
    this.applyVisualState(this.currentState);
    console.log(`🎨 Tema alterado para: ${theme.name}`);
  }

  /**
   * Lista temas disponíveis
   */
  public getAvailableThemes(): VisualTheme[] {
    return [
      this.getDefaultTheme(),
      this.getDarkTheme(),
      this.getHighContrastTheme(),
      this.getMinimalTheme()
    ];
  }

  /**
   * Tema escuro
   */
  private getDarkTheme(): VisualTheme {
    return {
      name: 'Modo Escuro',
      colors: {
        idle: '#6C6C6C',
        focus: '#5DADE2',
        focusEnding: '#F39C12',
        break: '#58D68D',
        breakEnding: '#F39C12',
        paused: '#BB8FCE',
        notification: '#48C9B0',
        success: '#58D68D',
        warning: '#F39C12',
        error: '#E74C3C'
      },
      icons: {
        idle: '$(clock)',
        focus: '$(flame)',
        focusEnding: '$(warning)',
        break: '$(heart)',
        breakEnding: '$(bell)',
        paused: '$(debug-pause)',
        notification: '$(bell)',
        success: '$(check)',
        warning: '$(warning)',
        error: '$(error)'
      }
    };
  }

  /**
   * Tema de alto contraste
   */
  private getHighContrastTheme(): VisualTheme {
    return {
      name: 'Alto Contraste',
      colors: {
        idle: '#FFFFFF',
        focus: '#00FF00',
        focusEnding: '#FFFF00',
        break: '#00FFFF',
        breakEnding: '#FFFF00',
        paused: '#FF00FF',
        notification: '#00FFFF',
        success: '#00FF00',
        warning: '#FFFF00',
        error: '#FF0000'
      },
      icons: {
        idle: '$(clock)',
        focus: '$(target)',
        focusEnding: '$(alert)',
        break: '$(smiley)',
        breakEnding: '$(bell)',
        paused: '$(debug-pause)',
        notification: '$(megaphone)',
        success: '$(check)',
        warning: '$(alert)',
        error: '$(x)'
      }
    };
  }

  /**
   * Tema minimalista
   */
  private getMinimalTheme(): VisualTheme {
    return {
      name: 'Minimalista',
      colors: {
        idle: '#999999',
        focus: '#333333',
        focusEnding: '#666666',
        break: '#777777',
        breakEnding: '#666666',
        paused: '#555555',
        notification: '#444444',
        success: '#333333',
        warning: '#666666',
        error: '#000000'
      },
      icons: {
        idle: '$(circle-outline)',
        focus: '$(circle-filled)',
        focusEnding: '$(circle-slash)',
        break: '$(circle)',
        breakEnding: '$(circle-slash)',
        paused: '$(dash)',
        notification: '$(dot)',
        success: '$(check)',
        warning: '$(dash)',
        error: '$(x)'
      }
    };
  }

  /**
   * Limpeza de recursos
   */
  public dispose(): void {
    this.stopCurrentAnimation();
    this.alertQueue = [];
    console.log('🎨 VisualEffectsManager disposed');
  }
}
