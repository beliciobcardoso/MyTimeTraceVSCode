## 1. Pré-requisitos e Fundação

- [ ] 1.1 Verificar `PRAGMA journal_mode` no `DatabaseManager` na inicialização e documentar resultado em comentário no código
- [ ] 1.2 Adicionar `private dbPath: string = ''` ao `DatabaseManager` e atribuir em `initialize()` antes de abrir o banco
- [ ] 1.3 Adicionar método `getDbPath(): string` ao `DatabaseManager`
- [ ] 1.4 Adicionar constantes ao `src/config/constants.ts`: `BACKUP_MIN_RETENTION`, `BACKUP_DEFAULT_INTERVAL_HOURS`, `BACKUP_MAX_RETRIES`, `BACKUP_RETRY_DELAY_MS`, `BACKUP_INITIAL_DELAY`, `BACKUP_ALERT_GAP_DAYS`
- [ ] 1.5 Adicionar 6 settings `myTimeTraceVSCode.backup.*` em `contributes.configuration` do `package.json` com `scope: machine`, tipos, mínimos e `markdownDescription`

## 2. Fase 1A — BackupManager Core

- [ ] 2.1 Criar `src/modules/backupManager.ts` com construtor recebendo `(databaseManager, myTimeTrace, storagePath, outputChannel)`
- [ ] 2.2 Implementar validação de path de destino (aspas simples, absoluto, null byte)
- [ ] 2.3 Implementar `performBackup()` privado com fluxo completo: `quick_check` na origem → limpeza de `.tmp` órfãos → verificação de espaço (`statfs`) → criação de pasta de destino → resolução de colisão de nome → `VACUUM INTO` para `.tmp` → rename atômico `{ overwrite: false }` → `validateBackupFile()` → persistência em `sync_metadata` → política de retenção → `BackupPanel.currentPanel?.refresh()`
- [ ] 2.4 Implementar `validateBackupFile(filePath)` com `sqlite3.Database` em modo somente leitura, `PRAGMA quick_check` e `close()` via callback antes de qualquer operação no arquivo
- [ ] 2.5 Implementar política de retenção: listar arquivos pelo padrão `time_tracker_YYYY-MM-DD_HH-mm-ss[_N].sqlite`, ordenar por timestamp do nome em UTC, remover mais antigos ao exceder `maxBackups` (mínimo 3)
- [ ] 2.6 Implementar flag `private isBackingUp = false` com mutex em `performBackup()`
- [ ] 2.7 Implementar `triggerManualBackup()` público que verifica mutex e chama `performBackup()`
- [ ] 2.8 Implementar `handleBackupError(err)` privado: persistir `backup.lastError` e `backup.state = failed` em `sync_metadata`, exibir `showErrorMessage`, chamar `BackupPanel.currentPanel?.refresh()`
- [ ] 2.9 Implementar `getStatus()` retornando `{ state, isBacking, lastBackupAt, nextBackupAt, lastError, destinationPath }`
- [ ] 2.10 Implementar Output Channel via `outputChannel.appendLine('[BackupManager] ...')` em todas as operações relevantes
- [ ] 2.11 Implementar `dispose()` público que cancela timers ativos

## 3. Fase 1A — BackupCommands

- [ ] 3.1 Criar `src/modules/backupCommands.ts` com `BackupCommands.registerBackupCommands(context, backupManager): vscode.Disposable[]`
- [ ] 3.2 Registrar comando `backupNow` com `vscode.window.withProgress` (notificação de progresso)
- [ ] 3.3 Registrar comando `configureBackup` abrindo wizard
- [ ] 3.4 Registrar comando `openBackupFolder` via `vscode.env.openExternal`
- [ ] 3.5 Registrar comando `editBackupSettings` via `vscode.commands.executeCommand('workbench.action.openSettings', ...)`
- [ ] 3.6 Adicionar os 5 comandos da Fase 1 em `contributes.commands` do `package.json`

## 4. Fase 1A — Wizard de Configuração

- [ ] 4.1 Implementar wizard de 4 passos em `backupManager.ts` (ou arquivo separado `backupWizard.ts`)
- [ ] 4.2 Passo 1: `showOpenDialog` para pasta de destino com detecção de nuvem/rede e aviso via `showWarningMessage`
- [ ] 4.3 Passo 2: `showQuickPick` com opções `1h`, `4h`, `8h`, `12h`, `24h`, `Personalizado` + `showInputBox` se personalizado
- [ ] 4.4 Passo 3: `showInputBox` para retenção máxima com validação de mínimo 3
- [ ] 4.5 Passo 4: resumo e confirmação; ao confirmar, salvar no `settings.json` e chamar `triggerManualBackup()`
- [ ] 4.6 Garantir abort total ao `Esc` em qualquer passo (sem salvar configuração parcial)

## 5. Fase 1A — Integração no extension.ts

- [ ] 5.1 Criar `vscode.window.createOutputChannel('MyTimeTrace')` e registrar em `context.subscriptions`
- [ ] 5.2 Instanciar `BackupManager` com delay `BACKUP_INITIAL_DELAY` via `setTimeout` após `activate()`
- [ ] 5.3 Registrar `BackupManager` em `context.subscriptions.push({ dispose: () => backupManager.dispose() })` — não adicionar ao `deactivate()`
- [ ] 5.4 Registrar `BackupCommands` e adicionar disposables a `context.subscriptions`
- [ ] 5.5 Exportar `BackupManager` e `BackupCommands` em `src/modules/index.ts`

## 6. Fase 1A — Testes

- [ ] 6.1 Criar `src/test/backupManager.test.ts`
- [ ] 6.2 Teste: execução de backup bem-sucedida (arquivo criado, timestamp persistido)
- [ ] 6.3 Teste: política de retenção remove o mais antigo ao atingir limite
- [ ] 6.4 Teste: colisão de nome gera sufixo incremental `_1`, `_2`
- [ ] 6.5 Teste: pasta inacessível exibe erro e atualiza `backup.state`
- [ ] 6.6 Teste: sanitização de `intervalHours` inválido (0, -1, NaN)
- [ ] 6.7 Teste: mutex impede backup duplo simultâneo

## 7. Fase 1B — BackupPanel

- [ ] 7.1 Criar `src/ui/backupPanel.ts` com classe `BackupPanel` e padrão `createOrShow`
- [ ] 7.2 Criar `WebviewPanel` com `retainContextWhenHidden: true` e `enableScripts: true`
- [ ] 7.3 Implementar HTML da tabela de backups (checkbox, nome, data/hora, tamanho, botão `🗑`, badge `● atual` no mais recente)
- [ ] 7.4 Implementar bloco de status com badge colorido e campo "Próximo backup" com texto `"— (agendamento disponível na próxima versão)"`
- [ ] 7.5 Implementar botões de ação global: "Fazer Backup Agora" (desabilitado durante execução), "Configurar Backup", "Abrir Pasta", "Excluir Selecionados" (habilitado apenas com seleção)
- [ ] 7.6 Implementar `FileSystemWatcher` com `RelativePattern(Uri.file(destinationPath), '*.sqlite')` descartado em `onDidDispose`
- [ ] 7.7 Implementar protocolo de mensagens: extensão → WebView (`refreshBackups`, `backupStarted`, `backupFinished`) e WebView → extensão (`deleteBackup`, `deleteSelected`, `triggerBackup`, `openWizard`, `openFolder`)
- [ ] 7.8 Implementar exclusão individual com `showWarningMessage` de confirmação e aviso se remanescente < 3
- [ ] 7.9 Implementar exclusão em lote com checkbox "selecionar todos" e confirmação com contagem
- [ ] 7.10 Implementar estado vazio com mensagem orientativa quando pasta estiver vazia ou inacessível
- [ ] 7.11 Implementar rodapé com instrução de restauração manual e path do banco via `databaseManager.getDbPath()`
- [ ] 7.12 Registrar comando `manageBackups` em `BackupCommands` e em `package.json`
- [ ] 7.13 Exportar `BackupPanel` em `src/ui/index.ts`

## 8. Fase 1B — Testes do Painel

- [ ] 8.1 Criar `src/test/backupPanel.test.ts`
- [ ] 8.2 Teste: renderização da tabela com backups existentes
- [ ] 8.3 Teste: estado vazio com mensagem orientativa
- [ ] 8.4 Teste: confirmação antes de exclusão individual
- [ ] 8.5 Teste: atualização via `FileSystemWatcher` ao deletar arquivo externo

## 9. Fase 2 — Agendamento Automático

- [ ] 9.1 Implementar `scheduleNext(intervalMs)` em `backupManager.ts` com `setTimeout` + `setInterval` (await `performBackup()` antes de iniciar `setInterval`)
- [ ] 9.2 Implementar lógica de inicialização completa: verificar `backup.enabled` → `destinationPath` → timestamp em `sync_metadata` → executar ou agendar
- [ ] 9.3 Implementar `checkMissedBackup()` público reutilizado na inicialização e no `onDidChangeWindowState`
- [ ] 9.4 Implementar `onConfigChange()` com debounce de 500ms usando `clearTimeout` + `scheduleNext()` com novo intervalo
- [ ] 9.5 Implementar `pauseScheduler()` público: `clearTimeout`/`clearInterval`, persistir `backup.state = paused`
- [ ] 9.6 Registrar `onDidChangeConfiguration` em `extension.ts` via `context.subscriptions`
- [ ] 9.7 Registrar `onDidChangeWindowState` em `extension.ts` via `context.subscriptions`
- [ ] 9.8 Exibir alerta de gap prolongado (> 7 dias) após backup executado por gap
- [ ] 9.9 Adicionar `backup.nextScheduled` em `sync_metadata` e exibir no painel (campo "Próximo backup")
- [ ] 9.10 Registrar comandos `pauseBackup` e `resumeBackup` em `BackupCommands` e em `package.json`

## 10. Fase 2 — BackupRetryManager

- [ ] 10.1 Criar `src/modules/backupRetryManager.ts` com interface idêntica ao `SyncRetryManager`
- [ ] 10.2 Implementar `execute()` com 3 tentativas e delay de `BACKUP_RETRY_DELAY_MS` entre elas
- [ ] 10.3 Implementar `updateConfig()` como no-op com `console.warn`
- [ ] 10.4 Implementar `notifyFailure()` privado com `showErrorMessage` e opção "Tentar Novamente" via `vscode.commands.executeCommand('my-time-trace-vscode.backupNow')`
- [ ] 10.5 Integrar `BackupRetryManager` ao `BackupManager.performBackup()`

## 11. Fase 2 — Restauração de Backup

- [ ] 11.1 Implementar `BackupManager.restoreFromBackup(backupFilePath)` público com os 9 passos do PRD (confirmar → pauseTracking → pauseScheduler → getDbPath → close() → copy → initialize → startTracking → reloadWindow)
- [ ] 11.2 Adicionar coluna "Restaurar" na tabela do `BackupPanel`
- [ ] 11.3 Remover rodapé de instrução de restauração manual adicionado na Fase 1B

## 12. Fase 2 — Testes de Agendamento e Retry

- [ ] 12.1 Estender `backupManager.test.ts`: agendamento, backup perdido, pausa/retomada, reagendamento ao mudar intervalo
- [ ] 12.2 Criar `src/test/backupRetryManager.test.ts` seguindo `syncRetryManager.test.ts`

## 13. Finalização e Versionamento

- [ ] 13.1 Verificar que todas as settings `myTimeTraceVSCode.backup.*` aparecem corretamente na UI de configurações do VS Code
- [ ] 13.2 Verificar que todos os comandos de backup aparecem na paleta com títulos corretos
- [ ] 13.3 Verificar que `backup.*` chaves em `sync_metadata` não colidem com chaves do `SyncManager`
- [ ] 13.4 Executar build completo (`rtk tsc`) e corrigir erros de tipo
- [ ] 13.5 Executar suite de testes (`rtk cargo test` ou equivalente) e garantir que todos os testes passam
- [ ] 13.6 Atualizar versão da extensão no `package.json` (bump de patch ou minor conforme o escopo entregue)
- [ ] 13.7 Atualizar `CHANGELOG.md` com descrição das funcionalidades entregues nesta versão
