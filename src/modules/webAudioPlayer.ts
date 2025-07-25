import * as vscode from 'vscode';

/**
 * Player de áudio que usa webview para reproduzir sons reais
 */
export class WebAudioPlayer {
  private static instance: WebAudioPlayer;
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext | undefined;

  public static getInstance(): WebAudioPlayer {
    if (!WebAudioPlayer.instance) {
      WebAudioPlayer.instance = new WebAudioPlayer();
    }
    return WebAudioPlayer.instance;
  }

  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  /**
   * Reproduz som usando webview com Web Audio API real
   */
  public async playSound(audioData: any, volume?: number): Promise<void> {
    try {
      if (!this.context) {
        throw new Error('WebAudioPlayer não inicializado');
      }

      // Criar webview oculto para reproduzir som
      if (!this.panel) {
        this.panel = vscode.window.createWebviewPanel(
          'audioPlayer',
          'Audio Player',
          { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );

        // Ocultar o painel
        this.panel.reveal(vscode.ViewColumn.One, true);

        // HTML com Web Audio API
        this.panel.webview.html = this.getWebviewContent();

        // Limpar painel quando fechado
        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });
      }

      // Enviar dados do som para o webview
      const message = {
        command: 'playSound',
        audioData: audioData,
        volume: volume || audioData.volume
      };

      await this.panel.webview.postMessage(message);

      // Aguardar duração do som
      await new Promise(resolve => setTimeout(resolve, audioData.duration));

    } catch (error) {
      console.error('❌ Erro no WebAudioPlayer:', error);
      throw error;
    }
  }

  /**
   * Reproduz beep do sistema como fallback
   */
  public async playSystemBeep(count: number = 1): Promise<void> {
    try {
      for (let i = 0; i < count; i++) {
        if (process.platform === 'win32') {
          // Windows - usar comando system beep
          const { exec } = require('child_process');
          exec('rundll32 user32.dll,MessageBeep', () => {});
        } else {
          // Unix/Linux - usar escape sequence
          process.stdout.write('\x07');
        }
        
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro no beep do sistema:', error);
    }
  }

  /**
   * HTML do webview com Web Audio API
   */
  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Audio Player</title>
        <style>
          body {
            background: transparent;
            margin: 0;
            padding: 0;
            display: none; /* Ocultar conteúdo visual */
          }
        </style>
      </head>
      <body>
        <script>
          // Contexto de áudio global
          let audioContext = null;

          // Inicializar contexto de áudio
          function initAudioContext() {
            if (!audioContext) {
              audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resumir contexto se suspenso
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
            
            return audioContext;
          }

          // Função para reproduzir som sintético
          async function playSyntheticSound(audioData, volume) {
            try {
              const ctx = initAudioContext();
              const gainNode = ctx.createGain();
              gainNode.connect(ctx.destination);
              
              const finalVolume = (volume || audioData.volume) * 0.3;
              gainNode.gain.setValueAtTime(0, ctx.currentTime);
              
              const envelope = audioData.envelope;
              const startTime = ctx.currentTime;
              const duration = audioData.duration / 1000;
              
              // Criar osciladores para cada frequência
              const oscillators = [];
              
              for (const frequency of audioData.frequencies) {
                const oscillator = ctx.createOscillator();
                oscillator.type = audioData.waveType || 'sine';
                oscillator.frequency.setValueAtTime(frequency, startTime);
                oscillator.connect(gainNode);
                oscillators.push(oscillator);
              }
              
              // Configurar envelope ADSR
              const attackTime = envelope.attack;
              const decayTime = envelope.decay;
              const sustainLevel = envelope.sustain * finalVolume;
              const releaseTime = envelope.release;
              
              // Attack
              gainNode.gain.linearRampToValueAtTime(finalVolume, startTime + attackTime);
              
              // Decay
              gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);
              
              // Sustain
              const sustainDuration = duration - attackTime - decayTime - releaseTime;
              if (sustainDuration > 0) {
                gainNode.gain.setValueAtTime(sustainLevel, startTime + attackTime + decayTime + sustainDuration);
              }
              
              // Release
              gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
              
              // Iniciar osciladores
              oscillators.forEach(osc => osc.start(startTime));
              
              // Parar osciladores
              oscillators.forEach(osc => osc.stop(startTime + duration));
              
              console.log('🎵 Som reproduzido com Web Audio API:', {
                frequencies: audioData.frequencies,
                duration: audioData.duration,
                volume: finalVolume,
                waveType: audioData.waveType
              });
              
              return true;
            } catch (error) {
              console.error('❌ Erro na reprodução Web Audio:', error);
              throw error;
            }
          }

          // Função para reproduzir beep sequence
          async function playBeepSequence(audioData) {
            try {
              const ctx = initAudioContext();
              const beepCount = audioData.count || 1;
              const frequency = audioData.frequency || 800;
              
              for (let i = 0; i < beepCount; i++) {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
                oscillator.type = 'square';
                
                const startTime = ctx.currentTime;
                const beepDuration = 0.15; // 150ms por beep
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, startTime + beepDuration);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + beepDuration);
                
                // Pausa entre beeps
                if (i < beepCount - 1) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
              
              console.log(\`🔔 Sequência de \${beepCount} beeps reproduzida\`);
              return true;
            } catch (error) {
              console.error('❌ Erro na sequência de beeps:', error);
              throw error;
            }
          }

          // Listener para mensagens do VS Code
          window.addEventListener('message', async event => {
            const message = event.data;
            
            try {
              if (message.command === 'playSound') {
                const audioData = message.audioData;
                
                if (audioData.type === 'beep_sequence') {
                  await playBeepSequence(audioData);
                } else {
                  await playSyntheticSound(audioData, message.volume);
                }
                
                // Confirmar reprodução
                vscode.postMessage({
                  command: 'soundPlayed',
                  success: true
                });
              }
            } catch (error) {
              console.error('❌ Erro ao processar mensagem:', error);
              vscode.postMessage({
                command: 'soundPlayed',
                success: false,
                error: error.message
              });
            }
          });

          // Inicializar contexto de áudio na primeira interação
          document.addEventListener('click', initAudioContext);
          
          // Auto-inicializar contexto
          setTimeout(() => {
            try {
              initAudioContext();
              console.log('🎵 Contexto de áudio inicializado automaticamente');
            } catch (error) {
              console.log('⚠️ Contexto de áudio aguardando interação do usuário');
            }
          }, 100);
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Limpa recursos
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
