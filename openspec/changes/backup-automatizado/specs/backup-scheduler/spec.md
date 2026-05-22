## ADDED Requirements

### Requirement: Delay inicial de 2 minutos no startup
O `BackupManager.initialize()` SHALL aguardar `BACKUP_INITIAL_DELAY` (2 minutos, definido em `constants.ts`) antes de executar qualquer verificação ou backup, usando `setTimeout`. Isso evita sobrecarga no startup enquanto `DatabaseManager`, `SyncManager` e o engine de tracking ainda estão inicializando.

#### Scenario: Startup do VS Code
- **WHEN** `extension.ts` ativa e instancia `BackupManager`
- **THEN** nenhuma operação de backup é executada nos primeiros 2 minutos

### Requirement: Lógica de inicialização com verificação de backup perdido
Após o delay inicial, o `BackupManager` SHALL executar a lógica de inicialização: (1) verificar `backup.enabled`, (2) verificar `destinationPath`, (3) verificar timestamp do último backup em `sync_metadata`. Se o delta `(agora - lastTimestamp)` exceder `intervalHours` ou for negativo (clock skew), ou se não houver backup anterior, SHALL executar backup imediatamente.

#### Scenario: VS Code ficou fechado durante horário de backup
- **WHEN** o VS Code abre e o último timestamp em `sync_metadata` é de mais de `intervalHours` horas atrás
- **THEN** backup é executado imediatamente após o delay inicial

#### Scenario: Clock skew detectado
- **WHEN** `(agora - lastTimestamp) < 0`
- **THEN** aviso é registrado no Output Channel com prefixo `[BackupManager] Clock skew detectado` e backup é executado imediatamente

#### Scenario: backup.enabled = false
- **WHEN** `backup.enabled` é `false` ao iniciar a verificação
- **THEN** nenhum backup é executado e nenhum agendador é iniciado

#### Scenario: destinationPath não configurado
- **WHEN** `backup.enabled` é `true` mas `destinationPath` está vazio
- **THEN** o wizard de configuração é iniciado; ao concluir, a lógica de inicialização é reiniciada

### Requirement: Agendamento com setTimeout + setInterval
O agendador SHALL usar `setTimeout` para o próximo backup calculado e `setInterval` para ciclos subsequentes. O `performBackup()` dentro do `setTimeout` SHALL ser aguardado com `await` antes de iniciar o `setInterval`.

#### Scenario: Próximo backup agendado corretamente
- **WHEN** o último backup foi há 2h e o intervalo é 4h
- **THEN** o próximo backup é agendado via `setTimeout` para daqui 2h, não após 4h completas

### Requirement: Reagendamento ao mudar configuração
Ao detectar mudança em `myTimeTraceVSCode.backup.*` via `onDidChangeConfiguration`, o `BackupManager` SHALL cancelar timers ativos via `clearTimeout`/`clearInterval` e chamar `scheduleNext()` com o novo intervalo. Debounce de 500ms SHALL ser aplicado para evitar recriação de timers em cascata durante edição do `settings.json`.

#### Scenario: Usuário altera intervalHours
- **WHEN** o usuário salva `settings.json` com novo valor de `backup.intervalHours`
- **THEN** o agendador é recriado com o novo intervalo (com debounce de 500ms)

### Requirement: Sanitização de intervalHours inválido
O sistema SHALL sanitizar `backup.intervalHours` ao ler a configuração: se o valor não for finito ou for menor que 1, SHALL usar `BACKUP_DEFAULT_INTERVAL_HOURS` e registrar aviso no Output Channel.

#### Scenario: intervalHours = 0 no settings.json
- **WHEN** `backup.intervalHours` é `0` no `settings.json` (editado manualmente)
- **THEN** o sistema usa `BACKUP_DEFAULT_INTERVAL_HOURS` (4h) e registra aviso no Output Channel

### Requirement: Alerta de gap prolongado
Após backup executado por causa de gap, se o delta for maior que `BACKUP_ALERT_GAP_DAYS` (7 dias), o sistema SHALL exibir `showWarningMessage` informando quantos dias faz desde o último backup. O alerta SHALL ser exibido apenas uma vez por gap detectado.

#### Scenario: VS Code fechado por 10 dias
- **WHEN** o VS Code abre após 10 dias sem backup
- **THEN** o backup é executado imediatamente e `showWarningMessage` informa "o último backup foi há 10 dias"

### Requirement: Recuperação após sleep/wake
O sistema SHALL registrar `vscode.window.onDidChangeWindowState` e ao recuperar foco (`state.focused = true`) SHALL verificar se houve backup perdido via `checkMissedBackup()` — a mesma lógica da inicialização.

#### Scenario: Laptop acorda após sleep
- **WHEN** o laptop sai do modo sleep com VS Code aberto e o intervalo de backup passou durante o sleep
- **THEN** backup é executado ao recuperar foco

### Requirement: Registro do timer em context.subscriptions
O `BackupManager` SHALL ser registrado em `context.subscriptions.push({ dispose: () => backupManager.dispose() })` para cleanup automático. O `dispose()` SHALL cancelar timers ativos.

#### Scenario: VS Code encerra extensão
- **WHEN** a extensão é desativada
- **THEN** `backupManager.dispose()` é chamado automaticamente via `context.subscriptions`, cancelando todos os timers
