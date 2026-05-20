## Context

A extensão MyTimeTrace registra entradas de tempo por arquivo/projeto, mas todos os registros são agnósticos à IDE que os gerou. Com a proliferação de forks do VS Code (Cursor, Windsurf, Google Antigravity), desenvolvedores usam múltiplos editores ao longo do dia sem conseguir filtrar o tempo por ambiente. A arquitetura atual usa `deviceInfo.ts` + `deviceManager.ts` para capturar device identity — o padrão se aplica diretamente à IDE identity. O banco local SQLite já existe com tabela `time_entries` em produção; a migração é additive (nova coluna nullable).

## Goals / Non-Goals

**Goals:**
- Detectar IDE na ativação da extensão com três camadas de fallback.
- Capturar versão da IDE com estratégia diferenciada (nativa para VS Code, process/package.json para forks).
- Persistir `ide_name` em cada novo registro de `time_entries` (dados históricos ficam NULL).
- Exibir IDE detectada na status bar ao lado do tempo rastreado.
- Incluir `ide_name` e `ide_version` nos payloads de sincronização com o backend.

**Non-Goals:**
- Histórico detalhado de sessões por IDE (`ide_sessions` — Fase 2).
- Filtro por IDE no dashboard web (depende de backend — Fase 2/3).
- Suporte a IDEs não-derivadas de VS Code (JetBrains, Vim, Emacs).
- Override manual de IDE via settings (Fase 4).
- Detecção de troca de IDE dentro da mesma sessão (Fase 2).

## Decisions

### D1 — Método primário: `globalStorageUri.fsPath`

**Decisão**: usar `context.globalStorageUri.fsPath` como fonte primária de detecção.

**Razão**: disponível diretamente no `ExtensionContext` sem dependências de OS ou processo; o caminho da pasta varia por IDE em todas as plataformas (`Code/`, `Cursor/`, `Windsurf/`, etc.). É o método mais confiável e de menor custo.

**Alternativa descartada**: `process.execPath` — requer parsing de path de instalação e não funciona em dev mode ou remote extensions.

### D2 — Versão: `vscode.version` apenas para VS Code nativo

**Decisão**: para VS Code e Code-Insiders usar `vscode.version` (API); para forks, ler o `package.json` da pasta de instalação (`path.dirname(process.execPath)/resources/app/package.json`) com fallback para `vscode.version + "-fork"`.

**Razão**: `vscode.version` em Cursor retorna a versão do VS Code base (ex: `1.95.2`) em vez da versão do Cursor (ex: `0.45.2`). Forks publicam sua versão real no `package.json` bundled.

**Alternativa descartada**: inferir versão por `process.env.VSCODE_VERSION` — o mesmo problema: reflete VS Code base, não o fork.

### D3 — Camada de abstração: padrão `deviceInfo` / `deviceManager`

**Decisão**: adicionar `getIdeName()` e `getIdeVersion()` em `deviceInfo.ts`; expor via `deviceManager.ts` como wrappers estáticos.

**Razão**: mantém consistência com o padrão já estabelecido para `getDeviceName()` / `getDeviceInfo()`. Facilita mock em testes e mantém `deviceManager` como ponto único de acesso a device/environment metadata.

### D4 — Migração SQL: coluna nullable sem default

**Decisão**: `ALTER TABLE time_entries ADD COLUMN ide_name TEXT` (sem default, sem NOT NULL).

**Razão**: dados existentes ficam com `NULL` (semântica correta: "desconhecido"). Não há risco de integridade. Rollback trivial: descartar coluna ou ignorar. Nenhum dado legado precisa ser backfillado.

### D5 — Sincronização: campos no body da requisição

**Decisão**: incluir `ide_name` e `ide_version` diretamente no objeto `time_entry` do payload JSON (não como headers HTTP).

**Razão**: o `syncManager.ts` já constrói um objeto JSON por entrada; adicionar campos ao body é mais simples e alinhado com a estrutura atual. Headers customizados são mais adequados para metadados de sessão global, não por entrada.

## Risks / Trade-offs

- **[Risco] `globalStorageUri` com caminho inesperado** em portable mode, WSL, container ou symlinks → Mitigation: fallback automático para env vars e process info; se todos falharem, registrar `"unknown"` sem travar a extensão.

- **[Risco] Versão do fork não disponível no `package.json`** se o fork reorganizar sua estrutura de instalação → Mitigation: capturar a exceção e retornar `vscode.version + "-base"` como indicador visual de imprecisão.

- **[Risco] Detecção executa em tempo de ativação** e pode atrasar o start da extensão → Mitigation: detecção é síncrona e leve (leitura de string + fs stat); nenhuma I/O bloqueante. Benchmark esperado < 5ms.

- **[Trade-off] `ide_name NULL` em dados históricos** gera inconsistência em filtros futuros → Aceito: a semântica de NULL = "antes da feature" é clara e não exige backfill.

## Migration Plan

1. A migração SQL é executada na inicialização da extensão via `database.ts` (mesmo padrão das migrações existentes).
2. `ALTER TABLE time_entries ADD COLUMN ide_name TEXT` é idempotente se protegido por verificação de coluna existente (`PRAGMA table_info`).
3. Rollback: coluna nullable não quebra versões anteriores da extensão — elas simplesmente ignoram o campo.
4. Não há necessidade de migração de dados: NULL para registros antigos é semanticamente correto.

## Open Questions

- Alertar o usuário via notificação quando a IDE muda entre sessões? (escopo Fase 2 — deixar como TODO)
- Enviar `ide_version` como campo separado ou concatenado com `ide_name`? (aguarda definição do contrato de API do backend)
