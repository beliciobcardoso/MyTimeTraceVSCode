## ADDED Requirements

### Requirement: Cópia segura via VACUUM INTO
O sistema SHALL copiar o banco `time_tracker.sqlite` usando `VACUUM INTO` executado via `db.run()` do pacote `sqlite3`. O path de destino SHALL ser validado para: ausência de aspas simples, ser absoluto e não conter null bytes. O path forward-slashes SHALL ser usado mesmo no Windows.

#### Scenario: Backup bem-sucedido
- **WHEN** `performBackup()` é chamado com banco acessível e pasta de destino válida
- **THEN** um arquivo `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite` é criado na pasta de destino, verificado via `PRAGMA quick_check` e a data/hora em UTC é persistida em `sync_metadata` como `backup.lastTimestamp`

#### Scenario: Path com aspas simples rejeitado
- **WHEN** `destinationPath` contém o caractere `'`
- **THEN** o backup é abortado com erro descritivo e nenhum arquivo é criado

### Requirement: Verificação de integridade na origem
O sistema SHALL executar `PRAGMA quick_check` no banco de origem antes de qualquer operação de backup. Se o resultado não for `ok`, o backup SHALL ser abortado com notificação ao usuário.

#### Scenario: Banco de origem corrompido
- **WHEN** `PRAGMA quick_check` no banco ativo retorna valor diferente de `ok`
- **THEN** o backup é cancelado, uma mensagem de erro descritiva é exibida via `showErrorMessage` e `backup.state` é persistido como `failed` em `sync_metadata`

### Requirement: Arquivo temporário com rename atômico
O sistema SHALL gravar o backup em um arquivo `.sqlite.tmp` e renomeá-lo para `.sqlite` somente após `VACUUM INTO` + `PRAGMA quick_check` concluírem com sucesso. O rename SHALL usar `vscode.workspace.fs.rename` com `{ overwrite: false }`.

#### Scenario: VS Code encerrado durante backup
- **WHEN** o VS Code é encerrado enquanto o `VACUUM INTO` está em andamento
- **THEN** apenas um arquivo `.sqlite.tmp` permanece na pasta de destino — nunca um `.sqlite` inválido

### Requirement: Limpeza de arquivos .tmp órfãos
O sistema SHALL remover todos os arquivos `*.sqlite.tmp` da pasta de destino no início de cada execução de `performBackup()`, antes de qualquer outra operação.

#### Scenario: Órfão presente na pasta
- **WHEN** a pasta de destino contém arquivos `*.sqlite.tmp` de backups anteriores interrompidos
- **THEN** esses arquivos são removidos silenciosamente antes do novo backup iniciar

### Requirement: Verificação de espaço em disco
O sistema SHALL verificar espaço disponível via `fs.promises.statfs` antes de iniciar o `VACUUM INTO`. A margem mínima SHALL ser 1.5× o tamanho atual do banco. Em versões do Node.js sem `statfs`, o sistema SHALL prosseguir sem a verificação.

#### Scenario: Espaço insuficiente
- **WHEN** o espaço disponível é menor que 1.5× o tamanho do banco
- **THEN** o backup é abortado com mensagem indicando espaço disponível e necessário em MB

### Requirement: Resolução de colisão de nome
O sistema SHALL detectar colisão de nome de arquivo (dois backups no mesmo segundo) e adicionar sufixo incremental `_1`, `_2` etc. O rename com `{ overwrite: false }` SHALL ser a última linha de defesa contra TOCTOU.

#### Scenario: Dois backups no mesmo segundo
- **WHEN** já existe `time_tracker_2026-05-21_14-30-00.sqlite` e novo backup é gerado no mesmo segundo
- **THEN** o novo arquivo é nomeado `time_tracker_2026-05-21_14-30-00_1.sqlite`

### Requirement: Verificação de integridade pós-backup
O sistema SHALL abrir o arquivo de backup gerado em modo somente leitura e executar `PRAGMA quick_check`. O `testDb.close()` SHALL ser aguardado via callback antes de qualquer operação no arquivo. Se a verificação falhar, o arquivo corrompido SHALL ser removido imediatamente.

#### Scenario: Backup corrompido detectado
- **WHEN** `PRAGMA quick_check` no arquivo de backup retorna resultado diferente de `ok`
- **THEN** o arquivo `.sqlite` é removido, erro é registrado no Output Channel e `backup.state` é atualizado para `failed`

### Requirement: Política de retenção automática
Após backup bem-sucedido, o sistema SHALL listar arquivos na pasta de destino cujo nome corresponda ao padrão `time_tracker_YYYY-MM-DD_HH-mm-ss[_N].sqlite`, ordená-los por timestamp extraído do nome (em UTC), e remover os mais antigos quando o total exceder `maxBackups`. O mínimo de backups retidos SHALL ser 3. Arquivos com nome fora do padrão SHALL ser ignorados pela política.

#### Scenario: Limite de retenção atingido
- **WHEN** a pasta de destino contém `maxBackups` arquivos válidos e um novo backup é concluído
- **THEN** o arquivo mais antigo (por timestamp do nome, em UTC) é removido e a remoção é registrada no Output Channel

#### Scenario: Arquivo externo não removido
- **WHEN** a pasta de destino contém arquivo com nome fora do padrão (ex: `backup_manual.sqlite`)
- **THEN** esse arquivo é listado no painel mas nunca removido pela política de retenção automática

### Requirement: Mutex de backup concorrente
O sistema SHALL manter flag `private isBackingUp = false` para evitar execuções simultâneas. Qualquer chamada a `performBackup()` com a flag ativa SHALL retornar sem executar.

#### Scenario: Backup automático com manual simultâneo
- **WHEN** backup automático está em andamento e `triggerManualBackup()` é chamado
- **THEN** o backup manual é ignorado silenciosamente e mensagem informativa é exibida ao usuário

### Requirement: Persistência de estado em sync_metadata
O sistema SHALL persistir as chaves `backup.lastTimestamp` (ISO 8601 UTC), `backup.state` (`active`|`paused`|`failed`) e `backup.lastError` em `sync_metadata` após cada operação de backup. As chaves SHALL usar prefixo `backup.` para não colidir com chaves do `SyncManager`.

#### Scenario: Reinício do VS Code após backup bem-sucedido
- **WHEN** o VS Code é reiniciado após backup concluído
- **THEN** `backup.lastTimestamp` persiste e é usado pela lógica de inicialização para calcular se o intervalo já foi ultrapassado

### Requirement: Log via Output Channel
O sistema SHALL registrar todas as operações de backup (início, conclusão, falha, retenção, limpeza de tmp) via `outputChannel.appendLine('[BackupManager] ...')`. O Output Channel SHALL ser `View → Output → MyTimeTrace`.

#### Scenario: Falha de backup registrada
- **WHEN** `VACUUM INTO` falha com erro
- **THEN** a mensagem de erro completa é registrada no Output Channel com prefixo `[BackupManager]`

### Requirement: Backup manual via triggerManualBackup
O sistema SHALL expor o método público `triggerManualBackup(): Promise<void>` que chama `performBackup()` internamente. `performBackup()` SHALL ser `private`.

#### Scenario: Backup manual acionado via comando
- **WHEN** `backupManager.triggerManualBackup()` é chamado
- **THEN** `performBackup()` é executado com mutex verificado e resultado notificado ao usuário

### Requirement: getStatus expõe estado atual
O `BackupManager` SHALL expor `getStatus()` retornando `{ state, isBacking, lastBackupAt, nextBackupAt, lastError, destinationPath }` para consumo pelo painel e pelos comandos.

#### Scenario: Painel consulta estado durante backup
- **WHEN** backup está em andamento e `getStatus()` é chamado
- **THEN** `isBacking: true` é retornado e o painel desabilita o botão "Fazer Backup Agora"
