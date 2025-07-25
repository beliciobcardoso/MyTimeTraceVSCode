import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SyntheticSoundGenerator } from './syntheticSoundGenerator';
import { SimpleSoundPlayer } from './simpleSoundPlayer';
import { AudioFilePlayer } from './audioFilePlayer';

/**
 * Tipos de sons disponíveis no sistema
 */
export enum SoundType {
  FOCUS_START = 'focus_start',
  FOCUS_COMPLETE = 'focus_complete',
  BREAK_START = 'break_start',
  BREAK_COMPLETE = 'break_complete',
  NOTIFICATION = 'notification',
  WARNING = 'warning',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Temas de sons disponíveis
 */
export enum SoundTheme {
  CLASSIC = 'classic',
  MODERN = 'modern',
  NATURAL = 'natural',
  MINIMAL = 'minimal',
  CUSTOM = 'custom'
}

/**
 * Configuração de som
 */
export interface SoundConfig {
  enabled: boolean;
  volume: number; // 0-100
  theme: SoundTheme;
  customSounds?: { [key in SoundType]?: string }; // Caminhos para sons customizados
}

/**
 * Informações de um som
 */
export interface SoundInfo {
  type: SoundType;
  theme: SoundTheme;
  filename: string;
  displayName: string;
  description: string;
  duration: number; // em segundos
}

/**
 * Gerenciador de sons para o sistema Pomodoro
 * Responsável por reproduzir sons de alertas, notificações e feedback
 */
export class SoundManager {
  private static instance: SoundManager;
  private context: vscode.ExtensionContext | null = null;
  private config: SoundConfig;
  private audioContext: any = null; // Para controle de áudio avançado
  private soundsPath: string = '';
  private audioFilePlayer: AudioFilePlayer;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.audioFilePlayer = AudioFilePlayer.getInstance();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Inicializa o gerenciador de sons
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.soundsPath = path.join(context.extensionPath, 'sounds');
    
    // Sistema de áudio inicializado silenciosamente
    // (teste de áudio removido para evitar som na startup)
    console.log('� SoundManager inicializado - Sistema de áudio disponível');
    
    // Criar diretório de sons se não existir
    this.ensureSoundsDirectory();
  }

  /**
   * Configuração padrão de sons
   */
  private getDefaultConfig(): SoundConfig {
    return {
      enabled: true,
      volume: 50, // Volume médio por padrão
      theme: SoundTheme.CLASSIC
    };
  }

  /**
   * Garante que o diretório de sons existe
   */
  private ensureSoundsDirectory(): void {
    if (!fs.existsSync(this.soundsPath)) {
      fs.mkdirSync(this.soundsPath, { recursive: true });
    }

    // Criar subdiretórios para cada tema
    Object.values(SoundTheme).forEach(theme => {
      if (theme !== SoundTheme.CUSTOM) {
        const themePath = path.join(this.soundsPath, theme);
        if (!fs.existsSync(themePath)) {
          fs.mkdirSync(themePath, { recursive: true });
        }
      }
    });
  }

  /**
   * Reproduz um som específico
   */
  public async playSound(soundType: SoundType, options?: { 
    volume?: number; 
    theme?: SoundTheme;
    force?: boolean; // Reproduzir mesmo se sons estiverem desabilitados
  }): Promise<void> {
    try {
      // Verificar se sons estão habilitados
      if (!this.config.enabled && !options?.force) {
        console.log(`🔇 Sons desabilitados, pulando ${soundType}`);
        return;
      }

      const theme = options?.theme || this.config.theme;
      const volume = options?.volume || this.config.volume;

      // Obter caminho do som
      const soundPath = this.getSoundPath(soundType, theme);
      
      if (!soundPath || !fs.existsSync(soundPath)) {
        console.warn(`⚠️ Som não encontrado: ${soundType} (${theme})`);
        
        // Tentar som sintético como fallback
        try {
          const syntheticSound = SyntheticSoundGenerator.generateSound(soundType, theme);
          await SyntheticSoundGenerator.playSyntheticSound(syntheticSound, volume / 100);
          console.log(`🎵 Som sintético reproduzido: ${soundType} (${theme})`);
          return;
        } catch (synthError) {
          console.warn('⚠️ Falha no som sintético, usando fallback básico:', synthError);
        }
        
        // Fallback para som padrão
        await this.playFallbackSound(soundType);
        return;
      }

      // Reproduzir som
      await this.playSoundFile(soundPath, volume);
      
      console.log(`🔊 Som reproduzido: ${soundType} (${theme})`);

    } catch (error) {
      console.error(`❌ Erro ao reproduzir som ${soundType}:`, error);
      // Tentar fallback silencioso
      await this.playFallbackSound(soundType);
    }
  }

  /**
   * Obtém o caminho de um som
   */
  private getSoundPath(soundType: SoundType, theme: SoundTheme): string | null {
    if (theme === SoundTheme.CUSTOM && this.config.customSounds?.[soundType]) {
      return this.config.customSounds[soundType]!;
    }

    const soundInfo = this.getSoundInfo(soundType, theme);
    if (!soundInfo) {
      return null;
    }

    return path.join(this.soundsPath, theme, soundInfo.filename);
  }

  /**
   * Reproduz arquivo de som
   */
  private async playSoundFile(soundPath: string, volume: number): Promise<void> {
    try {
      console.log(`🎵 Reproduzindo arquivo: ${soundPath} (volume: ${volume}%)`);
      
      // Tentar reproduzir arquivo WAV real primeiro
      if (soundPath.endsWith('.wav') && fs.existsSync(soundPath)) {
        await this.audioFilePlayer.playFile(soundPath, volume);
        return;
      }
      
      // Fallback para som sintético se arquivo não existir
      console.warn(`⚠️ Arquivo não encontrado, usando fallback: ${soundPath}`);
      const simpleSoundPlayer = new SimpleSoundPlayer();
      await simpleSoundPlayer.playSystemBeeps(1); // Beep básico

    } catch (error) {
      console.error(`❌ Erro ao reproduzir arquivo: ${error}`);
      throw new Error(`Falha ao reproduzir som: ${error}`);
    }
  }

  /**
   * Reproduz som de fallback (beep do sistema)
   */
  private async playFallbackSound(soundType: SoundType): Promise<void> {
    try {
      // Tentar som sintético específico para cada tipo
      switch (soundType) {
        case SoundType.FOCUS_COMPLETE:
        case SoundType.BREAK_COMPLETE:
          // Som de sucesso (múltiplos beeps)
          const successBeep = SyntheticSoundGenerator.generateBeepSequence(3, 800);
          await SyntheticSoundGenerator.playSyntheticSound(successBeep);
          console.log('🔔 Success beep sequence (synthetic)');
          break;
        case SoundType.WARNING:
        case SoundType.ERROR:
          // Som de aviso (beep grave)
          const warningBeep = SyntheticSoundGenerator.generateBeepSequence(2, 400);
          await SyntheticSoundGenerator.playSyntheticSound(warningBeep);
          console.log('🔔 Warning beep (synthetic)');
          break;
        case SoundType.NOTIFICATION:
          // DTMF tone para notificação
          const notificationTone = SyntheticSoundGenerator.generateDTMFTone('5');
          await SyntheticSoundGenerator.playSyntheticSound(notificationTone);
          console.log('🔔 Notification tone (synthetic)');
          break;
        default:
          // Som padrão (beep simples)
          const defaultBeep = SyntheticSoundGenerator.generateBeepSequence(1, 600);
          await SyntheticSoundGenerator.playSyntheticSound(defaultBeep);
          console.log('🔔 Default beep (synthetic)');
      }
    } catch (error) {
      console.error('❌ Falha no som de fallback:', error);
      // Último recurso: apenas log
      console.log('🔕 Fallback silencioso');
    }
  }

  /**
   * Obtém informações de um som
   */
  private getSoundInfo(soundType: SoundType, theme: SoundTheme): SoundInfo | null {
    const sounds = this.getAvailableSounds();
    return sounds.find(s => s.type === soundType && s.theme === theme) || null;
  }

  /**
   * Lista todos os sons disponíveis
   */
  public getAvailableSounds(): SoundInfo[] {
    return [
      // Tema Clássico
      {
        type: SoundType.FOCUS_START,
        theme: SoundTheme.CLASSIC,
        filename: 'focus_start.wav',
        displayName: 'Início do Foco',
        description: 'Som suave para iniciar período de foco',
        duration: 2
      },
      {
        type: SoundType.FOCUS_COMPLETE,
        theme: SoundTheme.CLASSIC,
        filename: 'focus_complete.wav',
        displayName: 'Foco Concluído',
        description: 'Som de conquista ao completar foco',
        duration: 3
      },
      {
        type: SoundType.BREAK_START,
        theme: SoundTheme.CLASSIC,
        filename: 'break_start.wav',
        displayName: 'Início da Pausa',
        description: 'Som relaxante para iniciar pausa',
        duration: 2
      },
      {
        type: SoundType.BREAK_COMPLETE,
        theme: SoundTheme.CLASSIC,
        filename: 'break_complete.wav',
        displayName: 'Pausa Concluída',
        description: 'Som energizante para voltar ao foco',
        duration: 2
      },
      {
        type: SoundType.NOTIFICATION,
        theme: SoundTheme.CLASSIC,
        filename: 'notification.wav',
        displayName: 'Notificação',
        description: 'Som discreto para notificações gerais',
        duration: 1
      },
      {
        type: SoundType.WARNING,
        theme: SoundTheme.CLASSIC,
        filename: 'warning.wav',
        displayName: 'Aviso',
        description: 'Som de atenção para avisos',
        duration: 1
      },
      {
        type: SoundType.SUCCESS,
        theme: SoundTheme.CLASSIC,
        filename: 'success.wav',
        displayName: 'Sucesso',
        description: 'Som de sucesso para ações completadas',
        duration: 2
      },
      {
        type: SoundType.ERROR,
        theme: SoundTheme.CLASSIC,
        filename: 'error.wav',
        displayName: 'Erro',
        description: 'Som de erro para falhas',
        duration: 1
      },

      // Tema Moderno (mesmos tipos, arquivos diferentes)
      {
        type: SoundType.FOCUS_START,
        theme: SoundTheme.MODERN,
        filename: 'focus_start_modern.wav',
        displayName: 'Início do Foco (Moderno)',
        description: 'Som eletrônico suave para iniciar foco',
        duration: 2
      },
      {
        type: SoundType.FOCUS_COMPLETE,
        theme: SoundTheme.MODERN,
        filename: 'focus_complete_modern.wav',
        displayName: 'Foco Concluído (Moderno)',
        description: 'Som digital de conquista',
        duration: 3
      },
      
      // Tema Natural
      {
        type: SoundType.FOCUS_START,
        theme: SoundTheme.NATURAL,
        filename: 'focus_start_natural.wav',
        displayName: 'Início do Foco (Natural)',
        description: 'Som de natureza para iniciar foco',
        duration: 3
      },
      {
        type: SoundType.BREAK_START,
        theme: SoundTheme.NATURAL,
        filename: 'break_start_natural.wav',
        displayName: 'Início da Pausa (Natural)',
        description: 'Som de água ou vento para relaxar',
        duration: 4
      },

      // Tema Minimal
      {
        type: SoundType.FOCUS_COMPLETE,
        theme: SoundTheme.MINIMAL,
        filename: 'focus_complete_minimal.wav',
        displayName: 'Foco Concluído (Minimal)',
        description: 'Click simples e discreto',
        duration: 0.5
      },
      {
        type: SoundType.NOTIFICATION,
        theme: SoundTheme.MINIMAL,
        filename: 'notification_minimal.wav',
        displayName: 'Notificação (Minimal)',
        description: 'Beep curto e sutil',
        duration: 0.3
      }
    ];
  }

  /**
   * Lista temas disponíveis
   */
  public getAvailableThemes(): { theme: SoundTheme; name: string; description: string }[] {
    return [
      {
        theme: SoundTheme.CLASSIC,
        name: 'Clássico',
        description: 'Sons tradicionais e harmônicos'
      },
      {
        theme: SoundTheme.MODERN,
        name: 'Moderno',
        description: 'Sons eletrônicos e digitais'
      },
      {
        theme: SoundTheme.NATURAL,
        name: 'Natural',
        description: 'Sons da natureza relaxantes'
      },
      {
        theme: SoundTheme.MINIMAL,
        name: 'Minimal',
        description: 'Sons discretos e sutis'
      },
      {
        theme: SoundTheme.CUSTOM,
        name: 'Personalizado',
        description: 'Sons personalizados pelo usuário'
      }
    ];
  }

  /**
   * Atualiza configuração de sons
   */
  public updateConfig(newConfig: Partial<SoundConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔊 Configuração de sons atualizada:', this.config);
  }

  /**
   * Obtém configuração atual
   */
  public getConfig(): SoundConfig {
    return { ...this.config };
  }

  /**
   * Testa um som (preview)
   */
  public async previewSound(soundType: SoundType, theme?: SoundTheme): Promise<void> {
    await this.playSound(soundType, { 
      theme: theme || this.config.theme,
      force: true // Sempre reproduzir preview mesmo se sons estiverem desabilitados
    });
  }

  /**
   * Testa volume
   */
  public async testVolume(volume: number): Promise<void> {
    await this.playSound(SoundType.NOTIFICATION, { 
      volume,
      force: true 
    });
  }

  /**
   * Valida se um arquivo de som é válido
   */
  public validateSoundFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.wav', '.mp3', '.ogg', '.m4a', '.aac'];
    
    return validExtensions.includes(ext);
  }

  /**
   * Adiciona som customizado
   */
  public async addCustomSound(soundType: SoundType, sourceFilePath: string): Promise<void> {
    if (!this.validateSoundFile(sourceFilePath)) {
      throw new Error('Arquivo de som inválido');
    }

    if (!this.context) {
      throw new Error('SoundManager não inicializado');
    }

    const customDir = path.join(this.soundsPath, 'custom');
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }

    const filename = `${soundType}_custom${path.extname(sourceFilePath)}`;
    const targetPath = path.join(customDir, filename);

    // Copiar arquivo
    fs.copyFileSync(sourceFilePath, targetPath);

    // Atualizar configuração
    if (!this.config.customSounds) {
      this.config.customSounds = {};
    }
    this.config.customSounds[soundType] = targetPath;

    console.log(`🎵 Som customizado adicionado: ${soundType} -> ${targetPath}`);
  }

  /**
   * Remove som customizado
   */
  public removeCustomSound(soundType: SoundType): void {
    if (this.config.customSounds?.[soundType]) {
      const filePath = this.config.customSounds[soundType];
      
      // Remover arquivo se existir
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remover da configuração
      delete this.config.customSounds[soundType];
      
      console.log(`🗑️ Som customizado removido: ${soundType}`);
    }
  }

  /**
   * Testa sons sintéticos para todos os tipos
   */
  public async testSyntheticSounds(): Promise<void> {
    console.log('🎵 Iniciando teste de sons sintéticos...');
    
    const soundTypes = Object.values(SoundType);
    const themes = Object.values(SoundTheme);
    
    for (const theme of themes) {
      console.log(`\n📁 Testando tema: ${theme}`);
      
      for (const soundType of soundTypes) {
        try {
          const syntheticSound = SyntheticSoundGenerator.generateSound(soundType, theme);
          await SyntheticSoundGenerator.playSyntheticSound(syntheticSound, 0.3);
          console.log(`✅ ${soundType} (${theme}): OK`);
          
          // Pequena pausa entre sons
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ ${soundType} (${theme}): Erro -`, error);
        }
      }
      
      // Pausa maior entre temas
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎵 Teste de sons sintéticos concluído');
  }

  /**
   * Testa sequências especiais de sons
   */
  public async testSpecialSounds(): Promise<void> {
    console.log('🎵 Testando sons especiais...');
    
    try {
      // Teste DTMF
      console.log('📞 Testando tons DTMF...');
      const dtmfDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      for (const digit of dtmfDigits) {
        const dtmfTone = SyntheticSoundGenerator.generateDTMFTone(digit);
        await SyntheticSoundGenerator.playSyntheticSound(dtmfTone);
        console.log(`📞 DTMF ${digit}: OK`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Teste sequências de beeps
      console.log('\n🔔 Testando sequências de beeps...');
      for (let count = 1; count <= 5; count++) {
        const beepSequence = SyntheticSoundGenerator.generateBeepSequence(count, 800);
        await SyntheticSoundGenerator.playSyntheticSound(beepSequence);
        console.log(`🔔 Sequência ${count} beeps: OK`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('\n🎵 Teste de sons especiais concluído');
      
    } catch (error) {
      console.error('❌ Erro no teste de sons especiais:', error);
    }
  }

  /**
   * Preview de som com escolha de tema
   */
  public async previewSoundWithTheme(soundType: SoundType, theme: SoundTheme): Promise<void> {
    console.log(`🎧 Preview: ${soundType} (${theme})`);
    
    try {
      // Tentar som sintético primeiro
      const syntheticSound = SyntheticSoundGenerator.generateSound(soundType, theme);
      await SyntheticSoundGenerator.playSyntheticSound(syntheticSound, this.config.volume / 100);
      console.log(`✅ Preview sintético reproduzido`);
      
    } catch (error) {
      console.warn('⚠️ Erro no preview sintético, tentando fallback:', error);
      
      // Fallback para método normal
      await this.playSound(soundType, { 
        theme: theme,
        force: true
      });
    }
  }

  /**
   * Limpa recursos do gerenciador
   */
  public dispose(): void {
    // Limpar contexto de áudio se existir
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn('⚠️ Erro ao fechar contexto de áudio:', error);
      }
    }

    console.log('🧹 SoundManager cleanup concluído');
  }
}
