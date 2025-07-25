import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import { ModalManager } from '../modules/modal';
import { PomodoroManager } from '../modules/pomodoro';
import { PomodoroConfig } from '../modules/database';

/**
 * Configuração específica para o modal de configurações do Pomodoro
 */
export interface PomodoroSettingsConfig {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  enableSoundAlerts: boolean;
  enableDesktopNotifications: boolean;
  enableStatusBarTimer: boolean;
  dailyGoalSessions: number;
}

/**
 * Presets predefinidos para diferentes estilos de trabalho
 */
export interface PomodoroPreset {
  id: string;
  name: string;
  description: string;
  config: PomodoroSettingsConfig;
}

/**
 * Modal de configurações avançadas do Pomodoro
 * Permite personalizar todos os aspectos do sistema Pomodoro
 */
export class PomodoroSettingsModal {
  private static instance: PomodoroSettingsModal;
  private modalManager: ModalManager;
  private pomodoroManager: PomodoroManager | null = null;
  private currentConfig: PomodoroSettingsConfig | null = null;

  private constructor() {
    this.modalManager = ModalManager.getInstance();
  }

  public static getInstance(): PomodoroSettingsModal {
    if (!PomodoroSettingsModal.instance) {
      PomodoroSettingsModal.instance = new PomodoroSettingsModal();
    }
    return PomodoroSettingsModal.instance;
  }

  /**
   * Inicializa o modal com referência ao PomodoroManager
   */
  public initialize(pomodoroManager: PomodoroManager): void {
    this.pomodoroManager = pomodoroManager;
    console.log('🎨 PomodoroSettingsModal inicializado');
  }

  /**
   * Presets predefinidos
   */
  private getPresets(): PomodoroPreset[] {
    return [
      {
        id: 'classic',
        name: 'Clássico',
        description: 'Pomodoro tradicional (25-5-15 min)',
        config: {
          focusDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          sessionsUntilLongBreak: 4,
          autoStartBreaks: false,
          autoStartFocus: false,
          enableSoundAlerts: true,
          enableDesktopNotifications: true,
          enableStatusBarTimer: true,
          dailyGoalSessions: 12
        }
      },
      {
        id: 'deepFocus',
        name: 'Foco Profundo',
        description: 'Sessões longas para trabalho concentrado (45-15-30 min)',
        config: {
          focusDuration: 45,
          shortBreakDuration: 15,
          longBreakDuration: 30,
          sessionsUntilLongBreak: 4,
          autoStartBreaks: true,
          autoStartFocus: false,
          enableSoundAlerts: true,
          enableDesktopNotifications: true,
          enableStatusBarTimer: true,
          dailyGoalSessions: 8
        }
      },
      {
        id: 'sprint',
        name: 'Sprint Rápido',
        description: 'Sessões curtas para tarefas ágeis (15-3-10 min)',
        config: {
          focusDuration: 15,
          shortBreakDuration: 3,
          longBreakDuration: 10,
          sessionsUntilLongBreak: 6,
          autoStartBreaks: true,
          autoStartFocus: true,
          enableSoundAlerts: true,
          enableDesktopNotifications: true,
          enableStatusBarTimer: true,
          dailyGoalSessions: 16
        }
      }
    ];
  }

  /**
   * Obtém configuração atual do PomodoroManager
   */
  private getCurrentConfig(): PomodoroSettingsConfig {
    if (!this.pomodoroManager) {
      return this.getDefaultConfig();
    }

    const config = this.pomodoroManager.getConfig();
    if (!config) {
      return this.getDefaultConfig();
    }

    return {
      focusDuration: config.focusDuration,
      shortBreakDuration: config.shortBreakDuration,
      longBreakDuration: config.longBreakDuration,
      sessionsUntilLongBreak: config.sessionsUntilLongBreak,
      autoStartBreaks: config.autoStartBreaks,
      autoStartFocus: config.autoStartFocus,
      enableSoundAlerts: config.enableSoundAlerts,
      enableDesktopNotifications: config.enableDesktopNotifications,
      enableStatusBarTimer: config.enableStatusBarTimer,
      dailyGoalSessions: config.dailyGoalSessions
    };
  }

  /**
   * Configuração padrão (Foco Profundo)
   */
  private getDefaultConfig(): PomodoroSettingsConfig {
    return {
      focusDuration: 45,
      shortBreakDuration: 15,
      longBreakDuration: 30,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      enableSoundAlerts: true,
      enableDesktopNotifications: true,
      enableStatusBarTimer: true,
      dailyGoalSessions: 8
    };
  }

  /**
   * Valida configuração
   */
  private validateConfig(config: PomodoroSettingsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar durações
    if (config.focusDuration < 5 || config.focusDuration > 120) {
      errors.push('Duração do foco deve ser entre 5 e 120 minutos');
    }
    if (config.shortBreakDuration < 1 || config.shortBreakDuration > 30) {
      errors.push('Pausa curta deve ser entre 1 e 30 minutos');
    }
    if (config.longBreakDuration < 5 || config.longBreakDuration > 60) {
      errors.push('Pausa longa deve ser entre 5 e 60 minutos');
    }

    // Validar lógica
    if (config.shortBreakDuration >= config.focusDuration) {
      errors.push('Pausa curta não pode ser maior ou igual ao foco');
    }
    if (config.longBreakDuration <= config.shortBreakDuration) {
      errors.push('Pausa longa deve ser maior que a pausa curta');
    }

    // Validar sessões
    if (config.sessionsUntilLongBreak < 1 || config.sessionsUntilLongBreak > 10) {
      errors.push('Sessões até pausa longa deve ser entre 1 e 10');
    }
    if (config.dailyGoalSessions < 1 || config.dailyGoalSessions > 20) {
      errors.push('Meta diária deve ser entre 1 e 20 sessões');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Gera HTML do modal de configurações
   */
  private generateSettingsHTML(config: PomodoroSettingsConfig): string {
    const presets = this.getPresets();
    
    return `
      <style>
        .settings-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: var(--vscode-font-family);
        }
        
        .settings-section {
          margin-bottom: 24px;
          padding: 16px;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
        }
        
        .settings-section h3 {
          margin: 0 0 16px 0;
          color: var(--vscode-foreground);
          font-size: 16px;
          font-weight: 600;
        }
        
        .preset-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        
        .preset-btn {
          padding: 8px 16px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: 1px solid var(--vscode-button-border);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .preset-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .preset-btn.active {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .field-group {
          margin-bottom: 16px;
        }
        
        .field-label {
          display: block;
          margin-bottom: 4px;
          color: var(--vscode-foreground);
          font-size: 13px;
          font-weight: 500;
        }
        
        .field-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .slider-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .slider {
          flex: 1;
          height: 4px;
          background: var(--vscode-scrollbarSlider-background);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: var(--vscode-button-background);
          border-radius: 50%;
          cursor: pointer;
        }
        
        .value-display {
          min-width: 60px;
          text-align: right;
          color: var(--vscode-foreground);
          font-size: 13px;
          font-weight: 500;
        }
        
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .checkbox-label {
          color: var(--vscode-foreground);
          font-size: 13px;
          cursor: pointer;
        }
        
        .buttons-container {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }
        
        .btn {
          padding: 8px 16px;
          border: 1px solid var(--vscode-button-border);
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        .error-message {
          background: var(--vscode-inputValidation-errorBackground);
          color: var(--vscode-inputValidation-errorForeground);
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 12px;
        }
      </style>
      
      <div class="settings-container">
        <div class="settings-section">
          <h3>📝 Perfis Predefinidos</h3>
          <div class="preset-buttons">
            ${presets.map(preset => `
              <button class="preset-btn" data-preset="${preset.id}">
                ${preset.name}
              </button>
            `).join('')}
          </div>
          <div style="color: var(--vscode-descriptionForeground); font-size: 12px;">
            Selecione um perfil ou personalize as configurações abaixo
          </div>
        </div>

        <div class="settings-section">
          <h3>⏱️ Durações</h3>
          
          <div class="field-group">
            <label class="field-label">Foco</label>
            <div class="field-row">
              <div class="slider-container">
                <input type="range" class="slider" id="focusDuration" 
                       min="5" max="120" value="${config.focusDuration}" step="5">
                <span class="value-display" id="focusDurationValue">${config.focusDuration} min</span>
              </div>
            </div>
          </div>
          
          <div class="field-group">
            <label class="field-label">Pausa Curta</label>
            <div class="field-row">
              <div class="slider-container">
                <input type="range" class="slider" id="shortBreakDuration" 
                       min="1" max="30" value="${config.shortBreakDuration}" step="1">
                <span class="value-display" id="shortBreakDurationValue">${config.shortBreakDuration} min</span>
              </div>
            </div>
          </div>
          
          <div class="field-group">
            <label class="field-label">Pausa Longa</label>
            <div class="field-row">
              <div class="slider-container">
                <input type="range" class="slider" id="longBreakDuration" 
                       min="5" max="60" value="${config.longBreakDuration}" step="5">
                <span class="value-display" id="longBreakDurationValue">${config.longBreakDuration} min</span>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>🔄 Comportamento</h3>
          
          <div class="checkbox-container">
            <input type="checkbox" class="checkbox" id="autoStartBreaks" 
                   ${config.autoStartBreaks ? 'checked' : ''}>
            <label class="checkbox-label" for="autoStartBreaks">Auto-iniciar pausas</label>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" class="checkbox" id="autoStartFocus" 
                   ${config.autoStartFocus ? 'checked' : ''}>
            <label class="checkbox-label" for="autoStartFocus">Auto-iniciar foco após pausa</label>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" class="checkbox" id="enableSoundAlerts" 
                   ${config.enableSoundAlerts ? 'checked' : ''}>
            <label class="checkbox-label" for="enableSoundAlerts">Alertas sonoros</label>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" class="checkbox" id="enableDesktopNotifications" 
                   ${config.enableDesktopNotifications ? 'checked' : ''}>
            <label class="checkbox-label" for="enableDesktopNotifications">Notificações desktop</label>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" class="checkbox" id="enableStatusBarTimer" 
                   ${config.enableStatusBarTimer ? 'checked' : ''}>
            <label class="checkbox-label" for="enableStatusBarTimer">Mostrar timer na status bar</label>
          </div>
        </div>

        <div class="settings-section">
          <h3>🎯 Metas e Ciclos</h3>
          
          <div class="field-group">
            <label class="field-label">Sessões até pausa longa</label>
            <div class="field-row">
              <div class="slider-container">
                <input type="range" class="slider" id="sessionsUntilLongBreak" 
                       min="1" max="10" value="${config.sessionsUntilLongBreak}" step="1">
                <span class="value-display" id="sessionsUntilLongBreakValue">${config.sessionsUntilLongBreak}</span>
              </div>
            </div>
          </div>
          
          <div class="field-group">
            <label class="field-label">Meta diária de sessões</label>
            <div class="field-row">
              <div class="slider-container">
                <input type="range" class="slider" id="dailyGoalSessions" 
                       min="1" max="20" value="${config.dailyGoalSessions}" step="1">
                <span class="value-display" id="dailyGoalSessionsValue">${config.dailyGoalSessions}</span>
              </div>
            </div>
          </div>
        </div>

        <div id="errorContainer"></div>

        <div class="buttons-container">
          <button class="btn btn-secondary" id="resetBtn">Restaurar Padrões</button>
          <button class="btn btn-secondary" id="cancelBtn">Cancelar</button>
          <button class="btn btn-primary" id="saveBtn">Salvar</button>
        </div>
      </div>
    `;
  }

  /**
   * Gera JavaScript para interatividade do modal
   */
  private generateSettingsScript(config: PomodoroSettingsConfig): string {
    const presets = this.getPresets();
    const presetsJSON = JSON.stringify(presets);
    
    return `
      (function() {
        const presets = ${presetsJSON};
        let currentConfig = ${JSON.stringify(config)};
        
        // Atualizar valor do slider
        function updateSliderValue(sliderId) {
          const slider = document.getElementById(sliderId);
          const valueDisplay = document.getElementById(sliderId + 'Value');
          if (slider && valueDisplay) {
            const value = slider.value;
            const unit = sliderId.includes('Duration') ? ' min' : '';
            valueDisplay.textContent = value + unit;
            currentConfig[sliderId] = parseInt(value);
          }
        }
        
        // Configurar listeners para sliders
        ['focusDuration', 'shortBreakDuration', 'longBreakDuration', 'sessionsUntilLongBreak', 'dailyGoalSessions'].forEach(id => {
          const slider = document.getElementById(id);
          if (slider) {
            slider.addEventListener('input', () => updateSliderValue(id));
          }
        });
        
        // Configurar listeners para checkboxes
        ['autoStartBreaks', 'autoStartFocus', 'enableSoundAlerts', 'enableDesktopNotifications', 'enableStatusBarTimer'].forEach(id => {
          const checkbox = document.getElementById(id);
          if (checkbox) {
            checkbox.addEventListener('change', () => {
              currentConfig[id] = checkbox.checked;
            });
          }
        });
        
        // Aplicar preset
        function applyPreset(presetId) {
          const preset = presets.find(p => p.id === presetId);
          if (!preset) return;
          
          currentConfig = { ...preset.config };
          
          // Atualizar UI
          Object.keys(preset.config).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
              if (element.type === 'checkbox') {
                element.checked = preset.config[key];
              } else if (element.type === 'range') {
                element.value = preset.config[key];
                updateSliderValue(key);
              }
            }
          });
          
          // Atualizar visual dos botões de preset
          document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          document.querySelector(\`[data-preset="\${presetId}"]\`).classList.add('active');
          
          clearErrors();
        }
        
        // Configurar listeners para presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            applyPreset(btn.dataset.preset);
          });
        });
        
        // Validar configuração
        function validateCurrentConfig() {
          const errors = [];
          
          if (currentConfig.focusDuration < 5 || currentConfig.focusDuration > 120) {
            errors.push('Duração do foco deve ser entre 5 e 120 minutos');
          }
          if (currentConfig.shortBreakDuration < 1 || currentConfig.shortBreakDuration > 30) {
            errors.push('Pausa curta deve ser entre 1 e 30 minutos');
          }
          if (currentConfig.longBreakDuration < 5 || currentConfig.longBreakDuration > 60) {
            errors.push('Pausa longa deve ser entre 5 e 60 minutos');
          }
          if (currentConfig.shortBreakDuration >= currentConfig.focusDuration) {
            errors.push('Pausa curta não pode ser maior ou igual ao foco');
          }
          if (currentConfig.longBreakDuration <= currentConfig.shortBreakDuration) {
            errors.push('Pausa longa deve ser maior que a pausa curta');
          }
          if (currentConfig.sessionsUntilLongBreak < 1 || currentConfig.sessionsUntilLongBreak > 10) {
            errors.push('Sessões até pausa longa deve ser entre 1 e 10');
          }
          if (currentConfig.dailyGoalSessions < 1 || currentConfig.dailyGoalSessions > 20) {
            errors.push('Meta diária deve ser entre 1 e 20 sessões');
          }
          
          return errors;
        }
        
        // Mostrar erros
        function showErrors(errors) {
          const container = document.getElementById('errorContainer');
          if (errors.length > 0) {
            container.innerHTML = \`
              <div class="error-message">
                <strong>❌ Erro de validação:</strong><br>
                \${errors.join('<br>')}
              </div>
            \`;
          } else {
            container.innerHTML = '';
          }
        }
        
        // Limpar erros
        function clearErrors() {
          document.getElementById('errorContainer').innerHTML = '';
        }
        
        // Botão Salvar
        document.getElementById('saveBtn').addEventListener('click', () => {
          const errors = validateCurrentConfig();
          if (errors.length > 0) {
            showErrors(errors);
            return;
          }
          
          // Enviar configuração via postMessage
          vscode.postMessage({
            command: 'saveSettings',
            config: currentConfig
          });
        });
        
        // Botão Cancelar
        document.getElementById('cancelBtn').addEventListener('click', () => {
          vscode.postMessage({
            command: 'cancelSettings'
          });
        });
        
        // Botão Restaurar
        document.getElementById('resetBtn').addEventListener('click', () => {
          applyPreset('deepFocus'); // Padrão atual
        });
        
        // Detectar preset atual baseado na configuração
        function detectCurrentPreset() {
          for (const preset of presets) {
            let matches = true;
            for (const key in preset.config) {
              if (currentConfig[key] !== preset.config[key]) {
                matches = false;
                break;
              }
            }
            if (matches) {
              document.querySelector(\`[data-preset="\${preset.id}"]\`).classList.add('active');
              break;
            }
          }
        }
        
        // Inicializar
        detectCurrentPreset();
      })();
    `;
  }

  /**
   * Exibe o modal de configurações do Pomodoro
   */
  public async showSettings(): Promise<void> {
    try {
      console.log('⚙️ Abrindo configurações do Pomodoro...');

      if (!this.pomodoroManager) {
        vscode.window.showErrorMessage('PomodoroManager não inicializado');
        return;
      }

      // Obter configuração atual
      this.currentConfig = this.getCurrentConfig();

      const modalConfig = {
        id: 'pomodoro-settings',
        title: 'Configurações do Pomodoro',
        content: this.generateSettingsHTML(this.currentConfig),
        script: this.generateSettingsScript(this.currentConfig),
        width: '680px',
        height: '720px',
        onMessage: async (message: any) => {
          await this.handleModalMessage(message);
        }
      };

      await this.modalManager.showModal(modalConfig);
      console.log('✅ Modal de configurações do Pomodoro exibido');

    } catch (error) {
      console.error('❌ Erro ao exibir configurações do Pomodoro:', error);
      vscode.window.showErrorMessage('Erro ao abrir configurações do Pomodoro');
    }
  }

  /**
   * Processa mensagens do modal
   */
  private async handleModalMessage(message: any): Promise<void> {
    try {
      switch (message.command) {
        case 'saveSettings':
          await this.saveSettings(message.config);
          break;
        case 'cancelSettings':
          this.modalManager.closeModal('pomodoro-settings');
          break;
        default:
          console.warn('Comando desconhecido:', message.command);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem do modal:', error);
      vscode.window.showErrorMessage('Erro ao processar ação');
    }
  }

  /**
   * Salva as configurações
   */
  private async saveSettings(newConfig: PomodoroSettingsConfig): Promise<void> {
    try {
      if (!this.pomodoroManager) {
        throw new Error('PomodoroManager não inicializado');
      }

      // Validar configuração
      const validation = this.validateConfig(newConfig);
      if (!validation.valid) {
        vscode.window.showErrorMessage('Configuração inválida: ' + validation.errors.join(', '));
        return;
      }

      // Aplicar configuração
      await this.pomodoroManager.updateConfig(newConfig);

      // Fechar modal
      this.modalManager.closeModal('pomodoro-settings');

      // Feedback ao usuário
      vscode.window.showInformationMessage('✅ Configurações do Pomodoro salvas com sucesso!');
      
      console.log('💾 Configurações do Pomodoro salvas:', newConfig);

    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      vscode.window.showErrorMessage('Erro ao salvar configurações');
    }
  }
}
