import { SoundType, SoundTheme } from './soundManager';
import { SimpleSoundPlayer } from './simpleSoundPlayer';

/**
 * Gerador de sons sintéticos usando Web Audio API
 * Permite criar sons sem depender de arquivos externos
 */
export class SyntheticSoundGenerator {
  
  /**
   * Gera som sintético baseado no tipo e tema
   */
  public static generateSound(soundType: SoundType, theme: SoundTheme): string {
    // Retorna uma representação em base64 de um som sintético
    // Em uma implementação real, isso geraria áudio usando Web Audio API
    
    const soundSpecs = this.getSoundSpecs(soundType, theme);
    return this.createSyntheticAudio(soundSpecs);
  }

  /**
   * Especificações de som para cada tipo e tema
   */
  private static getSoundSpecs(soundType: SoundType, theme: SoundTheme): SoundSpec {
    const specs: { [key in SoundType]: { [key in SoundTheme]?: SoundSpec } } = {
      [SoundType.FOCUS_START]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [440, 554.37, 659.25], // A4, C#5, E5 (acorde A maior)
          duration: 2000,
          volume: 0.3,
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.2 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [200, 400, 800], // Sons eletrônicos
          duration: 1500,
          volume: 0.4,
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.95 },
          waveType: 'square'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [880, 440, 220], // Harmônicos naturais
          duration: 3000,
          volume: 0.2,
          envelope: { attack: 0.5, decay: 0.8, sustain: 0.6, release: 1.0 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [440],
          duration: 500,
          volume: 0.2,
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.39 }
        }
      },
      
      [SoundType.FOCUS_COMPLETE]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [523.25, 659.25, 783.99, 1046.50], // C5, E5, G5, C6 (acorde C maior)
          duration: 3000,
          volume: 0.4,
          envelope: { attack: 0.1, decay: 0.5, sustain: 0.6, release: 1.8 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [300, 600, 1200, 2400], // Progressão eletrônica
          duration: 2500,
          volume: 0.5,
          envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.65 },
          waveType: 'sawtooth'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [261.63, 329.63, 392.00], // C4, E4, G4 (acorde natural)
          duration: 4000,
          volume: 0.3,
          envelope: { attack: 0.8, decay: 1.0, sustain: 0.7, release: 1.5 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [880, 1760],
          duration: 800,
          volume: 0.25,
          envelope: { attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.53 }
        }
      },

      [SoundType.BREAK_START]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [392.00, 493.88, 587.33], // G4, B4, D5 (acorde G maior)
          duration: 2500,
          volume: 0.3,
          envelope: { attack: 0.2, decay: 0.4, sustain: 0.5, release: 1.4 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [150, 300, 450], // Sons graves relaxantes
          duration: 2000,
          volume: 0.3,
          envelope: { attack: 0.3, decay: 0.5, sustain: 0.6, release: 1.2 },
          waveType: 'triangle'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [220, 275, 330], // Frequências naturais baixas
          duration: 3500,
          volume: 0.25,
          envelope: { attack: 1.0, decay: 1.2, sustain: 0.8, release: 1.3 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [330],
          duration: 600,
          volume: 0.2,
          envelope: { attack: 0.05, decay: 0.1, sustain: 0.25, release: 0.4 }
        }
      },

      [SoundType.BREAK_COMPLETE]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [659.25, 783.99, 987.77], // E5, G5, B5 (acorde E maior)
          duration: 2000,
          volume: 0.35,
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.2 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [400, 800, 1600], // Energético eletrônico
          duration: 1800,
          volume: 0.4,
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.35, release: 1.2 },
          waveType: 'square'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [440, 554.37, 659.25], // A4, C#5, E5 naturais
          duration: 2800,
          volume: 0.3,
          envelope: { attack: 0.4, decay: 0.6, sustain: 0.5, release: 1.2 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [554.37, 659.25],
          duration: 700,
          volume: 0.22,
          envelope: { attack: 0.03, decay: 0.12, sustain: 0.25, release: 0.45 }
        }
      },

      [SoundType.NOTIFICATION]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [880],
          duration: 800,
          volume: 0.25,
          envelope: { attack: 0.05, decay: 0.15, sustain: 0.3, release: 0.5 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [1000, 1500],
          duration: 600,
          volume: 0.3,
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.38 },
          waveType: 'square'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [660],
          duration: 1000,
          volume: 0.2,
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 0.5 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [800],
          duration: 300,
          volume: 0.15,
          envelope: { attack: 0.01, decay: 0.05, sustain: 0.1, release: 0.24 }
        }
      },

      [SoundType.WARNING]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [622.25, 622.25, 622.25], // D#5 repetido (tom de alerta)
          duration: 1200,
          volume: 0.4,
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.28 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [800, 400, 800], // Alternância eletrônica
          duration: 1000,
          volume: 0.45,
          envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.04 },
          waveType: 'square'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [440, 466.16], // A4 e A#4 (dissonância natural)
          duration: 1500,
          volume: 0.35,
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [1000],
          duration: 400,
          volume: 0.25,
          envelope: { attack: 0.01, decay: 0.03, sustain: 0.9, release: 0.06 }
        }
      },

      [SoundType.SUCCESS]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 (acorde alegre)
          duration: 1500,
          volume: 0.35,
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.85 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [500, 1000, 2000], // Progressão ascendente
          duration: 1200,
          volume: 0.4,
          envelope: { attack: 0.03, decay: 0.15, sustain: 0.3, release: 0.72 },
          waveType: 'sawtooth'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [329.63, 415.30, 523.25], // E4, G#4, C5 (maior natural)
          duration: 2000,
          volume: 0.3,
          envelope: { attack: 0.2, decay: 0.4, sustain: 0.5, release: 1.0 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [880],
          duration: 500,
          volume: 0.2,
          envelope: { attack: 0.02, decay: 0.08, sustain: 0.2, release: 0.3 }
        }
      },

      [SoundType.ERROR]: {
        [SoundTheme.CLASSIC]: {
          frequencies: [311.13, 277.18], // D#4, C#4 (dissonância menor)
          duration: 1000,
          volume: 0.35,
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.28 }
        },
        [SoundTheme.MODERN]: {
          frequencies: [200, 150], // Sons graves de erro
          duration: 800,
          volume: 0.4,
          envelope: { attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.14 },
          waveType: 'square'
        },
        [SoundTheme.NATURAL]: {
          frequencies: [220, 233.08], // A3, A#3 (dissonância natural)
          duration: 1200,
          volume: 0.3,
          envelope: { attack: 0.05, decay: 0.15, sustain: 0.7, release: 0.3 },
          waveType: 'triangle'
        },
        [SoundTheme.MINIMAL]: {
          frequencies: [400],
          duration: 300,
          volume: 0.2,
          envelope: { attack: 0.01, decay: 0.02, sustain: 0.8, release: 0.07 }
        }
      }
    };

    const soundSpec = specs[soundType]?.[theme];
    if (!soundSpec) {
      // Fallback para som padrão
      return {
        frequencies: [440],
        duration: 500,
        volume: 0.2,
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.35 }
      };
    }

    return soundSpec;
  }

  /**
   * Cria áudio sintético baseado nas especificações
   */
  private static createSyntheticAudio(spec: SoundSpec): string {
    // Em uma implementação real, isso usaria Web Audio API para gerar o áudio
    // Por enquanto, retornamos uma representação das especificações
    
    const audioData = {
      type: 'synthetic',
      frequencies: spec.frequencies,
      duration: spec.duration,
      volume: spec.volume,
      envelope: spec.envelope,
      waveType: spec.waveType || 'sine',
      timestamp: Date.now()
    };

    // Retorna dados codificados que podem ser usados para reprodução
    return btoa(JSON.stringify(audioData));
  }

  /**
   * Decodifica e reproduz som sintético
   */
  public static async playSyntheticSound(encodedSound: string, volume?: number): Promise<void> {
    try {
      const audioData = JSON.parse(atob(encodedSound));
      
      console.log(`🎵 Reproduzindo som sintético:`, {
        frequencies: audioData.frequencies,
        duration: audioData.duration,
        volume: volume || audioData.volume,
        waveType: audioData.waveType,
        envelope: audioData.envelope
      });

      // Usar SimpleSoundPlayer para reprodução real
      try {
        const soundPlayer = SimpleSoundPlayer.getInstance();
        await soundPlayer.playSound(audioData, volume);
        console.log(`✅ Som reproduzido com SimpleSoundPlayer`);
        return;
      } catch (playerError) {
        console.warn('⚠️ Falha no SimpleSoundPlayer:', playerError);
      }

      // Fallback final - apenas aguardar duração
      await new Promise(resolve => setTimeout(resolve, Math.min(audioData.duration, 100)));
      console.log(`⏰ Som simulado (duração: ${audioData.duration}ms)`);
      
      console.log(`✅ Som sintético concluído`);

    } catch (error) {
      console.error('❌ Erro ao reproduzir som sintético:', error);
      throw error;
    }
  }

  /**
   * Gera tons DTMF (telefone) para notificações específicas
   */
  public static generateDTMFTone(digit: string): string {
    const dtmfFreqs: { [key: string]: [number, number] } = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };

    const [lowFreq, highFreq] = dtmfFreqs[digit] || [400, 800];
    
    const spec: SoundSpec = {
      frequencies: [lowFreq, highFreq],
      duration: 200,
      volume: 0.3,
      envelope: { attack: 0.01, decay: 0.02, sustain: 0.9, release: 0.07 },
      waveType: 'sine'
    };

    return this.createSyntheticAudio(spec);
  }

  /**
   * Gera sequência de beeps para alertas
   */
  public static generateBeepSequence(count: number, frequency: number = 800): string {
    const spec: SoundSpec = {
      frequencies: [frequency],
      duration: count * 200 + (count - 1) * 100, // beeps + pausas
      volume: 0.4,
      envelope: { attack: 0.01, decay: 0.02, sustain: 0.8, release: 0.07 },
      waveType: 'square'
    };

    const audioData = {
      type: 'beep_sequence',
      count: count,
      frequency: frequency,
      ...spec,
      timestamp: Date.now()
    };

    return btoa(JSON.stringify(audioData));
  }

  /**
   * Reproduz DTMF diretamente (sem codificação)
   */
  public static async playDTMFDirect(digit: string): Promise<void> {
    const soundPlayer = SimpleSoundPlayer.getInstance();
    await soundPlayer.playDTMFTone(digit);
  }

  /**
   * Reproduz sequência de beeps diretamente (sem codificação)
   */
  public static async playBeepSequenceDirect(count: number, frequency?: number): Promise<void> {
    const soundPlayer = SimpleSoundPlayer.getInstance();
    await soundPlayer.playBeepSequence(count, frequency);
  }

  /**
   * Teste de áudio do sistema
   */
  public static async testSystemAudio(): Promise<boolean> {
    const soundPlayer = SimpleSoundPlayer.getInstance();
    return await soundPlayer.testSystemAudio();
  }
}

/**
 * Especificação de um som sintético
 */
interface SoundSpec {
  frequencies: number[];           // Frequências em Hz
  duration: number;               // Duração em ms
  volume: number;                 // Volume 0-1
  envelope: EnvelopeSpec;         // Envelope ADSR
  waveType?: 'sine' | 'square' | 'sawtooth' | 'triangle'; // Tipo de onda
}

/**
 * Especificação de envelope ADSR
 */
interface EnvelopeSpec {
  attack: number;   // Tempo de ataque (s)
  decay: number;    // Tempo de decaimento (s)
  sustain: number;  // Nível de sustentação (0-1)
  release: number;  // Tempo de liberação (s)
}
