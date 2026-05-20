## 1. Detecção de IDE (deviceInfo.ts)

- [ ] 1.1 Adicionar função `getIdeName(globalStorageUri: string): string` em `deviceInfo.ts` com detecção via `globalStorageUri.fsPath` (VS Code, Code - Insiders, Cursor, Windsurf, Google Antigravity)
- [ ] 1.2 Adicionar fallback de detecção via variáveis de ambiente (`process.env.VSCODE_RELEASE`, `VSCODE_VERSION`) quando `globalStorageUri` não identifica a IDE
- [ ] 1.3 Adicionar fallback de detecção via `process.execPath` / nome do processo pai quando env vars falham
- [ ] 1.4 Retornar `"unknown"` (sem lançar exceção) quando todos os métodos falham
- [ ] 1.5 Adicionar função `getIdeVersion(ideName: string): string` com lógica diferenciada: `vscode.version` para VS Code/Insiders; `package.json` da instalação para forks; fallback `vscode.version + "-base"` se package.json inacessível

## 2. Wrappers em deviceManager.ts

- [ ] 2.1 Expor `getIdeName(): string` em `deviceManager.ts` como wrapper estático de `deviceInfo.getIdeName()` passando `context.globalStorageUri.fsPath`
- [ ] 2.2 Expor `getIdeVersion(): string` em `deviceManager.ts` como wrapper estático de `deviceInfo.getIdeVersion()`
- [ ] 2.3 Inicializar detecção de IDE no `activate()` da extensão e armazenar resultado em variável de módulo para reuso durante a sessão

## 3. Banco de Dados — Migração e Persistência

- [ ] 3.1 Adicionar verificação de coluna existente via `PRAGMA table_info(time_entries)` em `database.ts`
- [ ] 3.2 Executar `ALTER TABLE time_entries ADD COLUMN ide_name TEXT` condicionalmente (idempotente)
- [ ] 3.3 Atualizar interface `ActivityData` em `database.ts` adicionando campo opcional `ide_name?: string`
- [ ] 3.4 Atualizar statement INSERT de `saveActivityData()` para incluir `ide_name` no VALUES
- [ ] 3.5 Garantir que registros com `ide_name = NULL` (dados históricos) não causam erros em queries existentes

## 4. Status Bar

- [ ] 4.1 Atualizar `statusBar.ts` para receber e exibir o nome da IDE detectada no formato `<IDE> (v<versão>)` ao lado do tempo rastreado
- [ ] 4.2 Tratar caso de IDE `"unknown"` exibindo `IDE: desconhecida` sem quebrar o layout da status bar
- [ ] 4.3 Adicionar tooltip no item de IDE da status bar com a versão completa

## 5. Sincronização

- [ ] 5.1 Atualizar `syncManager.ts` para incluir `ide_name` e `ide_version` no objeto `time_entry` do payload JSON
- [ ] 5.2 Omitir campos `ide_name`/`ide_version` do payload quando `ide_name` for `NULL` (registros históricos)

## 6. Testes

- [ ] 6.1 Adicionar testes unitários em `deviceManager.test.ts` para `getIdeName()`: cada IDE pelo método `globalStorageUri`, fallback env vars, fallback process info, e retorno `"unknown"`
- [ ] 6.2 Adicionar testes para `getIdeVersion()`: versão via `vscode.version`, versão via `package.json` mockado, fallback `"-base"`
- [ ] 6.3 Adicionar teste de migração: verificar que `ALTER TABLE` é idempotente e que dados históricos ficam com `NULL`
- [ ] 6.4 Adicionar teste para `saveActivityData()` verificando que `ide_name` é persistido corretamente

## 7. Validação

- [ ] 7.1 Testar detecção manualmente no VS Code estável e confirmar `"VS Code"` na status bar
- [ ] 7.2 Testar no Cursor e confirmar nome e versão correta (não versão VS Code base)
- [ ] 7.3 Verificar que registros antigos no banco têm `ide_name = NULL` após migração sem corrupção de dados
- [ ] 7.4 Confirmar que payload de sync inclui `ide_name`/`ide_version` em nova sessão e os omite em registros históricos

## 8. Documentação

- [ ] 8.1 Atualizar `docs/PRD_REGISTRO_IDE.md` marcando itens do checklist de implementação como concluídos
- [ ] 8.2 Atualizar `README.md` ou `docs/` com descrição da feature de detecção de IDE e IDEs suportadas
