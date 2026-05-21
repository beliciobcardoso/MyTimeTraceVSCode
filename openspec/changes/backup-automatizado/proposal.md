## Why

Usuários dependem de rotinas manuais para proteger dados locais, aumentando o risco de perda por falha do sistema, corrupção do banco ou troca de máquina. A extensão é open source e parte dos usuários não utiliza sincronização em nuvem, tornando o backup local a única salvaguarda disponível.

## What Changes

- Novo sistema de backup local automático, completamente independente do `SyncManager` existente
- Wizard guiado para configuração inicial (pasta de destino, intervalo, retenção máxima)
- Cópia segura do banco via `VACUUM INTO` com verificação de integridade pós-backup (`PRAGMA quick_check`)
- Política de retenção automática com remoção do backup mais antigo ao atingir o limite
- Backup manual via comando `MyTimeTrace: Fazer Backup Agora`
- Painel WebView dedicado para visualizar, excluir (individual e em lote) e gerenciar backups
- Persistência de estado do backup em `sync_metadata` com prefixo `backup.*`
- Log em Output Channel dedicado (`View → Output → MyTimeTrace`)
- Agendamento automático com `setTimeout` + `setInterval` (Fase 2)
- Retry automático em falhas via `BackupRetryManager` (Fase 2)
- Backup offsite opcional no GitHub (Fase 4)

## Capabilities

### New Capabilities

- `backup-core`: Lógica central de backup — `VACUUM INTO`, verificação de integridade, política de retenção, persistência em `sync_metadata`, Output Channel de log
- `backup-wizard`: Wizard de configuração inicial e reconfiguração — seleção de pasta, intervalo, retenção máxima, confirmação e execução do primeiro backup
- `backup-panel`: Painel WebView stateful com tabela de backups, exclusão individual e em lote, ações globais (backup agora, configurar, abrir pasta) e bloco de status
- `backup-commands`: Registro dos comandos de backup na paleta do VS Code (`backupNow`, `configureBackup`, `manageBackups`, `openBackupFolder`, `editBackupSettings`)
- `backup-scheduler`: Agendamento automático com `setTimeout` + `setInterval`, verificação de backup perdido no startup, `onDidChangeConfiguration` e recuperação após sleep/wake (Fase 2)
- `backup-retry`: `BackupRetryManager` com 3 tentativas e delay de 30s, interface idêntica ao `SyncRetryManager` (Fase 2)

### Modified Capabilities

- `database`: Adição de `private dbPath: string` e método `getDbPath(): string` ao `DatabaseManager`

## Impact

- **Novos arquivos**: `src/modules/backupManager.ts`, `src/modules/backupCommands.ts`, `src/ui/backupPanel.ts`, `src/modules/backupRetryManager.ts` (Fase 2)
- **Arquivos modificados**: `src/extension.ts`, `src/config/constants.ts`, `src/modules/database.ts`, `src/modules/index.ts`, `src/ui/index.ts`, `package.json`
- **Dependências**: `sqlite3` (já presente), `vscode.workspace.fs` para todas as operações de filesystem exceto `statfs` e o path do `VACUUM INTO`
- **Settings**: 6 novas configurações `myTimeTraceVSCode.backup.*` com `scope: machine` obrigatório
- **Sem impacto**: `SyncManager`, engine de tracking, status bar — sistemas completamente independentes
