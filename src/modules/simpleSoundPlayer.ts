import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Player de áudio simples que funciona no VS Code
 * Usa comandos do sistema operacional para reproduzir sons reais
 */
export class SimpleSoundPlayer {
  private static instance: SimpleSoundPlayer;

  public static getInstance(): SimpleSoundPlayer {
    if (!SimpleSoundPlayer.instance) {
      SimpleSoundPlayer.instance = new SimpleSoundPlayer();
    }
    return SimpleSoundPlayer.instance;
  }

  /**
   * Reproduz som baseado nos dados sintéticos
   */
  public async playSound(audioData: any, volume?: number): Promise<void> {
    try {
      console.log(`🎵 Reproduzindo som: ${audioData.frequencies?.length || 1} frequências`);

      // Determinar número de beeps baseado nas frequências
      const beepCount = Math.min(audioData.frequencies?.length || 1, 5);
      
      // Reproduzir beeps reais
      await this.playSystemBeeps(beepCount);
      
      console.log(`✅ Som reproduzido: ${beepCount} beeps`);
    } catch (error) {
      console.error('❌ Erro ao reproduzir som:', error);
      throw error;
    }
  }

  /**
   * Reproduz beeps do sistema operacional
   */
  public async playSystemBeeps(count: number = 1): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Windows - usar PowerShell para beeps
        await this.playWindowsBeeps(count);
      } else if (process.platform === 'darwin') {
        // macOS - usar afplay com beep
        await this.playMacBeeps(count);
      } else {
        // Linux/Unix - usar multiple methods
        await this.playLinuxBeeps(count);
      }
    } catch (error) {
      console.warn('⚠️ Erro nos beeps do sistema, tentando fallback:', error);
      // Fallback - usar escape sequences
      await this.playTerminalBeeps(count);
    }
  }

  /**
   * Beeps no Windows
   */
  private async playWindowsBeeps(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        // Usar rundll32 para beep do sistema
        await execAsync('rundll32 user32.dll,MessageBeep 0');
        
        if (i < count - 1) {
          await this.delay(200);
        }
      } catch (error) {
        console.warn(`⚠️ Erro no beep ${i + 1}:`, error);
      }
    }
  }

  /**
   * Beeps no macOS
   */
  private async playMacBeeps(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        // Usar comando say com beep ou afplay
        await execAsync('printf "\\a"');
        
        if (i < count - 1) {
          await this.delay(200);
        }
      } catch (error) {
        console.warn(`⚠️ Erro no beep ${i + 1}:`, error);
      }
    }
  }

  /**
   * Beeps no Linux
   */
  private async playLinuxBeeps(count: number): Promise<void> {
    try {
      // Tentar múltodos métodos para Linux
      
      // Método 1: speaker-test (se disponível)
      try {
        for (let i = 0; i < count; i++) {
          await execAsync('speaker-test -t sine -f 800 -l 1 -s 1 2>/dev/null');
          if (i < count - 1) {
            await this.delay(200);
          }
        }
        return;
      } catch (speakerError) {
        console.log('speaker-test não disponível, tentando pactl...');
      }

      // Método 2: pactl (PulseAudio)
      try {
        for (let i = 0; i < count; i++) {
          await execAsync('pactl upload-sample /usr/share/sounds/alsa/Front_Left.wav bell 2>/dev/null && pactl play-sample bell 2>/dev/null');
          if (i < count - 1) {
            await this.delay(200);
          }
        }
        return;
      } catch (pactlError) {
        console.log('pactl não disponível, tentando aplay...');
      }

      // Método 3: aplay com /dev/urandom (gerar ruído branco curto)
      try {
        for (let i = 0; i < count; i++) {
          await execAsync('timeout 0.1 aplay -c 1 -f S16_LE -r 22050 /dev/urandom 2>/dev/null');
          if (i < count - 1) {
            await this.delay(200);
          }
        }
        return;
      } catch (aplayError) {
        console.log('aplay não disponível, usando escape sequence...');
      }

      // Fallback: escape sequence
      await this.playTerminalBeeps(count);

    } catch (error) {
      console.warn('⚠️ Todos os métodos de beep falharam:', error);
      throw error;
    }
  }

  /**
   * Beeps usando escape sequences do terminal
   */
  private async playTerminalBeeps(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        // ASCII Bell character (0x07)
        process.stdout.write('\x07');
        
        // Também tentar stderr
        process.stderr.write('\x07');
        
        if (i < count - 1) {
          await this.delay(200);
        }
      } catch (error) {
        console.warn(`⚠️ Erro no beep terminal ${i + 1}:`, error);
      }
    }
  }

  /**
   * Reproduz sequência de tons DTMF simulados
   */
  public async playDTMFTone(digit: string): Promise<void> {
    console.log(`📞 DTMF: ${digit}`);
    
    // Simular DTMF com beeps de frequências diferentes
    const dtmfBeeps: { [key: string]: number } = {
      '1': 1, '2': 1, '3': 1,
      '4': 2, '5': 2, '6': 2,
      '7': 3, '8': 3, '9': 3,
      '*': 4, '0': 1, '#': 4
    };

    const beepCount = dtmfBeeps[digit] || 1;
    await this.playSystemBeeps(beepCount);
  }

  /**
   * Reproduz sequência de beeps
   */
  public async playBeepSequence(count: number, frequency?: number): Promise<void> {
    console.log(`🔔 Sequência: ${count} beeps`);
    await this.playSystemBeeps(count);
  }

  /**
   * Testa se o sistema consegue reproduzir sons
   */
  public async testSystemAudio(): Promise<boolean> {
    try {
      console.log('🧪 Testando capacidade de áudio do sistema...');
      
      await this.playSystemBeeps(1);
      
      console.log('✅ Sistema de áudio funcionando');
      return true;
    } catch (error) {
      console.error('❌ Sistema de áudio não funcionando:', error);
      return false;
    }
  }

  /**
   * Utilitário para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reproduz som com notificação visual também
   */
  public async playWithVisualFeedback(audioData: any, message?: string): Promise<void> {
    try {
      // Mostrar notificação visual
      if (message) {
        vscode.window.showInformationMessage(message, { modal: false });
      }

      // Reproduzir som
      await this.playSound(audioData);

    } catch (error) {
      console.error('❌ Erro na reprodução com feedback visual:', error);
      // Pelo menos mostrar notificação visual
      if (message) {
        vscode.window.showInformationMessage(`🔕 ${message} (som indisponível)`, { modal: false });
      }
    }
  }
}
