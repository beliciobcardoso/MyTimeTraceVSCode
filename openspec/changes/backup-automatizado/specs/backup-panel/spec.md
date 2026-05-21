## ADDED Requirements

### Requirement: Painel WebView stateful com padrão createOrShow
O sistema SHALL implementar `BackupPanel` como classe com método estático `createOrShow()` garantindo apenas um painel por vez. O `WebviewPanel` SHALL ser criado com `retainContextWhenHidden: true` e `enableScripts: true`.

#### Scenario: Painel já aberto
- **WHEN** `BackupPanel.createOrShow()` é chamado com painel já aberto
- **THEN** o painel existente recebe `reveal()` em vez de criar um novo

### Requirement: Listagem de backups em tabela
O painel SHALL listar em tabela todos os arquivos `.sqlite` na pasta de destino, ordenados do mais recente ao mais antigo. As colunas SHALL ser: checkbox de seleção, nome do arquivo (sem extensão), data/hora formatada pelo locale do sistema, tamanho em KB/MB e botão `🗑` de exclusão individual. O backup mais recente SHALL exibir badge `● atual`.

#### Scenario: Pasta com backups existentes
- **WHEN** o painel é aberto com pasta de destino contendo arquivos `.sqlite`
- **THEN** a tabela exibe todos os arquivos ordenados do mais recente ao mais antigo com badge `● atual` no primeiro

#### Scenario: Pasta vazia
- **WHEN** a pasta de destino está vazia ou inacessível
- **THEN** mensagem orientativa é exibida: "Nenhum backup encontrado. Clique em 'Fazer Backup Agora' para criar o primeiro."

### Requirement: FileSystemWatcher para atualização em tempo real
O painel SHALL registrar `vscode.workspace.createFileSystemWatcher` usando `new vscode.RelativePattern(vscode.Uri.file(destinationPath), '*.sqlite')` para detectar mudanças externas. O watcher SHALL chamar `refresh()` em `onDidCreate` e `onDidDelete`. O watcher SHALL ser descartado em `panel.onDidDispose`.

#### Scenario: Arquivo deletado externamente
- **WHEN** o usuário deleta um arquivo `.sqlite` da pasta via explorador do sistema
- **THEN** a tabela do painel atualiza automaticamente sem necessidade de ação do usuário

### Requirement: Exclusão individual com confirmação
O botão `🗑` por linha SHALL exibir diálogo de confirmação antes de excluir. Após confirmação, o arquivo SHALL ser removido via `vscode.workspace.fs.delete` e a tabela atualizada. Se o total remanescente ficar abaixo de 3, SHALL exibir aviso informativo sem bloquear a exclusão.

#### Scenario: Exclusão individual confirmada
- **WHEN** o usuário clica em `🗑` e confirma a exclusão
- **THEN** o arquivo é removido, a tabela é atualizada e a operação é registrada no Output Channel

#### Scenario: Exclusão abaixo do mínimo de retenção
- **WHEN** o usuário exclui um backup e o total remanescente fica abaixo de 3
- **THEN** aviso informativo é exibido mas a exclusão não é bloqueada

### Requirement: Exclusão em lote com confirmação
O painel SHALL habilitar o botão "Excluir Selecionados" apenas com ao menos uma seleção ativa, exibindo a contagem no rótulo. Após confirmação, todos os arquivos selecionados SHALL ser removidos em sequência e a tabela atualizada.

#### Scenario: Exclusão em lote de 3 arquivos
- **WHEN** o usuário marca 3 checkboxes e clica em "Excluir Selecionados (3)"
- **THEN** diálogo de confirmação menciona "3 backups" e ao confirmar todos são removidos

### Requirement: Bloco de status com badge de estado
O painel SHALL exibir bloco de status com badge colorido (`● Ativo` verde / `⏸ Pausado` cinza / `✕ Falha` vermelho), data/hora do último backup e campo "Próximo backup" (exibindo `"— (agendamento disponível na próxima versão)"` na Fase 1).

#### Scenario: Backup falha
- **WHEN** `performBackup()` falha e `handleBackupError()` é chamado
- **THEN** `BackupPanel.currentPanel?.refresh()` é chamado e o badge muda para `✕ Falha` com mensagem de erro

### Requirement: Ações globais sempre visíveis
O painel SHALL exibir botões: "Fazer Backup Agora" (desabilitado durante execução), "Configurar Backup" (abre wizard), "Abrir Pasta" e "Excluir Selecionados" (habilitado apenas com seleção).

#### Scenario: Botão desabilitado durante execução
- **WHEN** backup está em andamento (`isBacking: true` em `getStatus()`)
- **THEN** o botão "Fazer Backup Agora" está desabilitado visualmente

### Requirement: Protocolo de mensagens WebView ↔ Extensão
O painel SHALL usar `panel.webview.postMessage` (extensão → WebView) com comandos `refreshBackups`, `backupStarted`, `backupFinished`, e `panel.webview.onDidReceiveMessage` (WebView → extensão) com comandos `deleteBackup`, `deleteSelected`, `triggerBackup`, `openWizard`, `openFolder`.

#### Scenario: WebView envia deleteBackup
- **WHEN** WebView envia `{ command: 'deleteBackup', fileName: '...' }`
- **THEN** o handler na extensão remove o arquivo e chama `postMessage({ command: 'refreshBackups', ... })`

### Requirement: Texto de restauração manual na Fase 1
Na Fase 1, o painel SHALL exibir mensagem estática no rodapé da tabela explicando como restaurar manualmente um backup (fechar VS Code, substituir `time_tracker.sqlite`, reabrir). O path do banco SHALL ser exibido dinamicamente via `databaseManager.getDbPath()`.

#### Scenario: Rodapé com instrução de restauração
- **WHEN** o painel é aberto na Fase 1
- **THEN** rodapé exibe o caminho do banco atual e instruções de restauração manual
