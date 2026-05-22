## Context

O projeto MyTimeTrace VS Code armazena todos os dados em um único arquivo SQLite (`time_tracker.sqlite`) em `context.globalStorageUri`. Já existe um `SyncManager` que envia dados para o servidor remoto, mas usuários open source sem conta na plataforma não têm salvaguarda automática contra perda de dados local.

O projeto usa `sqlite3` (npm) com API de callbacks — não `better-sqlite3`. Toda operação de filesystem (exceto `statfs` e o path literal do `VACUUM INTO`) deve usar `vscode.workspace.fs` para compatibilidade com ambientes remotos (SSH, WSL, Dev Containers).

O `commands.ts` está em exatamente 573 LOC — novos comandos de backup vão em arquivo separado (`backupCommands.ts`).

## Goals / Non-Goals

**Goals:**
- Backup local seguro via `VACUUM INTO` (banco aberto, sem lock na UI)
- Configuração 100% via VS Code settings, scope `machine` (não sincroniza entre dispositivos)
- Wizard guiado na primeira ativação
- Painel WebView stateful para gerenciamento de backups
- Agendamento automático, retenção automática e retry em falhas
- Independência total do `SyncManager` — schedulers, configurações e estados separados

**Non-Goals:**
- Backup em nuvem como requisito (Fase 4 é opt-in)
- Restauração automática sem ação explícita do usuário
- Daemon externo (backup só roda com VS Code aberto)
- Sincronização em tempo real ou versionamento avançado no MVP

## Decisions

### D1 — `VACUUM INTO` em vez de `fs.copyFile()`
`fs.copyFile()` falha com banco aberto e pode gerar cópia corrompida. `VACUUM INTO` cria snapshot consistente sem bloquear escritas. Desvantagem: não suporta placeholder `?` — requer validação explícita de aspas simples, path absoluto e null byte no path antes de concatenar.

### D2 — Arquivo temporário `.sqlite.tmp` com rename atômico
Escrever diretamente no destino final deixaria arquivo parcial se o VS Code fechar no meio. A estratégia `.tmp` + rename garante que arquivos com extensão `.sqlite` na pasta de destino são sempre backups completos e válidos. Órfãos `.tmp` são limpos no início de cada `performBackup()`.

### D3 — Verificação de integridade dupla (origem + destino)
`PRAGMA quick_check` no banco de origem antes do backup evita propagar corrupção silenciosamente. `PRAGMA quick_check` no arquivo gerado (via conexão SQLite separada, somente leitura) confirma que o backup é válido antes de entrar na política de retenção. Custo: proporcional ao tamanho do banco, mas ordens de magnitude menor que `integrity_check`.

### D4 — `sync_metadata` para estado persistente, `backup.log` (JSONL) para histórico
`sync_metadata` armazena apenas 4 chaves (`backup.lastTimestamp`, `backup.nextScheduled`, `backup.state`, `backup.lastError`) necessárias para a lógica de agendamento. Histórico de operações vai em `backup.log` (JSONL, rotação em 100 linhas) em `context.globalStorageUri.fsPath` — sobrevive a corrupção do `time_tracker.sqlite`, que é exatamente quando o log seria mais valioso. Alternativa rejeitada: JSON completo em `sync_metadata` — inacessível se o banco corromper.

### D5 — `BackupPanel` stateful com padrão `createOrShow`
Painéis existentes (`statsPanel.ts`, `deletedProjectsPanel.ts`) são geradores HTML estáticos. `BackupPanel` mantém estado de checkboxes e lista de backups, recebe atualizações em tempo real via `FileSystemWatcher`, e exige `retainContextWhenHidden: true` para não perder estado ao trocar de aba. Padrão `createOrShow` garante apenas um painel por vez.

### D6 — Estratégia `setTimeout` + `setInterval` (não `setInterval` puro)
`setInterval` puro com o intervalo total causaria drift e não sobreviveria a mudanças de configuração em tempo real. `setTimeout` para o próximo backup calculado + `setInterval` para ciclos subsequentes garante alinhamento correto dos ciclos e permite cancelar e recriar o agendamento ao mudar o intervalo.

### D7 — `scope: machine` em todas as settings de backup
VS Code Settings Sync sincroniza configurações entre dispositivos por padrão. Sem `scope: machine`, o `destinationPath` de uma máquina apareceria nas configurações de outra onde o caminho não existe. Configurações de backup são intrinsecamente locais.

### D8 — Output Channel dedicado em vez de `console.log`
`console.log` é visível apenas no DevTools (`Help → Toggle Developer Tools`) — inacessível para usuários finais. Falhas de backup ocorrem sem usuário ativo. Output Channel (`View → Output → MyTimeTrace`) pode ser copiado para um bug report por qualquer usuário.

### D9 — `BackupCommands` como classe separada de `commands.ts`
`commands.ts` está em exatamente 573 LOC. Qualquer adição viola o limite do projeto. `BackupCommands` segue o padrão `registerBackupCommands(context, backupManager)` análogo ao `registerSyncCommands`.

### D10 — Fases de entrega (1A → 1B → 2 → 3 → 4)
- **Fase 1A**: `BackupManager` + `BackupCommands` — backup manual funcional, sem painel WebView. Valida o mecanismo central de forma isolada.
- **Fase 1B**: `BackupPanel` — interface visual. Depende da Fase 1A.
- **Fase 2**: Agendamento automático + `BackupRetryManager` + restauração + comandos de pausa/retomada.
- **Fase 3**: Compressão (pré-requisito da Fase 4).
- **Fase 4**: Backup offsite no GitHub (opt-in).

## Risks / Trade-offs

- **Banco corrompido propagando para backups** → `PRAGMA quick_check` na origem antes de qualquer operação (passo -2 do RF02). Se falhar: notificar e abortar.
- **Clock skew (NTP, mudança de fuso)** → Se `(agora - lastTimestamp) < 0`, tratar como timestamp ausente e executar backup imediatamente. Registrar aviso no Output Channel.
- **TOCTOU no sufixo de colisão** → Loop de existência + `{ overwrite: false }` no rename como última defesa. Em múltiplas janelas, falha de rename é tratada como colisão e incrementa sufixo.
- **Múltiplas janelas do VS Code** → Política de retenção pode tentar deletar o mesmo arquivo duas vezes. Erro de "arquivo não encontrado" deve ser tratado como sucesso silencioso.
- **Sleep/wake sem reinício** → Timers `setTimeout` podem ser congelados pelo Electron. `onDidChangeWindowState` verifica backup perdido ao recuperar foco (Fase 2).
- **`destinationPath` com aspas simples** → `VACUUM INTO` não aceita placeholder `?`. Validação explícita rejeita paths com `'`, null bytes e paths não absolutos.
- **Espaço insuficiente em disco** → `fs.promises.statfs` verifica margem de 50% sobre o tamanho do banco antes de iniciar. Fallback gracioso para versões do Node.js sem `statfs`.
- **Mudança de `destinationPath`** → Backups anteriores permanecem na pasta antiga e somem do painel. Aviso único exibido ao usuário com opção "Abrir pasta anterior".
- **Bancos > 50MB na Fase 4** → GitHub impõe limite de 100MB por arquivo. Fase 4 requer Fase 3 (compressão) concluída.

## Migration Plan

1. Modificar `src/modules/database.ts` primeiro (pré-requisito bloqueante — `getDbPath()` não existe ainda).
2. Adicionar constantes em `src/config/constants.ts`.
3. Criar `backupManager.ts` e `backupCommands.ts`.
4. Registrar em `extension.ts` via `context.subscriptions`.
5. Adicionar settings e comandos no `package.json`.
6. Criar `backupPanel.ts` (Fase 1B).
7. Rollback: remover instância do `BackupManager` de `extension.ts` e settings do `package.json` — o `SyncManager` e o engine de tracking não são afetados.

## Open Questions

- Journal mode atual do banco (WAL vs DELETE): verificar via `PRAGMA journal_mode` na inicialização do `DatabaseManager` e documentar antes da implementação.
- Tamanho médio do `time_tracker.sqlite` em produção: relevante para validar a margem de espaço em disco e a viabilidade da Fase 4 sem compressão.
