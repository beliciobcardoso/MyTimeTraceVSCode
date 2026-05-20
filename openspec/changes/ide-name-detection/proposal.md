## Why

O MyTimeTrace não consegue diferenciar qual IDE está executando a extensão, impedindo análise de produtividade por ambiente e deixando usuários que usam múltiplas IDEs sem visibilidade de onde gastam seu tempo. A demanda cresce à medida que forks do VS Code (Cursor, Windsurf) ganham adoção significativa.

## What Changes

- Adicionar detecção automática de nome e versão da IDE na ativação da extensão, com estratégia em três camadas: `globalStorageUri.fsPath` → variáveis de ambiente → process info.
- Adicionar funções `getIdeName()` e `getIdeVersion()` em `deviceInfo.ts`, expostas como wrappers em `deviceManager.ts`.
- Executar migração SQL adicionando coluna `ide_name TEXT` (nullable) à tabela `time_entries` existente.
- Atualizar `saveActivityData()` e a interface `ActivityData` em `database.ts` para persistir `ide_name`.
- Atualizar `statusBar.ts` para exibir IDE atual com versão (ex: `🚀 Cursor v0.45.2`).
- Atualizar `syncManager.ts` para incluir `ide_name` e `ide_version` nos payloads enviados ao backend.

## Capabilities

### New Capabilities

- `ide-detection`: Detectar e reportar qual IDE está em execução (nome + versão), com fallbacks ordenados e lógica diferenciada para VS Code nativo vs. forks.
- `ide-tracking`: Persistir `ide_name` em cada `time_entry`, exibir IDE na status bar e enviar `ide_name`/`ide_version` ao backend via sync (onde múltiplos bancos são agregados).

### Modified Capabilities

<!-- Nenhuma especificação existente é alterada — esta é a primeira vez que IDE identity é introduzida. -->

## Impact

- **`src/deviceInfo.ts`**: novas funções `getIdeName()` e `getIdeVersion()`.
- **`src/deviceManager.ts`**: wrappers públicos `getIdeName()` / `getIdeVersion()`.
- **`src/database.ts`**: migração SQL, interface `ActivityData` e INSERT de `time_entries`.
- **`src/statusBar.ts`**: exibição da IDE na status bar.
- **`src/syncManager.ts`**: campos `ide_name` e `ide_version` no payload de sincronização (o backend agrega dados de múltiplas IDEs).
- **Banco de dados local**: coluna nova `ide_name` em `time_entries`; dados legados recebem `NULL`. Cada IDE possui seu próprio banco isolado — `ide_name` é relevante para correlação no backend, não para filtros locais.
- **Testes**: novos casos em `deviceManager.test.ts` cobrindo os três métodos de detecção.
- **Sem breaking changes**: campo `ide_name` é nullable; clientes antigos e dados históricos não são afetados.
