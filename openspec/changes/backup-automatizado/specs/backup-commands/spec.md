## ADDED Requirements

### Requirement: Registro separado de comandos de backup
O sistema SHALL implementar `BackupCommands` como classe com método estático `registerBackupCommands(context, backupManager): vscode.Disposable[]`. Os comandos SHALL ser registrados via `CommandManager.safeRegisterCommand()` de `commands.ts`. Os retornos SHALL ser adicionados a `context.subscriptions` em `extension.ts`.

#### Scenario: Extensão ativada
- **WHEN** `extension.ts` executa `activate()`
- **THEN** todos os comandos de backup aparecem na paleta de comandos (`Ctrl+Shift+P`)

### Requirement: Comando backupNow com progresso
O comando `MyTimeTrace: Fazer Backup Agora` (`my-time-trace-vscode.backupNow`) SHALL usar `vscode.window.withProgress({ location: ProgressLocation.Notification, title: 'MyTimeTrace', cancellable: false })` para exibir indicador de progresso via notificação durante a execução.

#### Scenario: Backup manual via paleta
- **WHEN** o usuário executa `MyTimeTrace: Fazer Backup Agora` via paleta
- **THEN** notificação de progresso é exibida durante o backup e removida ao concluir

### Requirement: Comando configureBackup
O comando `MyTimeTrace: Configurar Backup` (`my-time-trace-vscode.configureBackup`) SHALL abrir o wizard de configuração. Disponível na Fase 1.

#### Scenario: Comando de configuração
- **WHEN** o usuário executa `MyTimeTrace: Configurar Backup`
- **THEN** o wizard de 4 passos é iniciado

### Requirement: Comando manageBackups
O comando `MyTimeTrace: Gerenciar Backups` (`my-time-trace-vscode.manageBackups`) SHALL abrir o painel WebView via `BackupPanel.createOrShow()`. Disponível na Fase 1B.

#### Scenario: Painel aberto via paleta
- **WHEN** o usuário executa `MyTimeTrace: Gerenciar Backups`
- **THEN** o painel `BackupPanel` é aberto ou revelado se já existir

### Requirement: Comando openBackupFolder
O comando `MyTimeTrace: Abrir Pasta de Backup` (`my-time-trace-vscode.openBackupFolder`) SHALL abrir a pasta de destino configurada via `vscode.env.openExternal(vscode.Uri.file(destPath))`. Se `destinationPath` não estiver configurado, SHALL exibir mensagem orientativa.

#### Scenario: Pasta de backup aberta
- **WHEN** o usuário executa `MyTimeTrace: Abrir Pasta de Backup` com pasta configurada
- **THEN** o explorador de arquivos do sistema abre a pasta de destino

### Requirement: Comando editBackupSettings
O comando `MyTimeTrace: Editar Configurações de Backup` (`my-time-trace-vscode.editBackupSettings`) SHALL executar `vscode.commands.executeCommand('workbench.action.openSettings', 'myTimeTraceVSCode.backup')`.

#### Scenario: Configurações abertas filtradas
- **WHEN** o usuário executa `MyTimeTrace: Editar Configurações de Backup`
- **THEN** a UI de configurações do VS Code abre já filtrada para `myTimeTraceVSCode.backup`

### Requirement: Comandos pausar/retomar (Fase 2)
Os comandos `MyTimeTrace: Pausar Backup Automático` (`my-time-trace-vscode.pauseBackup`) e `MyTimeTrace: Retomar Backup Automático` (`my-time-trace-vscode.resumeBackup`) SHALL ser registrados na Fase 2. Pausar SHALL equivaler a `backup.enabled = false`; retomar SHALL equivaler a `backup.enabled = true`.

#### Scenario: Pausa do agendamento
- **WHEN** o usuário executa `MyTimeTrace: Pausar Backup Automático`
- **THEN** `backup.enabled` é definido como `false` no `settings.json` e o agendador é cancelado

### Requirement: Declaração em package.json
Todos os comandos de backup SHALL ser declarados em `contributes.commands` no `package.json` com `title` e `command` corretos, usando o prefixo `my-time-trace-vscode.*` já adotado pelo projeto.

#### Scenario: Paleta de comandos exibe todos os comandos
- **WHEN** o usuário abre a paleta e digita "MyTimeTrace"
- **THEN** todos os comandos de backup aparecem na lista com títulos descritivos
