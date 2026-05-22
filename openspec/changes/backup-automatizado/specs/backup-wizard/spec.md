## ADDED Requirements

### Requirement: Wizard de configuração inicial de 4 passos
O sistema SHALL conduzir o usuário por 4 passos ao ativar o backup pela primeira vez: (1) seleção de pasta via `showOpenDialog`, (2) seleção de intervalo via `showQuickPick`, (3) definição de retenção via `showInputBox`, (4) resumo e confirmação. Se o usuário pressionar `Esc` em qualquer passo, o wizard SHALL abortar descartando todo o estado coletado — nenhuma configuração parcial SHALL ser gravada no `settings.json`.

#### Scenario: Wizard concluído com sucesso
- **WHEN** o usuário conclui todos os 4 passos e confirma
- **THEN** as configurações são salvas no `settings.json` e o primeiro backup é executado imediatamente via `triggerManualBackup()`

#### Scenario: Usuário cancela no passo 2
- **WHEN** o usuário pressiona `Esc` na seleção de intervalo (passo 2)
- **THEN** o wizard aborta, nenhuma configuração é salva e o `settings.json` permanece inalterado

### Requirement: Seleção de pasta via file picker nativo
O sistema SHALL abrir `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false })` para seleção da pasta de destino. O path SHALL ser extraído via `folders[0].fsPath`.

#### Scenario: Pasta selecionada com sucesso
- **WHEN** o usuário seleciona uma pasta via file picker
- **THEN** o path absoluto é capturado e o wizard avança para o passo 2

### Requirement: Aviso de pasta em nuvem ou rede
Após seleção da pasta, o sistema SHALL detectar se o caminho está em serviço de sincronização de nuvem (substrings: `OneDrive`, `Dropbox`, `Google Drive`, `iCloud Drive`) ou em caminho de rede (UNC `\\server\share`, `/Volumes/`, `/mnt/`). Se detectado, SHALL exibir `showWarningMessage` com opções "Continuar assim mesmo" e "Escolher outra pasta". O aviso não SHALL bloquear a configuração.

#### Scenario: Pasta dentro do OneDrive
- **WHEN** o path selecionado contém `OneDrive`
- **THEN** aviso de privacidade é exibido com opções de continuar ou escolher outra pasta

### Requirement: Seleção de intervalo via Quick Pick
O sistema SHALL exibir `showQuickPick` com opções: `1h`, `4h`, `8h`, `12h`, `24h` e `Personalizado`. Se "Personalizado" for selecionado, SHALL exibir `showInputBox` para entrada em horas (inteiro ≥ 1).

#### Scenario: Intervalo personalizado válido
- **WHEN** o usuário escolhe "Personalizado" e informa "6"
- **THEN** `intervalHours` é definido como 6 e o wizard avança para o passo 3

### Requirement: Definição de retenção máxima
O sistema SHALL exibir `showInputBox` para o número máximo de backups (mínimo 3, padrão 10). Valores menores que 3 SHALL ser rejeitados com mensagem de validação.

#### Scenario: Valor abaixo do mínimo
- **WHEN** o usuário informa "2" no campo de retenção
- **THEN** o `showInputBox` exibe mensagem de validação e não avança

### Requirement: Resumo e confirmação
O sistema SHALL exibir um resumo com pasta, intervalo e retenção configurados e perguntar se deseja ativar o backup. Ao confirmar, as configurações são salvas e o primeiro backup é executado.

#### Scenario: Usuário confirma na tela de resumo
- **WHEN** o usuário confirma o resumo
- **THEN** `backup.enabled`, `backup.destinationPath`, `backup.intervalHours` e `backup.maxBackups` são escritos no `settings.json` e o primeiro backup é acionado

### Requirement: Wizard acessível para reconfiguração
O comando `MyTimeTrace: Configurar Backup` SHALL abrir o wizard já preenchido com os valores atuais do `settings.json`, permitindo reconfiguração completa. Ao concluir, os novos valores são salvos e o agendador é reiniciado.

#### Scenario: Reconfiguração com nova pasta
- **WHEN** o usuário abre o wizard com backup já configurado e escolhe nova pasta
- **THEN** `backup.destinationPath` é atualizado, aviso de mudança de pasta é exibido com opção "Abrir pasta anterior", e o agendador é reiniciado
