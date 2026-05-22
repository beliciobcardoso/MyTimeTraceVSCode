## ADDED Requirements

### Requirement: BackupRetryManager com interface idêntica ao SyncRetryManager
O sistema SHALL criar `BackupRetryManager` em `src/modules/backupRetryManager.ts` com os mesmos métodos públicos `execute()` e `updateConfig()` do `SyncRetryManager`. `updateConfig()` SHALL ser no-op intencional (valores fixos por constantes) e SHALL registrar aviso se chamado: `console.warn('BackupRetryManager: updateConfig() chamado — valores fixos, chamada ignorada.')`.

#### Scenario: updateConfig chamado indevidamente
- **WHEN** `backupRetryManager.updateConfig()` é chamado
- **THEN** aviso é registrado no console e nenhum valor é alterado

### Requirement: Valores fixos de retry
O `BackupRetryManager` SHALL usar `BACKUP_MAX_RETRIES` (3) e `BACKUP_RETRY_DELAY_MS` (30000ms) de `constants.ts`. Esses valores não SHALL ser configuráveis pelo usuário nem pelo servidor.

#### Scenario: Backup falha 3 vezes consecutivas
- **WHEN** `performBackup()` falha nas 3 tentativas
- **THEN** `notifyFailure()` é chamado, `showErrorMessage` é exibido com opção "Tentar Novamente" e `backup.lastError` é persistido em `sync_metadata`

### Requirement: Opção "Tentar Novamente" após esgotar tentativas
Após esgotar as tentativas, `notifyFailure()` SHALL exibir `showErrorMessage` com opção "Tentar Novamente" que executa `vscode.commands.executeCommand('my-time-trace-vscode.backupNow')`.

#### Scenario: Usuário clica em "Tentar Novamente"
- **WHEN** o usuário clica em "Tentar Novamente" na mensagem de erro final
- **THEN** o comando `backupNow` é executado iniciando novo ciclo de retry

### Requirement: notifyFailure é método privado
O método `notifyFailure()` SHALL ser `private` em ambos `SyncRetryManager` e `BackupRetryManager` — chamado internamente por `execute()` após esgotar as tentativas.

#### Scenario: Tentativas esgotadas
- **WHEN** `execute()` esgota as 3 tentativas com delay de 30s entre elas
- **THEN** `notifyFailure()` privado é chamado para exibir o erro final ao usuário
