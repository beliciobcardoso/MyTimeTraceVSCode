import * as vscode from 'vscode';

/**
 * 🔄 SyncRetryManager
 * 
 * Gerencia tentativas automáticas de retry em caso de falha de sincronização.
 * 
 * **Características:**
 * - Retry automático com delay configurável
 * - Máximo de tentativas configurável via servidor
 * - Notificação ao usuário apenas após falha total
 * - Configurações dinâmicas obtidas do backend
 * 
 * **Fluxo:**
 * 1. Tenta executar operação de sincronização
 * 2. Se falhar → aguarda delay e tenta novamente
 * 3. Repete até maxRetries
 * 4. Se todas falharem → notifica usuário
 * 
 * @see {@link https://backend.mytimetrace.com/api/sync/config}
 */
export class SyncRetryManager {
  private maxRetries: number = 5;
  private retryDelayMs: number = 10000; // 10 segundos
  
  /**
   * Atualiza configurações de retry (obtidas do backend)
   * 
   * @param maxRetries - Número máximo de tentativas (1-10)
   * @param retryDelayMs - Delay entre tentativas em ms (1000-60000)
   * 
   * @example
   * ```typescript
   * retryManager.updateConfig(3, 5000); // 3 tentativas, 5s delay
   * ```
   */
  updateConfig(maxRetries: number, retryDelayMs: number): void {
    // Valida limites
    this.maxRetries = Math.max(1, Math.min(10, maxRetries));
    this.retryDelayMs = Math.max(1000, Math.min(60000, retryDelayMs));
    
    console.log(`🔄 Retry config atualizada: ${this.maxRetries} tentativas, ${this.retryDelayMs}ms delay`);
  }
  
  /**
   * Executa operação com retry automático
   * 
   * **Comportamento:**
   * - Tentativa 1: imediata
   * - Tentativa 2-N: com delay entre cada
   * - Se todas falharem: notifica usuário e retorna null
   * 
   * @param operation - Função async a ser executada com retry
   * @returns Resultado da operação ou null se todas tentativas falharem
   * 
   * @example
   * ```typescript
   * const result = await retryManager.execute(async () => {
   *   const response = await fetch('/api/sync/push', { ... });
   *   if (!response.ok) throw new Error('Push failed');
   *   return await response.json();
   * });
   * 
   * if (result) {
   *   console.log('Sync OK:', result);
   * } else {
   *   console.log('Sync falhou após todos os retries');
   * }
   * ```
   */
  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentativa ${attempt}/${this.maxRetries}...`);
        
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`✅ Sucesso na tentativa ${attempt}!`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Tentativa ${attempt}/${this.maxRetries} falhou:`, errorMessage);
        
        // Se não for a última tentativa, aguarda delay
        if (attempt < this.maxRetries) {
          console.log(`⏳ Aguardando ${this.retryDelayMs}ms antes da próxima tentativa...`);
          await this.delay(this.retryDelayMs);
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    this.notifyFailure(lastError);
    return null;
  }
  
  /**
   * Delay assíncrono (helper)
   * 
   * @param ms - Milissegundos de delay
   * @returns Promise que resolve após o delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Notifica usuário sobre falha total de sincronização
   * 
   * **Comportamento:**
   * - Mostra notificação warning (não erro crítico)
   * - Informa número de tentativas realizadas
   * - Sugere verificar conexão com backend
   * 
   * @param error - Último erro ocorrido
   */
  private notifyFailure(error: Error | null): void {
    const message = error?.message || 'Erro desconhecido';
    
    vscode.window.showWarningMessage(
      `⚠️ Não foi possível sincronizar após ${this.maxRetries} tentativas.\n\n` +
      `Verifique sua conexão e tente novamente mais tarde.`,
      'Tentar Novamente',
      'Ver Detalhes'
    ).then(action => {
      if (action === 'Tentar Novamente') {
        vscode.commands.executeCommand('my-time-trace-vscode.syncNow');
      } else if (action === 'Ver Detalhes') {
        vscode.window.showErrorMessage(
          `Detalhes do erro:\n\n${message.endsWith("}")}`, // Limita a 500 chars
          'Copiar Erro'
        ).then(copy => {
          if (copy === 'Copiar Erro') {
            vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('Erro copiado para área de transferência');
          }
        });
      }
    });
    
    console.error(`❌ Sync falhou completamente após ${this.maxRetries} tentativas:`, message);
  }
  
  /**
   * Obtém configurações atuais de retry
   * 
   * @returns Objeto com maxRetries e retryDelayMs
   * 
   * @example
   * ```typescript
   * const config = retryManager.getConfig();
   * console.log(`Retry: ${config.maxRetries}x, delay: ${config.retryDelayMs}ms`);
   * ```
   */
  getConfig(): { maxRetries: number; retryDelayMs: number } {
    return {
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs
    };
  }
}
