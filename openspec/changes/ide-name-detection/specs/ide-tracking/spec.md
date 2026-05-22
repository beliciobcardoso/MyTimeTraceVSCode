## ADDED Requirements

### Requirement: Persist IDE in Time Entries
A cada novo registro salvo em `time_entries`, o campo `ide_name` SHALL ser preenchido com o nome da IDE detectada na sessão atual. Dados históricos (anteriores à migração) SHALL ter `ide_name = NULL`, o que é semanticamente válido e não exige backfill.

#### Scenario: Novo registro inclui ide_name
- **WHEN** `saveActivityData()` é chamado durante uma sessão com IDE detectada
- **THEN** o registro inserido em `time_entries` contém `ide_name` com o valor retornado por `getIdeName()`

#### Scenario: Registro com IDE desconhecida
- **WHEN** `getIdeName()` retorna `"unknown"`
- **THEN** o registro é salvo com `ide_name = "unknown"` (não NULL)

#### Scenario: Dados históricos preservados
- **WHEN** a migração `ALTER TABLE time_entries ADD COLUMN ide_name TEXT` é executada
- **THEN** registros existentes têm `ide_name = NULL` sem alteração de outros campos

#### Scenario: Migração é idempotente
- **WHEN** a extensão é ativada e a coluna `ide_name` já existe em `time_entries`
- **THEN** nenhum erro é lançado e a migração é pulada silenciosamente

### Requirement: Status Bar IDE Display
A status bar SHALL exibir o nome e a versão da IDE detectada na sessão atual. O item SHALL ser visível durante toda a sessão de rastreamento.

#### Scenario: IDE exibida na status bar ao ativar
- **WHEN** a extensão é ativada e a IDE é detectada com sucesso
- **THEN** a status bar exibe o nome e versão no formato `<IDE> (v<versão>)` (ex: `Cursor (v0.45.2)`)

#### Scenario: IDE desconhecida exibida na status bar
- **WHEN** a IDE detectada é `"unknown"`
- **THEN** a status bar exibe `IDE: desconhecida` sem causar erro visual

#### Scenario: Tooltip com versão completa
- **WHEN** o usuário passa o mouse sobre o item de IDE na status bar
- **THEN** o tooltip exibe a versão completa da IDE detectada

### Requirement: Sync IDE to Backend
Quando `syncManager.ts` envia registros ao backend, cada entrada SHALL incluir os campos `ide_name` e `ide_version` no payload JSON.

#### Scenario: Payload de sync inclui ide_name e ide_version
- **WHEN** `syncManager` envia uma entrada de `time_entries` com `ide_name` preenchido
- **THEN** o body JSON da requisição contém `"ide_name"` e `"ide_version"` no objeto `time_entry`

#### Scenario: Payload de sync com ide_name NULL
- **WHEN** `syncManager` envia um registro legado com `ide_name = NULL`
- **THEN** o campo `ide_name` é omitido do payload (não enviado como `null`) para compatibilidade com versões antigas da API
