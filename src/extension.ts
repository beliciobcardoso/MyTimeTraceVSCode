import * as nls from 'vscode-nls';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as vscode from 'vscode';
import { DatabaseManager } from "./modules/database";
import { StatusBarManager } from "./modules/statusBar";
import { timeTrace } from "./modules/timeTrace";
import { StatsManager } from "./modules/stats";
import { CommandManager } from "./modules/commands";
import { getConfig } from "./modules/config";
import { PomodoroManager } from "./modules/pomodoro";
import { ModalManager } from "./modules/modal";
import { FocusCompleteModal } from "./ui/focusCompleteModal";
import { PomodoroSettingsModal } from "./ui/pomodoroSettingsModal";
import { SoundManager, SoundType, SoundTheme } from "./modules/soundManager";
import { VisualState } from "./modules/visualEffectsManager";
import { DesktopNotificationManager } from "./modules/desktopNotifications";

// Variáveis globais para gerenciar a extensão
let globalContext: vscode.ExtensionContext | null = null;
let dbManager: DatabaseManager;
let statusBarManager: StatusBarManager;
let myTimeTrace: timeTrace;
let statsManager: StatsManager;
let pomodoroManager: PomodoroManager;
let modalManager: ModalManager;
let focusCompleteModal: FocusCompleteModal;
let pomodoroSettingsModal: PomodoroSettingsModal;
let soundManager: SoundManager;
let desktopNotificationManager: DesktopNotificationManager;

// Ativação da extensão
export async function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  
  // Logs de ativação
  console.log("=======================================");
  console.log(localize('extension.activated', 'Extension "my-time-trace-vscode" activated!'));
  console.log("Versão: 0.2.1");
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Inicializa os módulos
  try {
    // Inicializa o banco de dados
    dbManager = new DatabaseManager();
    await dbManager.initialize(context.globalStorageUri.fsPath);

    // Inicializa os gerenciadores
    statusBarManager = new StatusBarManager();
    myTimeTrace = new timeTrace(dbManager, statusBarManager);
    statsManager = new StatsManager(dbManager);
    
    // Inicializa o Modal Manager
    modalManager = ModalManager.getInstance();
    modalManager.initialize(context);
    
    // Inicializa o Sound Manager
    soundManager = SoundManager.getInstance();
    soundManager.initialize(context);
    
    // Inicializa o Desktop Notification Manager
    desktopNotificationManager = DesktopNotificationManager.getInstance();
    desktopNotificationManager.initialize(context);
    
    // Inicializa o Pomodoro Manager com referência ao timeTrace
    pomodoroManager = new PomodoroManager(dbManager, statusBarManager, myTimeTrace);
    await pomodoroManager.initialize();

    // Inicializa o Focus Complete Modal
    focusCompleteModal = FocusCompleteModal.getInstance();
    focusCompleteModal.initialize(pomodoroManager);

    // Inicializa o Pomodoro Settings Modal
    pomodoroSettingsModal = PomodoroSettingsModal.getInstance();
    pomodoroSettingsModal.initialize(pomodoroManager);

    // Conecta eventos do Pomodoro com Modals e Notificações
    pomodoroManager.setEvents({
      onFocusStart: async (duration: number) => {
        // Notificação de início de foco
        if (pomodoroManager.getConfig()?.enableDesktopNotifications) {
          await desktopNotificationManager.showFocusStartNotification(duration);
        }
      },
      onFocusComplete: async () => {
        // Disparar modal quando foco completa (45 minutos)
        await focusCompleteModal.showFocusCompleteAlert({
          focusDuration: 45, // minutos
          canContinue: true,
          continueMinutes: 5
        });
        
        // Notificação de foco completo
        if (pomodoroManager.getConfig()?.enableDesktopNotifications) {
          await desktopNotificationManager.showFocusCompleteNotification(45);
        }
      },
      onBreakStart: async (duration: number, type: 'short' | 'long') => {
        // Notificação de início de pausa
        if (pomodoroManager.getConfig()?.enableDesktopNotifications) {
          await desktopNotificationManager.showBreakStartNotification(duration);
        }
      },
      onBreakComplete: async () => {
        // Notificação de fim de pausa
        if (pomodoroManager.getConfig()?.enableDesktopNotifications) {
          await desktopNotificationManager.showBreakCompleteNotification();
        }
      }
    });

    // Cria e configura o status bar
    statusBarManager.create();

    // Registra os comandos
    const commands = CommandManager.registerCommands(
      () => myTimeTrace.startTracking(),
      () => myTimeTrace.pauseTracking(),
      () => statsManager.showStats(),
      // Comandos do Pomodoro
      () => pomodoroManager.startFocusSession(),
      () => pomodoroManager.pauseSession(),
      () => pomodoroManager.stopSession(),
      async () => {
        // Abrir configurações avançadas do Pomodoro
        await pomodoroSettingsModal.showSettings();
      }
    );

    // Comando adicional para iniciar break (usado pelas notificações)
    const startBreakCommand = CommandManager.safeRegisterCommand(
      'my-time-trace-vscode.startBreak',
      async () => {
        try {
          console.log('🟢 Comando startBreak executado');
          await pomodoroManager.startBreakSession('short');
        } catch (error) {
          console.error('❌ Erro ao iniciar break:', error);
          vscode.window.showErrorMessage('Erro ao iniciar pausa');
        }
      }
    );

    // Comando de teste para modais (apenas durante desenvolvimento)
    const testModalCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testModal', async () => {
      try {
        // Teste básico inline para validar sistema de modal
        const testConfig = {
          id: 'test-modal-basic',
          title: 'Teste Sistema Modal',
          content: `
            <div class="text-center">
              <div class="modal-icon">🧪</div>
              <h3>Sistema de Modal Base</h3>
              <p>TAREFA 1 - Sistema funcionando!</p>
            </div>
          `,
          buttons: [{
            id: 'ok',
            text: 'OK',
            primary: true,
            onClick: () => modalManager.closeModal('test-modal-basic')
          }],
          width: '400px',
          height: '300px'
        };
        
        await modalManager.showModal(testConfig);
        console.log('✅ Teste de modal executado com sucesso');
      } catch (error) {
        console.error('❌ Erro ao testar modal:', error);
        vscode.window.showErrorMessage('Erro ao testar sistema de modais');
      }
    });
    
    // Comando de teste para Focus Complete Modal
    const testFocusModalCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testFocusCompleteModal', async () => {
      try {
        console.log('🧪 Testando Focus Complete Modal...');
        await focusCompleteModal.showFocusCompleteAlert({
          focusDuration: 45,
          canContinue: true,
          continueMinutes: 5
        });
        console.log('✅ Focus Complete Modal testado com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar Focus Complete Modal:', error);
        vscode.window.showErrorMessage('Erro ao testar Focus Complete Modal');
      }
    });
    
    // Comando de teste para integração automática (simular disparo real)
    const testPomodoroIntegrationCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testPomodoroIntegration', async () => {
      try {
        console.log('🔗 Testando integração automática Pomodoro...');
        
        // Verificar se Pomodoro está configurado
        if (!pomodoroManager) {
          vscode.window.showErrorMessage('PomodoroManager não inicializado');
          return;
        }
        
        // Simular evento de foco completo diretamente
        vscode.window.showInformationMessage('🧪 Simulando completar 45 minutos de foco...');
        
        // Aguardar 2 segundos para parecer real
        setTimeout(async () => {
          // Disparar evento manualmente para testar
          await focusCompleteModal.showFocusCompleteAlert({
            focusDuration: 45,
            canContinue: true,
            continueMinutes: 5
          });
          
          vscode.window.showInformationMessage('✅ Teste de integração concluído! Modal deve ter aparecido automaticamente.');
        }, 2000);
        
      } catch (error) {
        console.error('❌ Erro ao testar integração:', error);
        vscode.window.showErrorMessage('Erro ao testar integração Pomodoro');
      }
    });
    
    // Comando para testar Pomodoro real com tempo acelerado (desenvolvimento)
    const testRealPomodoroCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testRealPomodoro', async () => {
      try {
        console.log('⚡ Iniciando Pomodoro real com tempo acelerado...');
        
        if (!pomodoroManager) {
          vscode.window.showErrorMessage('PomodoroManager não inicializado');
          return;
        }
        
        // Informar ao usuário
        const choice = await vscode.window.showInformationMessage(
          '⚡ Iniciar Pomodoro real com 10 segundos (em vez de 45 minutos) para testar integração?',
          'Sim, testar', 'Cancelar'
        );
        
        if (choice !== 'Sim, testar') {
          return;
        }
        
        // Modificar temporariamente a configuração para teste rápido
        const originalConfig = pomodoroManager.getConfig();
        if (originalConfig) {
          await pomodoroManager.updateConfig({
            focusDuration: 0.1, // 6 segundos em vez de 45 minutos para teste rápido
            shortBreakDuration: 0.1, // 6 segundos também
            autoStartBreaks: true
          });
        }
        
        // Iniciar sessão de foco
        await pomodoroManager.startFocusSession();
        
        vscode.window.showInformationMessage(
          '⏱️ Pomodoro iniciado! O modal deve aparecer automaticamente em ~6 segundos. Certifique-se de estar codificando para ativar o timer.',
          'OK'
        );
        
      } catch (error) {
        console.error('❌ Erro ao testar Pomodoro real:', error);
        vscode.window.showErrorMessage('Erro ao iniciar Pomodoro de teste');
      }
    });
    
    // Comando de teste para configurações do Pomodoro
    const testPomodoroSettingsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testPomodoroSettings', async () => {
      try {
        console.log('⚙️ Testando configurações do Pomodoro...');
        await pomodoroSettingsModal.showSettings();
        console.log('✅ Modal de configurações testado com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar configurações:', error);
        vscode.window.showErrorMessage('Erro ao testar configurações do Pomodoro');
      }
    });
    
    // Comando de teste para notificações automáticas do Pomodoro
    const testPomodoroAutoNotificationsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testPomodoroAutoNotifications', async () => {
      try {
        console.log('🔔 Testando notificações automáticas do Pomodoro...');
        
        vscode.window.showInformationMessage(
          '🧪 Iniciando teste de notificações automáticas. Você verá notificações quando eventos do Pomodoro acontecerem.',
          'Iniciar Teste'
        );
        
        // Habilitar notificações temporariamente para o teste
        await pomodoroManager.updateConfig({
          enableDesktopNotifications: true,
          focusDuration: 0.1, // 6 segundos para teste rápido
          shortBreakDuration: 0.1 // 6 segundos para teste rápido
        });
        
        console.log('📋 Configuração temporária aplicada (6s para foco e pausa)');
        
        // Aguardar 1 segundo e iniciar sessão
        setTimeout(async () => {
          console.log('🎯 Iniciando sessão de foco (deve disparar notificação)...');
          await pomodoroManager.startFocusSession();
          
          // Após 7 segundos, iniciar pausa
          setTimeout(async () => {
            console.log('☕ Iniciando pausa (deve disparar notificação)...');
            await pomodoroManager.startBreakSession('short');
            
            // Após mais 7 segundos, mostrar resultado
            setTimeout(() => {
              console.log('✅ Teste de notificações automáticas concluído!');
              vscode.window.showInformationMessage(
                '✅ Teste concluído! Você deve ter visto 4 notificações: início foco, fim foco, início pausa, fim pausa.',
                'OK'
              );
              
              // Restaurar configurações padrão
              pomodoroManager.updateConfig({
                focusDuration: 45,
                shortBreakDuration: 15
              });
            }, 8000);
          }, 7000);
        }, 1000);
        
      } catch (error) {
        console.error('❌ Erro ao testar notificações automáticas:', error);
        vscode.window.showErrorMessage('Erro ao testar notificações automáticas do Pomodoro');
      }
    });
    
    // Comando de teste para sistema de sons
    const testSoundSystemCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testSoundSystem', async () => {
      try {
        console.log('🔊 Testando sistema de sons...');
        
        // Listar temas disponíveis
        const themes = soundManager.getAvailableThemes();
        const themeNames = themes.map(t => t.name);
        
        const selectedTheme = await vscode.window.showQuickPick(themeNames, {
          placeHolder: 'Selecione um tema de som para testar'
        });
        
        if (!selectedTheme) {
          return;
        }
        
        const theme = themes.find(t => t.name === selectedTheme)?.theme;
        if (!theme) {
          return;
        }
        
        // Testar sons do tema
        vscode.window.showInformationMessage(`🎵 Testando tema: ${selectedTheme}`);
        
        await soundManager.previewSound('focus_complete' as any, theme);
        
        setTimeout(async () => {
          await soundManager.previewSound('notification' as any, theme);
        }, 1000);
        
        console.log('✅ Sistema de sons testado com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar sistema de sons:', error);
        vscode.window.showErrorMessage('Erro ao testar sistema de sons');
      }
    });
    
    // Comando de teste para sons sintéticos
    const testSyntheticSoundsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testSyntheticSounds', async () => {
      try {
        console.log('🎵 Testando sons sintéticos...');
        vscode.window.showInformationMessage('🎵 Iniciando teste completo de sons sintéticos...');
        
        await soundManager.testSyntheticSounds();
        
        vscode.window.showInformationMessage('✅ Teste de sons sintéticos concluído! Verifique o console.');
        console.log('✅ Teste de sons sintéticos concluído com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar sons sintéticos:', error);
        vscode.window.showErrorMessage('Erro ao testar sons sintéticos');
      }
    });
    
    // Comando de teste para sons especiais (DTMF e beeps)
    const testSpecialSoundsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testSpecialSounds', async () => {
      try {
        console.log('🔔 Testando sons especiais...');
        vscode.window.showInformationMessage('🔔 Testando DTMF e sequências de beeps...');
        
        await soundManager.testSpecialSounds();
        
        vscode.window.showInformationMessage('✅ Teste de sons especiais concluído! Verifique o console.');
        console.log('✅ Teste de sons especiais concluído com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar sons especiais:', error);
        vscode.window.showErrorMessage('Erro ao testar sons especiais');
      }
    });

    // Comando de teste para arquivos WAV reais
    const testWavSoundsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testWavSounds', async () => {
      try {
        console.log('🎵 Testando arquivos WAV...');
        vscode.window.showInformationMessage('🎵 Testando arquivos WAV musicais...');
        
        const soundTypes = [
          SoundType.FOCUS_START,
          SoundType.FOCUS_COMPLETE,
          SoundType.NOTIFICATION,
          SoundType.SUCCESS
        ];
        
        for (const soundType of soundTypes) {
          vscode.window.showInformationMessage(`🎵 Reproduzindo: ${soundType}`);
          console.log(`🎵 Testando som: ${soundType}`);
          
          await soundManager.playSound(soundType, { 
            force: true, 
            volume: 60,
            theme: SoundTheme.CLASSIC 
          });
          
          // Pausa entre sons
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        vscode.window.showInformationMessage('✅ Teste de arquivos WAV concluído!');
        console.log('✅ Teste de arquivos WAV concluído com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar arquivos WAV:', error);
        vscode.window.showErrorMessage(`❌ Erro ao testar arquivos WAV: ${error}`);
      }
    });

    // Comando de teste para efeitos visuais
    const testVisualEffectsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testVisualEffects', async () => {
      try {
        console.log('🎨 Testando efeitos visuais...');
        vscode.window.showInformationMessage('🎨 Iniciando teste de efeitos visuais...');
        
        const visualEffects = statusBarManager.getVisualEffects();
        
        // Teste de estados visuais com valores enum corretos
        const states = [
          { state: VisualState.FOCUS_ACTIVE, message: '🎯 Modo Foco Ativo' },
          { state: VisualState.FOCUS_ENDING, message: '⚡ Foco Terminando' },
          { state: VisualState.BREAK_ACTIVE, message: '☕ Intervalo Ativo' },
          { state: VisualState.SUCCESS, message: '✅ Sucesso!' },
          { state: VisualState.WARNING, message: '⚠️ Atenção!' },
          { state: VisualState.NOTIFICATION, message: '🔔 Notificação' }
        ];
        
        for (const { state, message } of states) {
          vscode.window.showInformationMessage(`🎨 Testando: ${message}`);
          
          // Aplicar estado visual
          statusBarManager.setVisualState(state, {
            animated: true,
            duration: 1000,
            message: message
          });
          
          // Aguardar visualização
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Teste de notificação flash
        vscode.window.showInformationMessage('🎨 Testando notificações flash...');
        
        statusBarManager.showNotificationFlash('Informação', 'info');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusBarManager.showNotificationFlash('Sucesso', 'success');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusBarManager.showNotificationFlash('Aviso', 'warning');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusBarManager.showNotificationFlash('Erro', 'error');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Teste de pulsação
        vscode.window.showInformationMessage('🎨 Testando efeito de pulsação...');
        statusBarManager.startPulseEffect(VisualState.FOCUS_ACTIVE, 500);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        statusBarManager.stopPulseEffect();
        
        // Voltar ao estado idle
        statusBarManager.setVisualState(VisualState.IDLE);
        
        vscode.window.showInformationMessage('✅ Teste de efeitos visuais concluído!');
        console.log('✅ Teste de efeitos visuais concluído com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar efeitos visuais:', error);
        vscode.window.showErrorMessage(`❌ Erro ao testar efeitos visuais: ${error}`);
      }
    });
    
    // Comando de preview de som com seleção de tipo e tema
    const previewSoundCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.previewSound', async () => {
      try {
        // Selecionar tipo de som
        const soundTypes = [
          { label: '🎯 Início do Foco', value: 'focus_start' },
          { label: '✅ Foco Completo', value: 'focus_complete' },
          { label: '☕ Início do Intervalo', value: 'break_start' },
          { label: '🎉 Intervalo Completo', value: 'break_complete' },
          { label: '🔔 Notificação', value: 'notification' },
          { label: '⚠️ Aviso', value: 'warning' },
          { label: '✨ Sucesso', value: 'success' },
          { label: '❌ Erro', value: 'error' }
        ];
        
        const selectedType = await vscode.window.showQuickPick(soundTypes, {
          placeHolder: 'Selecione o tipo de som para preview'
        });
        
        if (!selectedType) {
          return;
        }
        
        // Selecionar tema
        const themes = soundManager.getAvailableThemes();
        const themeOptions = themes.map(t => ({
          label: `🎨 ${t.name}`,
          description: t.description,
          value: t.theme
        }));
        
        const selectedTheme = await vscode.window.showQuickPick(themeOptions, {
          placeHolder: 'Selecione o tema de som'
        });
        
        if (!selectedTheme) {
          return;
        }
        
        vscode.window.showInformationMessage(`🎧 Preview: ${selectedType.label} (${selectedTheme.label})`);
        
        await soundManager.previewSoundWithTheme(selectedType.value as any, selectedTheme.value as any);
        
        console.log(`✅ Preview executado: ${selectedType.value} (${selectedTheme.value})`);
      } catch (error) {
        console.error('❌ Erro no preview de som:', error);
        vscode.window.showErrorMessage('Erro no preview de som');
      }
    });
    
    // Comando de teste para sons reais com Web Audio API
    const testRealAudioCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testRealAudio', async () => {
      try {
        console.log('🎵 Testando reprodução real de áudio...');
        
        const choice = await vscode.window.showInformationMessage(
          '🎵 Testar sons reais com Web Audio API? (Isso abrirá um painel oculto para reproduzir sons)',
          'Sim, testar', 'Cancelar'
        );
        
        if (choice !== 'Sim, testar') {
          return;
        }
        
        vscode.window.showInformationMessage('🎵 Iniciando teste de sons reais...');
        
        // Testar sequência de sons
        const soundTypes = ['focus_start', 'focus_complete', 'notification', 'success'];
        const theme = 'classic';
        
        for (let i = 0; i < soundTypes.length; i++) {
          const soundType = soundTypes[i];
          vscode.window.showInformationMessage(`🎵 Reproduzindo: ${soundType} (${i + 1}/${soundTypes.length})`);
          
          try {
            await soundManager.previewSoundWithTheme(soundType as any, theme as any);
            console.log(`✅ Som reproduzido: ${soundType}`);
          } catch (error) {
            console.error(`❌ Erro no som ${soundType}:`, error);
          }
          
          // Pausa entre sons
          if (i < soundTypes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        
        vscode.window.showInformationMessage('✅ Teste de sons reais concluído! Você ouviu algum som?');
        console.log('✅ Teste de sons reais concluído!');
      } catch (error) {
        console.error('❌ Erro ao testar sons reais:', error);
        vscode.window.showErrorMessage('Erro ao testar sons reais');
      }
    });
    
    // Comando de teste para beeps do sistema (método mais direto)
    const testSystemBeepsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testSystemBeeps', async () => {
      try {
        console.log('🔔 Testando beeps do sistema...');
        
        const choice = await vscode.window.showInformationMessage(
          '🔔 Testar beeps reais do sistema operacional? Você deve ouvir uma sequência de sons.',
          'Sim, testar beeps', 'Cancelar'
        );
        
        if (choice !== 'Sim, testar beeps') {
          return;
        }
        
        vscode.window.showInformationMessage('🔔 Testando 1 beep...');
        await soundManager.testSpecialSounds();
        
        vscode.window.showInformationMessage('✅ Teste de beeps concluído! Você ouviu os beeps?');
        console.log('✅ Teste de beeps do sistema concluído!');
      } catch (error) {
        console.error('❌ Erro ao testar beeps do sistema:', error);
        vscode.window.showErrorMessage('Erro ao testar beeps do sistema');
      }
    });
    
    // Comando de teste para notificações desktop
    const testDesktopNotificationsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testDesktopNotifications', async () => {
      try {
        console.log('🔔 Testando notificações desktop...');
        
        const choice = await vscode.window.showInformationMessage(
          '🔔 Testar sistema completo de notificações desktop?',
          'Sim, testar', 'Cancelar'
        );
        
        if (choice !== 'Sim, testar') {
          return;
        }
        
        vscode.window.showInformationMessage('🔔 Iniciando teste de notificações desktop...');
        
        await desktopNotificationManager.testNotificationSystem();
        
        vscode.window.showInformationMessage('✅ Teste de notificações desktop concluído!');
        console.log('✅ Teste de notificações desktop concluído com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao testar notificações desktop:', error);
        vscode.window.showErrorMessage('Erro ao testar notificações desktop');
      }
    });
    
    // Comando de teste específico para notificações do Pomodoro
    const testPomodoroNotificationsCommand = CommandManager.safeRegisterCommand('my-time-trace-vscode.testPomodoroNotifications', async () => {
      try {
        console.log('🍅 Testando notificações do Pomodoro...');
        
        const notificationTypes = [
          { label: '🎯 Foco Completo (45 min)', action: () => desktopNotificationManager.showFocusCompleteNotification(45) },
          { label: '☕ Início da Pausa (5 min)', action: () => desktopNotificationManager.showBreakStartNotification(5) },
          { label: '⚡ Pausa Terminada', action: () => desktopNotificationManager.showBreakCompleteNotification() },
          { label: '🎉 Pomodoro Completo (4 ciclos)', action: () => desktopNotificationManager.showPomodoroCompleteNotification(4) }
        ];
        
        const selectedType = await vscode.window.showQuickPick(notificationTypes, {
          placeHolder: 'Selecione o tipo de notificação do Pomodoro para testar'
        });
        
        if (!selectedType) {
          return;
        }
        
        vscode.window.showInformationMessage(`🔔 Testando: ${selectedType.label}`);
        
        await selectedType.action();
        
        console.log(`✅ Notificação testada: ${selectedType.label}`);
      } catch (error) {
        console.error('❌ Erro ao testar notificações do Pomodoro:', error);
        vscode.window.showErrorMessage('Erro ao testar notificações do Pomodoro');
      }
    });
    
    commands.push(startBreakCommand);
    commands.push(testModalCommand);
    commands.push(testFocusModalCommand);
    commands.push(testPomodoroIntegrationCommand);
    commands.push(testRealPomodoroCommand);
    commands.push(testPomodoroSettingsCommand);
    commands.push(testPomodoroAutoNotificationsCommand);
    commands.push(testSoundSystemCommand);
    commands.push(testSyntheticSoundsCommand);
    commands.push(testSpecialSoundsCommand);
    commands.push(testWavSoundsCommand);
    commands.push(testVisualEffectsCommand);
    commands.push(previewSoundCommand);
    commands.push(testRealAudioCommand);
    commands.push(testSystemBeepsCommand);
    commands.push(testDesktopNotificationsCommand);
    commands.push(testPomodoroNotificationsCommand);

    // Registra os eventos para monitoramento
    const eventEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
      myTimeTrace.onActiveEditorChange(editor);
      // Notificar Pomodoro sobre atividade
      pomodoroManager.onUserActivity();
    });

    const eventTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
      myTimeTrace.onTextDocumentChange(event);
      // Notificar Pomodoro sobre atividade
      pomodoroManager.onUserActivity();
    });

    const eventWindowStateChange = vscode.window.onDidChangeWindowState((windowState) => {
      myTimeTrace.onWindowStateChange(windowState);
      // Notificar Pomodoro sobre atividade se janela estiver focada
      if (windowState.focused) {
        pomodoroManager.onUserActivity();
      }
    });

    // Adiciona todos os subscriptions ao contexto
    context.subscriptions.push(...commands);
    context.subscriptions.push(eventEditorChange);
    context.subscriptions.push(eventTextChange);
    context.subscriptions.push(eventWindowStateChange);

    // Adiciona handlers de limpeza
    context.subscriptions.push({
      dispose: () => {
        myTimeTrace.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        statusBarManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        pomodoroManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        modalManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        soundManager.dispose();
      },
    });

    context.subscriptions.push({
      dispose: () => {
        desktopNotificationManager.dispose();
      },
    });

    // Auto-iniciar se configurado
    const userConfig = getConfig();
    if (userConfig.autoStart) {
      setTimeout(() => {
        if (!myTimeTrace.isCurrentlyTracking()) {
          vscode.commands.executeCommand("my-time-trace-vscode.startTracking");
        }
      }, 100);
    }

  } catch (error) {
    console.error("Falha ao inicializar a extensão:", error);
    vscode.window.showErrorMessage(
      localize('extension.initializationFailed', 'Time Tracking: Failed to initialize the extension.')
    );
  }
}

// Desativação da extensão
export function deactivate() {
  console.log("=======================================");
  console.log(localize('extension.deactivated', 'Extension "my-time-trace-vscode" deactivated!'));
  console.log("Data/Hora: " + new Date().toISOString());
  console.log("=======================================");

  // Limpa os recursos
  if (myTimeTrace) {
    myTimeTrace.dispose();
  }

  if (statusBarManager) {
    statusBarManager.dispose();
  }

  if (dbManager) {
    dbManager.close().catch((err) => {
      console.error("Erro ao fechar banco de dados:", err);
    });
  }

  // Limpa a referência ao contexto global
  globalContext = null;
}
