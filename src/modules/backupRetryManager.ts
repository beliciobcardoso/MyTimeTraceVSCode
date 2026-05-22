import * as vscode from 'vscode';
import { BACKUP_MAX_RETRIES, BACKUP_RETRY_DELAY_MS } from '../config/constants';

export class BackupRetryManager {
  private readonly maxRetries = BACKUP_MAX_RETRIES;
  private readonly retryDelayMs = BACKUP_RETRY_DELAY_MS;

  /** No-op: configuração de backup é obtida via settings, não via servidor */
  updateConfig(_maxRetries: number, _retryDelayMs: number): void {
    console.warn('[BackupRetryManager] updateConfig é no-op — configuração via VS Code settings');
  }

  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[BackupRetryManager] Tentativa ${attempt}/${this.maxRetries} falhou: ${lastError.message}`);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs);
        }
      }
    }

    this.notifyFailure(lastError);
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyFailure(error: Error | null): void {
    const message = error?.message ?? 'Erro desconhecido';
    vscode.window.showErrorMessage(
      `MyTimeTrace Backup: Falha após ${this.maxRetries} tentativas. ${message}`,
      'Tentar Novamente',
    ).then(action => {
      if (action === 'Tentar Novamente') {
        vscode.commands.executeCommand('my-time-trace-vscode.backupNow');
      }
    });
  }
}
