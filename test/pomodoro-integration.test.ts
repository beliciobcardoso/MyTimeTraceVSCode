import { PomodoroManager, PomodoroState } from '../src/modules/pomodoro';
import { DatabaseManager } from '../src/modules/database';
import { StatusBarManager } from '../src/modules/statusBar';

/**
 * Teste básico de integração do PomodoroManager
 * Para usar: execute este arquivo diretamente no VS Code
 */
async function testPomodoroManagerIntegration() {
  console.log('🧪 Iniciando teste básico do PomodoroManager...');
  
  try {
    // Setup básico (mockado para teste)
    const dbManager = new DatabaseManager();
    const statusBarManager = new StatusBarManager();
    
    // Inicializar banco em memória para teste
    await dbManager.initialize(':memory:');
    
    // Criar instância do Pomodoro Manager
    const pomodoroManager = new PomodoroManager(dbManager, statusBarManager);
    
    // Configurar eventos para monitorar
    pomodoroManager.setEvents({
      onStateChange: (state) => console.log(`📊 Estado mudou para: ${state}`),
      onTimeUpdate: (remainingSeconds) => {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        console.log(`⏰ Tempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      },
      onFocusComplete: () => console.log('✅ Sessão de foco completada!'),
      onBreakComplete: () => console.log('✅ Sessão de pausa completada!'),
      onSessionComplete: (session) => console.log(`💾 Sessão salva:`, session)
    });
    
    // Inicializar Pomodoro Manager
    await pomodoroManager.initialize();
    console.log('✅ PomodoroManager inicializado');
    
    // Verificar configuração padrão
    const config = pomodoroManager.getConfig();
    console.log('📋 Configuração carregada:', config);
    
    // Testar estado inicial
    console.log(`🎯 Estado inicial: ${pomodoroManager.getCurrentState()}`);
    console.log(`🔄 Ativo: ${pomodoroManager.isActive()}`);
    
    // Simular atividade do usuário
    console.log('👤 Simulando atividade do usuário...');
    pomodoroManager.onUserActivity();
    
    // Aguardar um pouco para ver se auto-start funciona
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar se sessão foi iniciada (se auto-start estiver ativo)
    console.log(`🎯 Estado após atividade: ${pomodoroManager.getCurrentState()}`);
    
    // Iniciar sessão manualmente se não iniciou automaticamente
    if (!pomodoroManager.isActive()) {
      console.log('🚀 Iniciando sessão de foco manualmente...');
      await pomodoroManager.startFocusSession();
    }
    
    // Verificar estado após iniciar
    console.log(`🎯 Estado ativo: ${pomodoroManager.getCurrentState()}`);
    console.log(`⏱️ Tempo restante: ${pomodoroManager.getRemainingTime()} segundos`);
    
    // Testar pausa
    console.log('⏸️ Testando pausa...');
    await pomodoroManager.pauseSession();
    console.log(`🎯 Estado após pausa: ${pomodoroManager.getCurrentState()}`);
    
    // Testar resume
    console.log('▶️ Testando resume...');
    await pomodoroManager.resumeSession();
    console.log(`🎯 Estado após resume: ${pomodoroManager.getCurrentState()}`);
    
    // Testar extensão de tempo
    console.log('⏰ Testando extensão de tempo...');
    await pomodoroManager.extendFocus(2);
    console.log(`⏱️ Tempo após extensão: ${pomodoroManager.getRemainingTime()} segundos`);
    
    // Testar parada da sessão
    console.log('⏹️ Testando parada da sessão...');
    await pomodoroManager.stopSession();
    console.log(`🎯 Estado após parar: ${pomodoroManager.getCurrentState()}`);
    
    // Testar sessão de pausa
    console.log('☕ Testando sessão de pausa...');
    await pomodoroManager.startBreakSession('short');
    console.log(`🎯 Estado da pausa: ${pomodoroManager.getCurrentState()}`);
    console.log(`⏱️ Tempo da pausa: ${pomodoroManager.getRemainingTime()} segundos`);
    
    // Cleanup
    pomodoroManager.dispose();
    console.log('🧹 Cleanup concluído');
    
    console.log('✅ Teste básico do PomodoroManager concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se arquivo for executado diretamente
if (require.main === module) {
  testPomodoroManagerIntegration();
}

export { testPomodoroManagerIntegration };
