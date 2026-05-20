## ADDED Requirements

### Requirement: IDE Name Detection
A extensão SHALL detectar automaticamente o nome da IDE na ativação, usando `globalStorageUri.fsPath` como método primário, variáveis de ambiente como fallback secundário e process info como fallback terciário. Se nenhum método identificar a IDE, o valor retornado SHALL ser `"unknown"`.

#### Scenario: VS Code detectado via globalStorageUri
- **WHEN** `context.globalStorageUri.fsPath` contém o segmento `/Code/User/globalStorage/`
- **THEN** `getIdeName()` retorna `"VS Code"`

#### Scenario: Code - Insiders detectado via globalStorageUri
- **WHEN** `context.globalStorageUri.fsPath` contém o segmento `/Code - Insiders/User/globalStorage/`
- **THEN** `getIdeName()` retorna `"Code - Insiders"`

#### Scenario: Cursor detectado via globalStorageUri
- **WHEN** `context.globalStorageUri.fsPath` contém o segmento `/Cursor/User/globalStorage/`
- **THEN** `getIdeName()` retorna `"Cursor"`

#### Scenario: Windsurf detectado via globalStorageUri
- **WHEN** `context.globalStorageUri.fsPath` contém o segmento `/Windsurf/User/globalStorage/`
- **THEN** `getIdeName()` retorna `"Windsurf"`

#### Scenario: Google Antigravity detectado via globalStorageUri
- **WHEN** `context.globalStorageUri.fsPath` contém o segmento `/Google Antigravity/User/globalStorage/`
- **THEN** `getIdeName()` retorna `"Google Antigravity"`

#### Scenario: Fallback para variáveis de ambiente
- **WHEN** `globalStorageUri.fsPath` não corresponde a nenhuma IDE conhecida
- **AND** `process.env.VSCODE_RELEASE` é `"stable"` e não há indicadores de fork
- **THEN** `getIdeName()` retorna `"VS Code"` usando env vars como fonte

#### Scenario: Fallback para process info
- **WHEN** `globalStorageUri` e env vars falham em identificar a IDE
- **AND** o nome do processo pai contém `"cursor"`
- **THEN** `getIdeName()` retorna `"Cursor"` via process name

#### Scenario: IDE desconhecida
- **WHEN** todos os três métodos de detecção falham
- **THEN** `getIdeName()` retorna `"unknown"` sem lançar exceção

### Requirement: IDE Version Capture
A extensão SHALL capturar a versão da IDE com estratégia diferenciada por tipo. Para VS Code e Code-Insiders SHALL usar `vscode.version`. Para forks (Cursor, Windsurf, Google Antigravity) SHALL tentar ler `package.json` da instalação; se indisponível, SHALL retornar `vscode.version` com sufixo `"-base"`.

#### Scenario: Versão do VS Code via API nativa
- **WHEN** a IDE detectada é `"VS Code"` ou `"Code - Insiders"`
- **THEN** `getIdeVersion()` retorna o valor de `vscode.version` (ex: `"1.95.2"`)

#### Scenario: Versão real do Cursor via package.json
- **WHEN** a IDE detectada é `"Cursor"`
- **AND** `resources/app/package.json` é acessível no caminho da instalação
- **THEN** `getIdeVersion()` retorna a versão do campo `version` desse arquivo (ex: `"0.45.2"`)

#### Scenario: Fallback de versão para fork sem package.json acessível
- **WHEN** a IDE detectada é um fork (Cursor, Windsurf, Google Antigravity)
- **AND** `package.json` da instalação não está acessível
- **THEN** `getIdeVersion()` retorna `vscode.version + "-base"` (ex: `"1.95.2-base"`)

#### Scenario: Detecção não bloqueia ativação
- **WHEN** a extensão é ativada
- **THEN** toda a lógica de detecção de nome e versão da IDE MUST completar em menos de 100ms
