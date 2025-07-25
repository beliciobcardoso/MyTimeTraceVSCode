import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Player de áudio para arquivos WAV reais
 * Usa comandos do sistema operacional para reproduzir arquivos de som
 */
export class AudioFilePlayer {
  private static instance: AudioFilePlayer;

  public static getInstance(): AudioFilePlayer {
    if (!AudioFilePlayer.instance) {
      AudioFilePlayer.instance = new AudioFilePlayer();
    }
    return AudioFilePlayer.instance;
  }

  /**
   * Reproduz arquivo de som WAV
   */
  public async playFile(filePath: string, volume?: number): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      console.log(`🎵 Reproduzindo arquivo: ${path.basename(filePath)}`);

      // Escolher método baseado no sistema operacional
      if (process.platform === 'win32') {
        await this.playOnWindows(filePath, volume);
      } else if (process.platform === 'darwin') {
        await this.playOnMacOS(filePath, volume);
      } else {
        await this.playOnLinux(filePath, volume);
      }

      console.log(`✅ Arquivo reproduzido com sucesso`);
    } catch (error) {
      console.error('❌ Erro ao reproduzir arquivo:', error);
      throw error;
    }
  }

  /**
   * Reproduz som no Windows
   */
  private async playOnWindows(filePath: string, volume?: number): Promise<void> {
    try {
      // Usar PowerShell com Windows Media Player
      const command = `powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`;
      await execAsync(command, { timeout: 10000 });
    } catch (error) {
      // Fallback: usar cmdmp3
      console.warn('⚠️ Falha no SoundPlayer, tentando cmdmp3...');
      const fallbackCommand = `cmdmp3 "${filePath}"`;
      await execAsync(fallbackCommand, { timeout: 10000 });
    }
  }

  /**
   * Reproduz som no macOS
   */
  private async playOnMacOS(filePath: string, volume?: number): Promise<void> {
    try {
      // Usar afplay (padrão do macOS)
      let command = `afplay "${filePath}"`;
      
      if (volume !== undefined) {
        const volumeLevel = Math.max(0, Math.min(1, volume / 100));
        command += ` -v ${volumeLevel}`;
      }
      
      await execAsync(command, { timeout: 10000 });
    } catch (error) {
      console.warn('⚠️ Erro no afplay:', error);
      throw error;
    }
  }

  /**
   * Reproduz som no Linux
   */
  private async playOnLinux(filePath: string, volume?: number): Promise<void> {
    const methods = [
      // Método 1: aplay (ALSA - mais comum)
      () => this.tryAplay(filePath, volume),
      
      // Método 2: paplay (PulseAudio)
      () => this.tryPaplay(filePath, volume),
      
      // Método 3: ffplay (se FFmpeg disponível)
      () => this.tryFfplay(filePath, volume),
      
      // Método 4: mpv (player universal)
      () => this.tryMpv(filePath, volume),
      
      // Método 5: sox play
      () => this.trySox(filePath, volume)
    ];

    let lastError: any = null;

    for (const method of methods) {
      try {
        await method();
        return; // Sucesso - sair do loop
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Método falhou, tentando próximo...`);
      }
    }

    // Se todos falharam, usar fallback
    console.warn('⚠️ Todos os métodos de reprodução falharam, usando fallback');
    throw lastError || new Error('Nenhum método de reprodução funcionou');
  }

  /**
   * Tenta reproduzir com aplay (ALSA)
   */
  private async tryAplay(filePath: string, volume?: number): Promise<void> {
    let command = `aplay "${filePath}"`;
    
    if (volume !== undefined) {
      // aplay não suporta volume diretamente, usar amixer se necessário
      const volumePercent = Math.max(0, Math.min(100, volume));
      command = `amixer sset Master ${volumePercent}% 2>/dev/null; ${command}`;
    }
    
    await execAsync(command, { timeout: 10000 });
  }

  /**
   * Tenta reproduzir com paplay (PulseAudio)
   */
  private async tryPaplay(filePath: string, volume?: number): Promise<void> {
    let command = `paplay "${filePath}"`;
    
    if (volume !== undefined) {
      const volumeLevel = Math.max(0, Math.min(1, volume / 100));
      command += ` --volume=${Math.round(volumeLevel * 65536)}`;
    }
    
    await execAsync(command, { timeout: 10000 });
  }

  /**
   * Tenta reproduzir com ffplay
   */
  private async tryFfplay(filePath: string, volume?: number): Promise<void> {
    let command = `ffplay -nodisp -autoexit "${filePath}" 2>/dev/null`;
    
    if (volume !== undefined) {
      const volumeLevel = Math.max(0, Math.min(1, volume / 100));
      command = `ffplay -nodisp -autoexit -af "volume=${volumeLevel}" "${filePath}" 2>/dev/null`;
    }
    
    await execAsync(command, { timeout: 10000 });
  }

  /**
   * Tenta reproduzir com mpv
   */
  private async tryMpv(filePath: string, volume?: number): Promise<void> {
    let command = `mpv --no-video --really-quiet "${filePath}"`;
    
    if (volume !== undefined) {
      command += ` --volume=${volume}`;
    }
    
    await execAsync(command, { timeout: 10000 });
  }

  /**
   * Tenta reproduzir com sox play
   */
  private async trySox(filePath: string, volume?: number): Promise<void> {
    let command = `play "${filePath}" 2>/dev/null`;
    
    if (volume !== undefined) {
      const volumeLevel = Math.max(0, Math.min(1, volume / 100));
      command = `play "${filePath}" vol ${volumeLevel} 2>/dev/null`;
    }
    
    await execAsync(command, { timeout: 10000 });
  }

  /**
   * Testa se o sistema consegue reproduzir arquivos
   */
  public async testAudioCapability(): Promise<{ working: boolean; method?: string; error?: string }> {
    try {
      // Criar arquivo de teste temporário (silêncio de 100ms)
      const testFile = path.join(__dirname, '..', 'sounds', 'classic', 'notification.wav');
      
      if (!fs.existsSync(testFile)) {
        return {
          working: false,
          error: 'Arquivo de teste não encontrado'
        };
      }

      console.log('🧪 Testando capacidade de reprodução de áudio...');
      
      // Tentar reproduzir arquivo de teste
      await this.playFile(testFile, 10); // Volume baixo para teste
      
      console.log('✅ Sistema de reprodução funcionando');
      
      return {
        working: true,
        method: `Sistema de reprodução para ${process.platform}`
      };
    } catch (error) {
      console.error('❌ Sistema de reprodução não funcionando:', error);
      return {
        working: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Lista métodos de reprodução disponíveis
   */
  public async getAvailableMethods(): Promise<string[]> {
    const methods: { name: string; command: string }[] = [];

    if (process.platform === 'linux') {
      methods.push(
        { name: 'aplay', command: 'which aplay' },
        { name: 'paplay', command: 'which paplay' },
        { name: 'ffplay', command: 'which ffplay' },
        { name: 'mpv', command: 'which mpv' },
        { name: 'play', command: 'which play' }
      );
    } else if (process.platform === 'darwin') {
      methods.push(
        { name: 'afplay', command: 'which afplay' }
      );
    } else {
      methods.push(
        { name: 'powershell', command: 'where powershell' }
      );
    }

    const available: string[] = [];

    for (const method of methods) {
      try {
        await execAsync(method.command, { timeout: 2000 });
        available.push(method.name);
      } catch {
        // Método não disponível
      }
    }

    return available;
  }
}
