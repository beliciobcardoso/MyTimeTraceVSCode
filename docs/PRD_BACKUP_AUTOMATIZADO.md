# PRD - Backup Automatizado com Agendamento do Usuário

## Visão Geral

Criar um recurso de backup automatizado para preservar os dados do MyTimeTrace VS Code com agendamento definido pelo usuário. O foco é reduzir risco de perda de dados, dar controle total de horário e local, e manter o fluxo simples dentro da extensão.

## Problema

Hoje, o usuário depende de rotinas manuais para proteger os dados locais. Isso aumenta risco de perda por falha do sistema, troca de máquina, corrupção do banco ou erro humano.

## Objetivos

- Garantir backup recorrente dos dados críticos.
- Permitir que o usuário defina frequência, horário e local de destino.
- Reduzir impacto no uso normal da extensão.
- Dar visibilidade clara do último backup, próximo backup e falhas.

## Não Objetivos

- Backup em nuvem como requisito. A extensão é open source: usuários podem optar por não usar a plataforma em nuvem e precisam de uma alternativa local confiável.
- Sincronização em tempo real.
- Restauração automática do banco sem ação explícita do usuário. O sistema nunca substitui os dados atuais por um backup sem que o usuário solicite.
- Versionamento avançado de histórico no MVP.

## Público-Alvo

- Usuários que usam a extensão em rotina diária.
- Pessoas que dependem dos dados de rastreio para relatório ou cobrança.
- Times que querem evitar perda de base local.
- Usuários open source que não utilizam a plataforma em nuvem.

## Contexto: Backup Local vs Sync em Nuvem

O projeto já possui sincronização de dados com a plataforma em nuvem (`SyncManager`). O backup local e o sync são **sistemas completamente separados e independentes**: possuem schedulers distintos, configurações distintas e não interferem um no outro em nenhuma circunstância.

| | Sync em Nuvem | Backup Local |
|---|---|---|
| **Protege contra** | Perda no dispositivo único | Corrupção do banco, falha de rede, troca de máquina |
| **Configurado por** | Servidor (dinâmico) | VS Code settings (local, pelo usuário) |
| **Requer conta** | Sim | Não |
| **Destino** | Plataforma MyTimeTrace | Pasta local definida pelo usuário |
| **Scheduler** | `SyncManager` (horários do servidor) | `BackupManager` (intervalo local) |

## Escopo Do MVP

### Funcionalidades

- Agendar backup por intervalo livre: a cada hora, a cada 4 horas, etc.
- Permitir que o usuário defina o número máximo de backups retidos (ex: 2 a 100).
- Permitir que o usuário defina a pasta de destino.
- Executar backup em segundo plano usando SQLite Backup API.
- Guardar log do último backup e do próximo agendado.
- Exibir alerta só em falha ou ação pedida.
- Backup só roda com o VS Code aberto (sem daemon externo).

### Arquivo de Backup

- **Fonte**: arquivo `time_tracker.sqlite` (banco único da extensão).
- **Destino**: pasta definida pelo usuário nas configurações.
- **Nomenclatura**: `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite`
- **Organização**: cada backup é um arquivo individual na pasta de destino.
- **Retenção**: o usuário define quantos backups manter. Ao atingir o limite, o backup mais antigo é removido automaticamente.

### Localização do Banco de Dados Original

O arquivo `time_tracker.sqlite` fica em uma pasta gerenciada automaticamente pelo VS Code. O usuário não precisa saber o caminho para usar o backup — a extensão localiza o arquivo sozinha. A tabela abaixo serve apenas como referência para quem quiser inspecionar o arquivo manualmente.

**VS Code**

| Sistema | Caminho completo |
|---|---|
| Windows | `C:\Users\SeuNome\AppData\Roaming\Code\User\globalStorage\BelicioBCardoso.my-time-trace-vscode\time_tracker.sqlite` |
| macOS | `~/Library/Application Support/Code/User/globalStorage/BelicioBCardoso.my-time-trace-vscode/time_tracker.sqlite` |
| Linux | `~/.config/Code/User/globalStorage/BelicioBCardoso.my-time-trace-vscode/time_tracker.sqlite` |

**Outros editores baseados no VS Code** (Cursor, VS Code Insiders, Windsurf)

A estrutura é idêntica. Apenas o nome da pasta do aplicativo muda:

| Editor | Pasta do aplicativo |
|---|---|
| VS Code Insiders | `Code - Insiders` |
| Cursor | `Cursor` |
| Windsurf | `Windsurf` |

Exemplo no macOS com Cursor: `~/Library/Application Support/Cursor/User/globalStorage/BelicioBCardoso.my-time-trace-vscode/time_tracker.sqlite`

## Requisitos Funcionais

### RF01 - Configurar agendamento

O usuário deve poder definir o intervalo de execução do backup nas configurações do VS Code (local settings). Exemplos: a cada 1 hora, a cada 4 horas, a cada 24 horas. O agendamento é independente do sync com o servidor — os dois sistemas não se comunicam e não se interferem.

### RF02 - Executar backup

A extensão deve copiar o arquivo `time_tracker.sqlite` usando o comando **`VACUUM INTO`** do SQLite, executado via `db.run()` do pacote npm `sqlite3` (já presente no projeto):

```typescript
// -1. Limpar arquivos .tmp órfãos — de backups interrompidos por crash, kill ou poweroff.
//     Executado no início de cada performBackup() antes de qualquer outra operação.
//     Seguro deletar: *.sqlite.tmp nunca é backup válido, nunca está na lista de retenção.
try {
  const destDir = path.dirname(destPath);
  const entries = await fs.promises.readdir(destDir);
  const orphans = entries.filter(f => f.endsWith('.sqlite.tmp'));
  for (const orphan of orphans) {
    await fs.promises.unlink(path.join(destDir, orphan)).catch(() => {});
    console.log('[BackupManager] Orphan .tmp removido:', orphan);
  }
} catch { /* pasta pode não existir ainda — seguro ignorar */ }
// 0. Verificar espaço em disco disponível antes de iniciar
//    fs.promises.statfs disponível a partir do Node.js v19 (Electron 28+).
//    Em versões anteriores, capturar SQLITE_FULL no callback e mapear para mensagem útil.
try {
  const volumeStats = await fs.promises.statfs(path.dirname(destPath));
  const availableBytes = volumeStats.bavail * volumeStats.bsize;
  const dbSize = (await fs.promises.stat(databaseManager.getDbPath())).size;
  if (availableBytes < dbSize * 1.5) { // margem de 50% sobre o tamanho atual do banco
    throw new Error(
      `Espaço insuficiente em disco: ${Math.round(availableBytes / 1048576)}MB disponíveis, necessário ~${Math.round(dbSize * 1.5 / 1048576)}MB.`
    );
  }
} catch (e: any) {
  if (e.code === 'ERR_INVALID_ARG_TYPE') { /* statfs indisponível — prosseguir sem check */ }
  else throw e;
}
// 1. Validar path — aspas simples quebram o SQL (VACUUM INTO não aceita placeholder ?)
if (destPath.includes("'")) {
  throw new Error("O caminho de destino não pode conter aspas simples ( ' ).");
}
// 2. Garantir que a pasta de destino existe (VACUUM INTO não cria pastas)
await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
// 3. Resolver colisão de nome — VACUUM INTO falha se o arquivo já existir
//    (dois backups no mesmo segundo: manual + automático, ou cliques rápidos)
let finalDestPath = destPath;
let counter = 0;
while (fs.existsSync(finalDestPath)) {
  counter++;
  const base = destPath.replace(/\.sqlite$/, '');
  finalDestPath = `${base}_${counter}.sqlite`;
}
// 4. Usar arquivo temporário — se o VS Code fechar no meio, o .tmp fica no disco
//    mas nunca é confundido com um backup válido; removido no próximo backup.
const tmpDestPath = finalDestPath + '.tmp';
// 5. Forward slashes obrigatórios mesmo no Windows — VACUUM INTO não aceita backslashes
const safeTmpDest = tmpDestPath.replace(/\\/g, '/');
// 6. Executar backup — ao completar, renomear .tmp → .sqlite E verificar integridade
//    ATENÇÃO: db.run() não faz await do callback. Usar async callback aqui causaria
//    UnhandledPromiseRejection se rename() ou validateBackupFile() lançarem.
//    Envolver operações async em IIFE com .catch() obrigatório.
db.run(`VACUUM INTO '${safeTmpDest}'`, (err: Error | null) => {
  if (err) { /* tratar erro */ return; }
  (async () => {
    // 7. Renomear .tmp → .sqlite final (operação atômica no mesmo volume)
    await fs.promises.rename(tmpDestPath, finalDestPath);
    // 8. Verificar integridade do arquivo gerado — abre o backup e executa PRAGMA quick_check
    await validateBackupFile(finalDestPath); // ver nota abaixo
  })().catch(asyncErr => { /* tratar erro async — chamar handleBackupError(asyncErr) */ });
});
```

**Validação de integridade pós-backup (`validateBackupFile`):**

```typescript
function validateBackupFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const testDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (openErr) => {
      if (openErr) return reject(new Error(`Backup inválido (não abre): ${openErr.message}`));
      testDb.get('PRAGMA quick_check', (checkErr, row: { quick_check: string }) => {
        testDb.close();
        if (checkErr || row?.quick_check !== 'ok') {
          fs.promises.unlink(filePath).catch(() => {}); // remove arquivo corrompido
          reject(new Error('Backup falhou na verificação de integridade (quick_check ≠ ok)'));
        } else {
          resolve();
        }
      });
    });
  });
}
```

`PRAGMA quick_check` verifica estrutura interna das páginas B-tree sem leitura completa — custo proporcional ao tamanho do banco, mas ordens de magnitude mais rápido que `integrity_check`. Detecta corrupção causada por: disco cheio no meio do `VACUUM INTO`, setores defeituosos, e encerramento do processo durante a escrita. Se `quick_check` falhar, o arquivo `.sqlite` corrompido é removido imediatamente — melhor não ter backup do que ter backup inválido na lista.

O `VACUUM INTO` garante integridade mesmo com o banco aberto: cria um snapshot consistente no destino sem bloquear escritas em andamento. O backup não pode travar a UI — deve rodar de forma assíncrona, usando o modelo de callbacks do `sqlite3`.

> **Atenção para implementadores:**
> - O pacote npm `sqlite3` não suporta placeholder `?` em `VACUUM INTO` — a concatenação é obrigatória, portanto a validação de aspas simples no path é indispensável.
> - `VACUUM INTO` falha se a **pasta de destino não existir** — chamar `fs.promises.mkdir(path.dirname(destPath), { recursive: true })` antes é obrigatório.
> - Não usar `fs.copyFile()` no lugar do `VACUUM INTO` — falha com banco aberto e gera cópia corrompida.
> - Usar **arquivo `.tmp`** como destino intermediário — renomear para `.sqlite` só após `VACUUM INTO` + `quick_check` completarem com sucesso. Sem isso, um encerramento inesperado do VS Code deixa um arquivo corrompido com nome de backup válido na pasta.
> - O path de **origem** (fonte) é obtido via `databaseManager.getDbPath()` — ver Premissas Técnicas.

### RF03 - Ajustar configuração

O usuário deve poder alterar a qualquer momento:
- Intervalo de execução.
- Número máximo de backups retidos.
- Pasta de destino.

Todas as configurações ficam em `settings.json` (VS Code local settings).

### RF04 - Ver status

A UI deve mostrar:
- Data e hora do último backup concluído.
- Data e hora do próximo backup agendado.
- Estado atual: ativo, pausado ou falha.
- Erros com mensagem útil.

### RF05 - Retentar falha

Se o backup falhar, o sistema deve tentar novamente em janela curta, seguindo o padrão do `SyncRetryManager` existente. Um `BackupRetryManager` será criado com a mesma arquitetura — mesmos métodos públicos `execute()` e `updateConfig()` — porém com valores **fixos por padrão**, sem dependência de servidor:

- `maxRetries`: 3 tentativas
- `retryDelayMs`: 30.000ms (30 segundos)

Diferente do `SyncRetryManager` (que recebe configuração dinâmica do backend via `/sync/config`), o `BackupRetryManager` usa esses defaults constantes. O erro é registrado em log e exibido ao usuário após falha total nas 3 tentativas.

> **`updateConfig()` é um no-op intencional:** o método existe apenas para compatibilidade de interface com o `SyncRetryManager` — nunca deve ser chamado pelo `BackupManager`. Os valores são fixos por constantes (`BACKUP_MAX_RETRIES`, `BACKUP_RETRY_DELAY_MS`) e não são configuráveis pelo usuário nem pelo servidor. A implementação deve registrar um aviso se chamada: `console.warn('BackupRetryManager: updateConfig() chamado — valores fixos, chamada ignorada.')`.`

### RF06 - Política de retenção

Ao concluir um backup com sucesso:
1. Listar todos os arquivos na pasta de destino cujo nome corresponda ao padrão `time_tracker_YYYY-MM-DD_HH-mm-ss[_N].sqlite`. Arquivos com nome fora do padrão (copiados manualmente, temporários `.tmp`, etc.) devem ser **ignorados pela política de retenção** — exibidos na tabela do painel, mas nunca removidos automaticamente.
2. Ordenar por **timestamp extraído do nome do arquivo** — não por `mtime` do filesystem. Arquivos restaurados ou copiados de outra máquina têm `mtime` igual ao momento da cópia, não à data original do backup. Usar `mtime` causaria remoção do backup errado.
3. Se o número de arquivos elegíveis exceder o limite configurado, remover o(s) mais antigo(s) pela ordenação do passo anterior.
4. Registrar cada remoção em log com nome do arquivo removido.

O número mínimo de backups retidos é **3**. A extensão não permite configurar um valor menor para garantir que sempre haja pelo menos uma cópia de segurança anterior disponível.

### RF07 - Backup manual

O usuário deve poder acionar um backup imediato via comando da extensão, independente do agendamento. O comando **`MyTimeTrace: Fazer Backup Agora`** (`my-time-trace-vscode.backupNow`) fica sempre disponível na paleta de comandos do VS Code, mesmo com o backup automático pausado.

Quando invocado via paleta de comandos (`Ctrl+Shift+P`), o comando deve usar `vscode.window.withProgress()` para exibir indicador de progresso na notificação — o mesmo padrão adotado pelo `syncNow` em `commands.ts`. Isso garante que o usuário tenha feedback visual mesmo sem o painel aberto:

```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'MyTimeTrace',
  cancellable: false
}, async (progress) => {
  progress.report({ message: 'Executando backup...' });
  await backupManager.triggerManualBackup(); // método público — performBackup() é private
});
```

Quando acionado pelo botão no painel WebView, o feedback já é dado pelo estado do botão (desabilitado durante execução) — `withProgress()` não é necessário nesse caso.

### RF08 - Configuração inicial guiada (wizard)

Na primeira vez que o backup é ativado, ou quando nenhuma configuração estiver definida, a extensão conduz o usuário por um wizard passo a passo:

1. **Pasta de destino** — abre o file picker nativo via `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false })`. O retorno é `vscode.Uri[] | undefined`; extrair `folders[0].fsPath` para obter a string do path (ver Dependências — APIs do VS Code).
2. **Intervalo de execução** — exibe um Quick Pick com opções predefinidas: `1h`, `4h`, `8h`, `12h`, `24h` e `Personalizado`. Se escolher personalizado, um Input Box solicita o valor em horas. O intervalo é salvo no `settings.json` e será usado pelo agendamento automático a partir da Fase 2.
3. **Retenção máxima** — Input Box para o usuário informar quantos backups manter (mínimo 3, padrão 10).
4. **Resumo e confirmação** — exibe as escolhas feitas e pergunta se deseja ativar o backup agora. Ao confirmar, a configuração é salva no `settings.json` e o primeiro backup é executado imediatamente.

> **Cancelamento:** `showOpenDialog`, `showQuickPick` e `showInputBox` retornam `undefined` quando o usuário pressiona `Esc` ou fecha o diálogo. Se isso ocorrer em **qualquer passo**, o wizard aborta imediatamente e **descarta todo o estado coletado até ali** — nada é gravado no `settings.json`. O implementador deve verificar o retorno após cada chamada: `if (!resultado) return;`. Nunca salvar configuração parcial — um `settings.json` com `destinationPath` preenchido mas `intervalHours` zerado pode quebrar o agendador na inicialização.

O wizard também pode ser acessado a qualquer momento pelo comando `MyTimeTrace: Configurar Backup`, permitindo reconfiguração completa.

### RF09 - Gerenciar backups via painel

A extensão deve expor um painel WebView dedicado (seguindo o padrão de `statsPanel.ts` e `deletedProjectsPanel.ts`) que permita ao usuário visualizar e gerenciar todos os backups existentes na pasta de destino.

O painel deve:

1. **Listar backups** — exibir em tabela todos os arquivos `.sqlite` encontrados na pasta de destino, ordenados do mais recente ao mais antigo, com as colunas: checkbox de seleção, nome do arquivo, data/hora de criação, tamanho e botão de ação individual.
2. **Excluir backup individual** — botão `🗑` por linha. Exige confirmação antes de excluir. Exibe aviso (sem bloqueio) se o total remanescente ficar abaixo de 3.
3. **Excluir backups em lote** — seleção múltipla via checkbox. O botão "Excluir Selecionados" fica habilitado apenas com ao menos uma seleção ativa, exibindo a contagem no rótulo. Exige confirmação antes de excluir.
4. **Expor ações globais** — botões sempre visíveis: Fazer Backup Agora, Configurar Backup (wizard), Abrir Pasta, e Configurar Backup no GitHub (Fase 4).
5. **Exibir estado atual** — bloco de status com badge (Ativo / Pausado / Falha), data/hora do último backup e, a partir da Fase 2, data/hora do próximo backup agendado.
6. **Atualizar automaticamente** — a tabela e o bloco de status se atualizam após cada operação (backup concluído, exclusão, restauração).
7. **Estado vazio** — se a pasta estiver vazia ou inacessível, exibir mensagem orientativa em vez de tabela vazia.

> A exclusão manual pelo usuário no painel é ação explícita e **não está sujeita ao bloqueio da política de retenção automática** (RF06). O sistema exibe aviso informativo, mas não impede a exclusão.

**Padrão de implementação do painel (`backupPanel.ts`):**

Diferente dos painéis existentes (`statsPanel.ts`, `deletedProjectsPanel.ts`) que são funções puras de geração de HTML, o painel de backups é **stateful** (mantém lista de backups, checkboxes, recebe atualizações em tempo real). Deve seguir o padrão `createOrShow`:

```typescript
export class BackupPanel {
  private static currentPanel: BackupPanel | undefined;

  public static createOrShow(context: vscode.ExtensionContext, backupManager: BackupManager): void {
    if (BackupPanel.currentPanel) {
      BackupPanel.currentPanel.panel.reveal(); // reutiliza se já aberto
      return;
    }
    // cria novo painel
    BackupPanel.currentPanel = new BackupPanel(...);
  }

  private onDidDispose(): void {
    BackupPanel.currentPanel = undefined; // limpa referência ao fechar
  }
}
```

Isso garante que apenas um painel de gerenciamento de backups exista por vez — o comportamento esperado pelo usuário.

> **`retainContextWhenHidden: true` obrigatório:** ao criar o `WebviewPanel`, use `retainContextWhenHidden: true` nas opções. Sem essa flag, o VS Code **destrói o JavaScript do WebView** sempre que o painel é ocultado (ex: usuário muda para outra aba) e o recria ao revelar — perdendo toda seleção de checkboxes e o estado atual da lista. O `statsPanel.ts` já usa essa opção e o `BackupPanel` deve seguir o mesmo padrão, pois é stateful.
>
> ```typescript
> vscode.window.createWebviewPanel(
>   'backupPanel',
>   'MyTimeTrace — Gerenciamento de Backups',
>   vscode.ViewColumn.One,
>   {
>     enableScripts: true,
>     retainContextWhenHidden: true  // OBRIGATÓRIO — painel stateful
>   }
> );
> ```

**Atualização em tempo real — `FileSystemWatcher`:**

Para detectar mudanças externas na pasta de destino (usuário deleta um arquivo manualmente no explorador do sistema), o painel deve registrar um `FileSystemWatcher`:

```typescript
// IMPORTANTE: passar vscode.Uri.file(destinationPath), não a string direta.
// RelativePattern com string funciona apenas para pastas dentro do workspace atual.
// A pasta de backup tipicamente está FORA do workspace — Uri é o único modo confiável.
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(vscode.Uri.file(destinationPath), '*.sqlite')
);
watcher.onDidCreate(() => this.refresh());
watcher.onDidDelete(() => this.refresh());
```

O watcher é descartado quando o painel é fechado (`panel.onDidDispose`). Sem ele, a tabela só atualiza em resposta a ações internas da extensão — arquivos deletados externamente passariam despercebidos até o próximo backup.

**Protocolo de mensagens WebView ↔ Extensão:**

O `BackupPanel` usa dois canais, seguindo o mesmo padrão de `statsPanel.ts`:

| Direção | Método | Comandos |
|---|---|---|
| Extensão → WebView | `panel.webview.postMessage(msg)` | `refreshBackups`, `backupStarted`, `backupFinished` |
| WebView → Extensão | `panel.webview.onDidReceiveMessage(msg)` | `deleteBackup`, `deleteSelected`, `triggerBackup`, `openWizard`, `openFolder` |

```typescript
// Extensão → WebView: atualiza lista e status após evento
this.panel.webview.postMessage({
  command: 'refreshBackups',
  backups: backupFileList,   // array de { name, size, createdAt }
  status: backupManager.getStatus()
});

// WebView → Extensão: usuário clicou em ação
panel.webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'deleteBackup':
      // fs.promises.unlink(message.fileName) + postMessage refresh
      break;
    case 'triggerBackup':
      backupManager.triggerManualBackup();
      break;
  }
});
```

O `refresh()` interno do painel lê a pasta de destino, monta o array de backups e chama `postMessage` com `refreshBackups`. Esse método é chamado pelo `FileSystemWatcher`, pelos handlers de exclusão e pelo `BackupManager` após cada backup concluído.

## Requisitos Não Funcionais

- Não bloquear o uso da extensão.
- Usar SQLite Backup API para garantir cópia segura com banco aberto.
- Backup só executa com o VS Code aberto (sem daemon externo).
- Ter baixo custo de CPU e disco.
- Ter logs claros para debug.
- Ser seguro contra sobrescrita sem aviso.
- Ser compatível com Windows, macOS e Linux (usar `path.join()` para caminhos).

## UX / UI

### Configurações do Usuário (VS Code Settings)

**Valores no `settings.json` do usuário:**

```json
{
  "myTimeTraceVSCode.backup.enabled": true,
  "myTimeTraceVSCode.backup.intervalHours": 4,
  "myTimeTraceVSCode.backup.maxBackups": 10,
  "myTimeTraceVSCode.backup.destinationPath": "",
  "myTimeTraceVSCode.backup.github.enabled": false,
  "myTimeTraceVSCode.backup.github.repository": ""
}
```

**Schema no `package.json` (contributes.configuration) — deve ser adicionado com todos os campos para que apareça corretamente na UI de configurações do VS Code:**

```json
"myTimeTraceVSCode.backup.enabled": {
  "type": "boolean",
  "default": true,
  "markdownDescription": "Ativa ou pausa o backup automático. Quando `false`, o agendamento é suspenso, mas o backup manual via comando continua disponível."
},
"myTimeTraceVSCode.backup.intervalHours": {
  "type": "number",
  "default": 4,
  "minimum": 1,
  "markdownDescription": "Intervalo entre backups automáticos em horas. Mínimo: `1`. Recomendado: `4` ou `8`."
},
"myTimeTraceVSCode.backup.maxBackups": {
  "type": "number",
  "default": 10,
  "minimum": 3,
  "markdownDescription": "Número máximo de arquivos de backup retidos na pasta de destino. Ao atingir o limite, o mais antigo é removido automaticamente. Mínimo: `3`."
},
"myTimeTraceVSCode.backup.destinationPath": {
  "type": "string",
  "default": "",
  "markdownDescription": "Caminho absoluto da pasta onde os backups serão salvos. **Recomendado:** use o comando `MyTimeTrace: Configurar Backup` para definir via seletor de pasta — evita erros de digitação."
},
"myTimeTraceVSCode.backup.github.enabled": {
  "type": "boolean",
  "default": false,
  "markdownDescription": "Indica se o backup offsite no GitHub está ativo. Configure via `MyTimeTrace: Configurar Backup no GitHub`."
},
"myTimeTraceVSCode.backup.github.repository": {
  "type": "string",
  "default": "",
  "markdownDescription": "Nome do repositório GitHub privado criado para os backups. Definido automaticamente pelo wizard de configuração."
}
```

- `enabled`: ativa ou pausa o backup automático.
- `intervalHours`: intervalo entre backups em horas (mínimo: 1).
- `maxBackups`: número máximo de backups retidos na pasta (mínimo: 3, padrão: 10).
- `destinationPath`: caminho absoluto da pasta onde os backups serão salvos. **Recomendado usar o wizard** (`MyTimeTrace: Configurar Backup`) para definir esse valor, pois ele abre o seletor de pasta do sistema e evita erros de digitação. Se preenchido manualmente, use o caminho completo conforme o seu sistema operacional:

  | Sistema | Exemplo de caminho válido |
  |---|---|
  | Windows | `C:\Users\SeuNome\Documents\MyTimeTrace\Backups` |
  | macOS | `/Users/SeuNome/Documents/MyTimeTrace/Backups` |
  | Linux | `/home/SeuNome/documentos/mytimetrace/backups` |

  **Orientações para leigos:**
  - Crie uma pasta dedicada para os backups. Não use a área de trabalho nem pastas de sistema (`C:\Windows`, `/usr`, `/etc`).
  - O caminho deve começar com a letra do disco no Windows (`C:\`) ou com `/` no macOS e Linux.
  - Use barras invertidas `\` no Windows e barras normais `/` no macOS e Linux.
  - A pasta precisa existir antes de salvar a configuração, ou a extensão tentará criá-la automaticamente.
  - Se a pasta estiver em um pendrive ou HD externo, o backup pausará automaticamente quando o dispositivo for desconectado.

- `github.enabled`: indica se o backup offsite no GitHub está ativo (Fase 4).
- `github.repository`: nome do repositório privado criado para os backups (Fase 4).

**Estado interno (não exposto no settings.json):**
- `github.notificationDismissed`: flag persistida via `context.globalState` (API nativa do VS Code para estado interno da extensão). É `true` quando o usuário clicou em "Não perguntar novamente". Não aparece no settings.json porque não é uma preferência do usuário — é estado interno da extensão.
- O token PAT do GitHub é armazenado no `context.secrets` (VS Code Secret Storage, mesmo mecanismo da API Key atual), nunca em texto plano.

### Tela de Gerenciamento de Backups

A extensão expõe um painel **WebView** dedicado (`BackupPanel` com padrão `createOrShow`) para visualizar e gerenciar todos os backups existentes na pasta de destino.

#### Layout Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│  MyTimeTrace — Gerenciamento de Backups                             │
├──────────────┬──────────────────────────────────────────────────────┤
│  STATUS      │  Estado: ● Ativo  |  Último: 21/05/2026 14:30        │
│              │  Próximo: 21/05/2026 18:30  (em 4h)         [Fase 2] │
├──────────────┴──────────────────────────────────────────────────────┤
│  AÇÕES GLOBAIS                                                       │
│  [▶ Fazer Backup Agora]  [⚙ Configurar Backup]  [☁ GitHub]          │
│  [🗑 Excluir Selecionados ─ desabilitado sem seleção]  [↗ Abrir Pasta]│
├─────────────────────────────────────────────────────────────────────┤
│  LISTA DE BACKUPS                               Exibindo 4 de 4     │
│  ┌──┬────────────────────────────────┬───────────┬───────┬────────┐ │
│  │☐ │ Nome do arquivo                │ Data/Hora │ Tam.  │ Ações  │ │
│  ├──┼────────────────────────────────┼───────────┼───────┼────────┤ │
│  │☐ │ time_tracker_2026-05-21_14-30  │ 21/05 14h │ 1,2MB │ [🗑]  │ │
│  │☐ │ time_tracker_2026-05-21_10-30  │ 21/05 10h │ 1,1MB │ [🗑]  │ │
│  │☐ │ time_tracker_2026-05-20_22-30  │ 20/05 22h │ 1,1MB │ [🗑]  │ │
│  │☐ │ time_tracker_2026-05-20_18-30  │ 20/05 18h │ 1,0MB │ [🗑]  │ │
│  └──┴────────────────────────────────┴───────────┴───────┴────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### Bloco de Status

| Elemento | Descrição | Fase |
|---|---|---|
| Indicador de estado | Badge colorido: `● Ativo` (verde) / `⏸ Pausado` (cinza) / `✕ Falha` (vermelho) | 1 |
| Último backup | Data e hora do backup mais recente concluído com sucesso | 1 |
| Próximo backup | Data e hora estimada do próximo ciclo automático | 2 |
| Mensagem de erro | Exibida abaixo do estado quando houver falha, com texto descritivo | 1 |

#### Botões de Ação Global

| Botão | Comportamento | Fase |
|---|---|---|
| **Fazer Backup Agora** | Executa backup imediato (RF07). Desabilita o botão durante a execução e exibe indicador de progresso | 1 |
| **Configurar Backup** | Abre o wizard de configuração completo (RF08), permitindo redefinir pasta, intervalo e retenção | 1 |
| **GitHub** | Abre o wizard de configuração do backup offsite no GitHub. Se já configurado, abre tela de status da integração | 4 |
| **Excluir Selecionados** | Habilitado apenas quando pelo menos um backup estiver selecionado. Exibe diálogo de confirmação antes de excluir | 1 |
| **Abrir Pasta** | Abre a pasta de destino no explorador de arquivos do sistema operacional | 1 |

#### Tabela de Backups

A tabela lista todos os arquivos `.sqlite` encontrados na pasta de destino, ordenados do mais recente ao mais antigo.

**Colunas:**

| Coluna | Conteúdo | Observação |
|---|---|---|
| Checkbox | Seleção individual para ações em lote | Cabeçalho com "selecionar todos" |
| Nome do arquivo | `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite` | Exibido sem extensão na UI para compacidade |
| Data/Hora | Data e hora de criação do backup formatadas de acordo com o locale do sistema | |
| Tamanho | Tamanho do arquivo em KB ou MB | |
| Ações | Botão `🗑` para exclusão individual | |

**Comportamento da tabela:**

- A tabela é atualizada automaticamente após cada backup concluído, excluído ou restaurado.
- Se a pasta de destino estiver vazia ou inacessível, exibe mensagem de estado vazio: *"Nenhum backup encontrado. Clique em 'Fazer Backup Agora' para criar o primeiro."*
- O backup mais recente recebe um badge `● atual` para identificação visual rápida.

#### Fluxo de Exclusão Individual

1. Usuário clica em `🗑` na linha do backup.
2. Diálogo de confirmação: *"Excluir `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite`? Esta ação não pode ser desfeita."*
3. Opções: **Excluir** / **Cancelar**.
4. Ao confirmar: arquivo removido, tabela atualizada, log registrado.
5. Se o número de backups restantes ficar abaixo do mínimo de retenção (3), a extensão exibe aviso: *"Atenção: você está abaixo do mínimo recomendado de 3 backups."* — mas não bloqueia a exclusão, pois a exclusão aqui é ação explícita do usuário, diferente da política de retenção automática.

#### Fluxo de Exclusão em Lote

1. Usuário marca um ou mais checkboxes. O botão **Excluir Selecionados** é habilitado e exibe a contagem: *"Excluir Selecionados (3)"*.
2. Ao clicar, diálogo de confirmação: *"Excluir 3 backups selecionados? Esta ação não pode ser desfeita."*
3. Opções: **Excluir** / **Cancelar**.
4. Ao confirmar: arquivos removidos em sequência, tabela atualizada, log registrado para cada remoção.
5. Mesmo aviso de retenção mínima se aplicável (sem bloqueio).

#### Fluxo do Botão "Configurar Backup"

Abre o wizard de RF08 já preenchido com os valores atuais, permitindo que o usuário altere qualquer campo. Ao concluir, os novos valores são salvos no `settings.json` e o agendador é reiniciado com o novo intervalo.

#### Fluxo do Botão "GitHub"

- **Se não configurado:** inicia o wizard de configuração do backup offsite (Fase 4, RF equivalente). Botão exibido com texto *"Configurar Backup no GitHub"*.
- **Se já configurado:** abre tela de status da integração com GitHub, exibindo repositório vinculado, último push e opção de desconectar. Botão exibido com texto *"GitHub: Conectado ✓"*.

### Saídas Na UI (Resumo)

- Painel de gerenciamento com tabela de backups, ações globais e bloco de status.
- Badge de estado: ativo, pausado, falha.
- Data e hora do último backup concluído.
- Data e hora do próximo backup agendado (Fase 2).
- Botão de backup manual sempre visível e clicável.
- Botão de abrir pasta de destino.
- Seleção múltipla com exclusão em lote confirmada.
- Botão de reconfiguração do backup automático (wizard).
- Botão de configuração/reconfiguração do backup no GitHub (Fase 4).

### Comandos da Extensão

Todos os comandos ficam disponíveis na paleta de comandos do VS Code (`Ctrl+Shift+P`).

| Título (paleta) | ID do comando | Descrição | Fase |
|---|---|---|---|
| `MyTimeTrace: Gerenciar Backups` | `my-time-trace-vscode.manageBackups` | Abre o painel WebView de gerenciamento de backups (tabela, exclusão, ações globais) — RF09 | 1 |
| `MyTimeTrace: Fazer Backup Agora` | `my-time-trace-vscode.backupNow` | Executa um backup imediato, independente do agendamento | 1 |
| `MyTimeTrace: Configurar Backup` | `my-time-trace-vscode.configureBackup` | Inicia o wizard guiado de configuração inicial (pasta, intervalo, retenção). Pode ser usado também para reconfigurar | 1 |
| `MyTimeTrace: Abrir Pasta de Backup` | `my-time-trace-vscode.openBackupFolder` | Abre no explorador de arquivos do sistema a pasta de destino configurada | 1 |
| `MyTimeTrace: Editar Configurações de Backup` | `my-time-trace-vscode.editBackupSettings` | Abre diretamente a seção de backup nas configurações do VS Code (`settings.json`) | 1 |
| `MyTimeTrace: Pausar Backup Automático` | `my-time-trace-vscode.pauseBackup` | Pausa o agendamento automático (equivale a `backup.enabled = false`) | 2 |
| `MyTimeTrace: Retomar Backup Automático` | `my-time-trace-vscode.resumeBackup` | Retoma o agendamento pausado (equivale a `backup.enabled = true`) | 2 |
| `MyTimeTrace: Configurar Backup no GitHub` | `my-time-trace-vscode.configureGithubBackup` | Inicia o fluxo assistido de configuração do backup offsite no GitHub | 4 |

> Os IDs seguem o padrão `my-time-trace-vscode.*` já adotado pelo projeto. São necessários no `package.json` (contributes.commands), no `backupCommands.ts` (registro via `safeRegisterCommand`) e em qualquer `vscode.commands.executeCommand()` invocado dentro do painel WebView.

## Regras De Produto

- Backup não deve rodar com a UI travada.
- O backup só executa enquanto o VS Code estiver aberto. Não há daemon externo.
- O backup é completamente independente do sync em nuvem: desativar o sync não afeta o backup, e vice-versa.
- Na inicialização, se o intervalo já tiver sido ultrapassado, o backup roda imediatamente antes de aguardar o próximo ciclo.
- O usuário pode pausar e retomar o backup via setting `backup.enabled`.
- Se a pasta de destino não existir ou não for acessível, a extensão avisa e pausa o ciclo.
- Em falha, preservar todos os backups anteriores.
- Ao atingir o limite de retenção, remover o mais antigo antes de criar o novo.
- O número mínimo de backups retidos é 3. A extensão não aceita valor menor.

## Lógica de Inicialização

Ao iniciar o VS Code, o `BackupManager` aguarda `BACKUP_INITIAL_DELAY` (2 minutos) antes de executar qualquer verificação. Isso evita sobrecarga no startup enquanto `DatabaseManager`, `SyncManager` e o engine de tracking ainda estão inicializando — mesmo padrão do `CLEANUP_INITIAL_DELAY` já existente no projeto.

Após o delay, executa a seguinte verificação:

```
0. Aguardar BACKUP_INITIAL_DELAY (2 minutos) após activate()

1. backup.enabled = true?
   └── Não → encerra, não agenda nada

2. destinationPath configurado?
   └── Não → dispara wizard de configuração completo (RF08)
              → ao concluir o wizard, reinicia este fluxo do passo 1

3. Existe algum backup anterior na pasta de destino?
   ├── Não → executa backup imediatamente (primeiro backup)
   └── Sim → lê timestamp do último backup em sync_metadata (chave backup.lastTimestamp)
               ├── Timestamp ausente no sync_metadata?
               │   (ocorre em reinstalação, migração ou cópia manual de arquivos)
               │   └── trata como se último backup = nunca → executa backup imediatamente
               └── Timestamp presente → (agora - último backup) > intervalHours?
                   ├── Sim → executa backup imediatamente (backup perdido enquanto VS Code estava fechado)
                   └── Não → agenda próximo backup via scheduleNext() para (último backup + intervalHours)
```

Essa lógica garante que um backup nunca seja pulado silenciosamente: se o VS Code ficou fechado durante o horário em que o backup deveria ter rodado, ele é executado assim que o VS Code abre (após o delay inicial). Em caso de dúvida (timestamp ausente), a decisão segura é sempre executar o backup.

## Fluxo Esperado

```mermaid
flowchart TD
  A[VS Code abre / activate] --> DELAY[Aguarda BACKUP_INITIAL_DELAY 2min]
  DELAY --> B{backup.enabled?}
  B -- Não --> Z[Encerra]
  B -- Sim --> W{destinationPath configurado?}
  W -- Não --> X[Dispara wizard de configuração]
  X --> B
  W -- Sim --> C{Existe backup anterior?}
  C -- Não --> E
  C -- Sim --> D{Timestamp em sync_metadata?}
  D -- Ausente --> E
  D -- Presente --> D2{Tempo desde último backup > intervalo?}
  D2 -- Sim --> E
  D2 -- Não --> F[scheduleNext: setTimeout até próximo horário]
  F --> G{Timeout atingido?}
  G -- Não --> G
  G -- Sim --> E
  E[Verifica isBackingUp]
  E --> E2{isBackingUp?}
  E2 -- Sim --> SKIP[Ignora — backup em andamento]
  E2 -- Não --> CLEANUP[Limpa *.sqlite.tmp órfãos da pasta]
  CLEANUP --> DISK[Verifica espaço em disco via statfs]
  DISK --> DISK2{Espaço suficiente?}
  DISK2 -- Não --> DISKERR[Erro: espaço insuficiente]
  DISKERR --> L
  DISK2 -- Sim --> EX[VACUUM INTO *.sqlite.tmp via db.run]
  EX --> H{VACUUM INTO com sucesso?}
  H -- Não --> L
  H -- Sim --> REN[Renomeia .tmp → .sqlite final]
  REN --> QC[PRAGMA quick_check no arquivo gerado]
  QC --> QC2{quick_check = ok?}
  QC2 -- Não --> QCFAIL[Remove arquivo corrompido + lança erro]
  QCFAIL --> L
  QC2 -- Sim --> I[Salva timestamp em sync_metadata]
  I --> J[Aplica política de retenção]
  J --> K[Atualiza painel e badge de estado]
  K --> F2[setInterval para próximos ciclos]
  F2 --> G
  L[BackupRetryManager.execute retenta]
  L --> M{Tentativas esgotadas?}
  M -- Não --> CLEANUP
  M -- Sim --> N[Persiste lastError em sync_metadata]
  N --> N2[showErrorMessage + badge Falha no painel]
  N2 --> F2
```

## Premissas Técnicas

- O `BackupManager` e o `SyncManager` são módulos completamente independentes. Não compartilham scheduler, não se comunicam e não interferem um no outro.
- O `sync_metadata` (key-value store SQLite existente em `database.ts`) será usado para persistir o estado do backup entre reinícios. As chaves reservadas para o `BackupManager` são:

  | Chave | Tipo | Descrição |
  |---|---|---|
  | `backup.lastTimestamp` | ISO 8601 string | Data/hora do último backup concluído com sucesso |
  | `backup.nextScheduled` | ISO 8601 string | Data/hora do próximo backup agendado (Fase 2) |
  | `backup.state` | `"active"` \| `"paused"` \| `"failed"` | Estado atual do agendador |
  | `backup.lastError` | string | Mensagem do último erro registrado (vazio se sem falha) |

  Essas chaves não colidem com as chaves existentes do `SyncManager` (`sync.config`, `sync.lastPush`, etc.) pois usam prefixo distinto.

  > **UTC vs hora local:** os valores em `sync_metadata` são armazenados em UTC (ISO 8601). O **nome do arquivo** de backup usa hora local (`time_tracker_2026-05-21_17-00-00.sqlite` em UTC-3 = 20h UTC). Isso é intencional: o nome legível pelo usuário reflete o horário local, enquanto o timestamp interno é inequívoco para comparações. A política de retenção e os cálculos de intervalo devem operar sempre sobre os timestamps ISO 8601 do `sync_metadata` — nunca sobre o nome do arquivo para cálculos de tempo, e nunca sobre `mtime` do filesystem.

- **Delay inicial obrigatório:** na inicialização, o `BackupManager` aguarda `BACKUP_INITIAL_DELAY` (definido em `constants.ts`) antes de executar qualquer verificação ou backup. Isso evita sobrecarga no startup do VS Code enquanto `DatabaseManager`, `SyncManager` e o engine de tracking ainda estão inicializando.

  > **Referência de implementação direta:** o `extension.ts` já implementa esse padrão exato em `cleanupExpiredProjects()` (linhas ~152–201): `setTimeout(async () => { await dbManager.cleanupExpiredProjects(); }, CLEANUP_INITIAL_DELAY)` seguido de `setInterval(async () => { await dbManager.cleanupExpiredProjects(); }, CLEANUP_INTERVAL)`. O `BackupManager.initialize()` deve seguir esse mesmo padrão — estudar aquela implementação antes de escrever o scheduler evita reinventar a roda e garante consistência com o projeto.

- **Estratégia de timer (Fase 2):** o agendador **não usa `setInterval` puro com o intervalo total em horas** — isso causaria drift e não sobrevive a mudanças de configuração em tempo real. O padrão correto é `setTimeout` para o próximo backup calculado + `setInterval` para os ciclos subsequentes:

  ```typescript
  private scheduleNext(intervalMs: number): void {
    const delayMs = this.getNextBackupDelay(intervalMs); // tempo até o próximo
    this.backupTimer = setTimeout(async () => {
      await this.performBackup(); // await obrigatório: setInterval só inicia após o backup concluir
      this.backupTimer = setInterval(() => this.performBackup(), intervalMs);
    }, delayMs);
  }
  ```

  > O callback do `setTimeout` deve ser `async` e `performBackup()` deve ser aguardado. Sem `await`, o `setInterval` é registrado imediatamente ao *iniciar* o primeiro backup — se ele demorar, o intervalo dispara com o backup ainda em andamento. O `isBackingUp` previne execução dupla, mas o alinhamento dos ciclos fica incorreto.

  Quando o usuário mudar o intervalo em `settings.json`, o `BackupManager` chama `clearTimeout/clearInterval` e `scheduleNext()` com o novo valor.

- **Registro de timer em `context.subscriptions`:** seguindo o padrão do projeto em `extension.ts`, o timer do `BackupManager` deve ser registrado como disposable:

  ```typescript
  context.subscriptions.push({ dispose: () => backupManager.dispose() });
  ```

  Isso garante cleanup automático mesmo em cenários onde `deactivate()` não é chamado explicitamente.

  > **Atenção ao `deactivate()` existente:** o `deactivate()` atual em `extension.ts` chama manualmente `myTimeTrace.dispose()` e `statusBarManager.dispose()`, duplicando o que já está em `context.subscriptions` — é código legado. O `BackupManager` **não deve** ser adicionado ao `deactivate()`. Registrar apenas em `context.subscriptions` é suficiente e é o padrão correto a seguir daqui em diante.

- **`onDidChangeConfiguration` — como registrar (Fase 2):** o projeto não usa `onDidChangeConfiguration` em nenhum módulo existente (o `SyncManager` recebe configuração do servidor). Para o `BackupManager` reagir a mudanças em `myTimeTraceVSCode.backup.intervalHours` e `myTimeTraceVSCode.backup.enabled` em tempo real, registre o listener em `extension.ts` logo após instanciar o `BackupManager`:

  ```typescript
  const backupConfigListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('myTimeTraceVSCode.backup')) {
      backupManager.onConfigChange();
    }
  });
  context.subscriptions.push(backupConfigListener);
  ```

  O método `onConfigChange()` dentro do `BackupManager` lê as novas configurações via `vscode.workspace.getConfiguration()`, cancela o timer atual (`clearTimeout` / `clearInterval`) e chama `scheduleNext()` com o novo intervalo.

  > **Debounce obrigatório em `onConfigChange()`:** o usuário pode salvar o `settings.json` várias vezes em sequência enquanto digita o `destinationPath`. Cada save dispara `onDidChangeConfiguration` → `onConfigChange()` → cancelamento + recriação de timers. Sem debounce, timers são destruídos e recriados em cascata. Implementar com delay de 500ms:
  > ```typescript
  > private configChangeTimer: NodeJS.Timeout | undefined;
  > public onConfigChange(): void {
  >   clearTimeout(this.configChangeTimer);
  >   this.configChangeTimer = setTimeout(() => this.applyConfigChange(), 500);
  > }
  > ```

- **Método `getStatus()`:** o `BackupManager` deve expor um método `getStatus()` análogo ao do `SyncManager`, retornando o estado atual para ser consultado pelos comandos e pelo painel:

  ```typescript
  getStatus(): {
    state: 'active' | 'paused' | 'failed';
    isBacking: boolean;              // true enquanto performBackup() estiver em execução
    lastBackupAt: string | null;     // ISO 8601
    nextBackupAt: string | null;     // ISO 8601 — Fase 2
    lastError: string | null;
    destinationPath: string;
  }
  ```

  > **Por que `isBacking` em `getStatus()` e não expor `isBackingUp` diretamente:** `isBackingUp` é `private` — não pode ser lida fora do `BackupManager`. O painel precisa saber se backup está em andamento para desabilitar o botão "Fazer Backup Agora". Incluir `isBacking` em `getStatus()` é a forma correta de expor esse estado sem quebrar o encapsulamento. O `triggerManualBackup()` já tem sua própria mensagem de "já em andamento" — o `isBacking` serve apenas para a UI refletir o estado em tempo real.

- **Path do banco de origem:** o `BackupManager` precisa do caminho absoluto do `time_tracker.sqlite` para executar `VACUUM INTO`. Esse path é construído internamente pelo `DatabaseManager` como `path.join(storagePath, 'time_tracker.sqlite')`. Para expô-lo sem quebrar o encapsulamento, adicionar ao `DatabaseManager` o método:

  ```typescript
  getDbPath(): string {
    return this.dbPath; // salvo no initialize() como propriedade privada
  }
  ```

  O `BackupManager` recebe uma instância de `DatabaseManager` no construtor e chama `getDbPath()` para obter a origem do backup. Não deve receber `context.globalStorageUri.fsPath` diretamente — isso duplicaria a lógica de construção de path que já existe no `DatabaseManager`.

- **Mutex de backup concorrente (`isBackingUp`):** o `BackupManager` deve manter uma flag `private isBackingUp = false` para evitar backups simultâneos (ex: backup automático + manual ao mesmo tempo). Qualquer chamada a `performBackup()` deve verificar e setar essa flag:

  ```typescript
  private async performBackup(): Promise<void> {
    if (this.isBackingUp) {
      console.log('Backup já em andamento — operação ignorada.');
      return;
    }
    this.isBackingUp = true;
    try {
      /* lógica de backup */
    } catch (err) {
      // OBRIGATÓRIO: capturar aqui — performBackup() nunca deve rejeitar.
      // Quando chamado pelo setInterval, a Promise retornada é descartada;
      // uma rejeição não capturada gera UnhandledPromiseRejection no Node.js.
      console.error('Backup falhou:', err);
      await this.handleBackupError(err);
    } finally {
      this.isBackingUp = false;
    }
  }
  ```

  > **`performBackup()` nunca deve lançar exceção.** O `setInterval` descarta a Promise retornada — qualquer rejeição não capturada emite `UnhandledPromiseRejection`, que em Node.js moderno encerra o processo. Todo o tratamento de erro (log, `showErrorMessage`, atualização de estado) deve ocorrer **dentro** do `catch`, não ser propagado para o caller.

  O botão "Fazer Backup Agora" no painel deve ser desabilitado visualmente enquanto `isBackingUp` for `true`.

- **Método público para acionar backup externo:** `performBackup()` deve ser `private` para encapsular o mutex. Expor um método público separado para uso pelos comandos e pelo wizard:

  ```typescript
  public async triggerManualBackup(): Promise<void> {
    if (this.isBackingUp) {
      vscode.window.showInformationMessage('Backup já em andamento.');
      return;
    }
    await this.performBackup();
  }
  ```

  `backupCommands.ts` chama `backupManager.triggerManualBackup()`. O agendador interno chama `this.performBackup()` diretamente. Nunca expor `performBackup()` como público — o mutex seria contornável.

- **Método `handleBackupError(err)` (privado):** chamado exclusivamente pelo `catch` de `performBackup()`. Centraliza todo o tratamento de falha — sem este método explícito, o implementador tende a colocar a lógica diretamente no `catch`, dificultando testes isolados do caminho de erro:

  ```typescript
  private async handleBackupError(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    await this.databaseManager.setMetadata('backup.lastError', message);
    await this.databaseManager.setMetadata('backup.state', 'failed');
    vscode.window.showErrorMessage(`MyTimeTrace: Backup falhou — ${message}`);
    BackupPanel.currentPanel?.refresh(); // notifica o painel se estiver aberto
  }
  ```

- **Notificação `BackupManager` → `BackupPanel` (mecanismo):** quando um backup automático (via `setInterval`) termina, o painel precisa atualizar a lista e o badge. O `BackupManager` **não deve** receber uma referência explícita ao `BackupPanel` no construtor — isso geraria acoplamento bidirecional. A solução é usar a referência estática já existente:

  ```typescript
  // Ao final de cada backup bem-sucedido (e dentro de handleBackupError):
  BackupPanel.currentPanel?.refresh();
  ```

  `BackupPanel.currentPanel` é `undefined` quando o painel está fechado — o operador `?.` garante que a chamada é silenciosa nesse caso, sem necessidade de callbacks ou sistema de eventos.

- **Método `pauseScheduler()` (público):** referenciado no fluxo de restauração (Fase 2, passo 3). Deve ser `public` pois é chamado externamente. Responsabilidades:
  1. Cancelar timers ativos: `clearTimeout` + `clearInterval` no mesmo handle (o tipo muda ao longo do ciclo entre `setTimeout` → `setInterval`).
  2. Persistir `backup.state = 'paused'` em `sync_metadata`.
  3. **Não** alterar `backup.enabled` no `settings.json` — esse campo é preferência do usuário; `pauseScheduler()` é pausa programática temporária da extensão (ex: durante restauração).

  ```typescript
  public async pauseScheduler(): Promise<void> {
    clearTimeout(this.backupTimer as NodeJS.Timeout);
    clearInterval(this.backupTimer as NodeJS.Timeout);
    this.backupTimer = undefined;
    await this.databaseManager.setMetadata('backup.state', 'paused');
  }
  ```

- **Convenção de log do `BackupManager`:** o projeto usa `console.log/error/warn` sem prefixo ou timestamp. O `BackupManager` deve usar o prefixo `[BackupManager]` em todas as chamadas de log para filtrar saída no DevTools do VS Code (`Help → Toggle Developer Tools`). Falhas de backup ocorrem frequentemente em horários sem usuário ativo — o contexto no log é a única forma de debug post-mortem:
  ```
  console.log('[BackupManager] Backup iniciado →', finalDestPath);
  console.error('[BackupManager] VACUUM INTO falhou:', err.message);
  console.log('[BackupManager] Backup concluído em', duration, 'ms, tamanho:', sizeKb, 'KB');
  ```

- A cópia do banco usa `VACUUM INTO` via `db.run()` do pacote npm `sqlite3` (ver RF02). Não usar `fs.copyFile()` — falha com banco aberto.
- O `BackupRetryManager` seguirá a mesma arquitetura do `SyncRetryManager` existente (`src/modules/syncRetryManager.ts`), com os mesmos métodos públicos `execute()` e `updateConfig()`. O método `notifyFailure()` é **privado** em ambos — implementação interna chamada por `execute()` após esgotar as tentativas. No `BackupRetryManager`, `notifyFailure()` deve oferecer a opção "Tentar Novamente" via `vscode.commands.executeCommand('my-time-trace-vscode.backupNow')` (equivalente ao `syncNow` usado pelo `SyncRetryManager`).
- Configurações de backup ficam em VS Code local settings (`settings.json`), completamente independentes das configurações de sync vindas do servidor.
- O backup só roda com o VS Code aberto. Não há daemon ou processo externo.
- Constantes fixas do backup devem ser declaradas em `src/config/constants.ts`, seguindo o padrão existente:

  | Constante | Valor | Descrição |
  |---|---|---|
  | `BACKUP_MIN_RETENTION` | `3` | Mínimo de backups retidos pela política automática |
  | `BACKUP_DEFAULT_INTERVAL_HOURS` | `4` | Intervalo padrão em horas |
  | `BACKUP_MAX_RETRIES` | `3` | Tentativas do `BackupRetryManager` |
  | `BACKUP_RETRY_DELAY_MS` | `30000` | Delay entre tentativas (30s) |
  | `BACKUP_INITIAL_DELAY` | `2 * 60 * 1000` | Delay antes da primeira verificação no startup (2 min) |

## Dependências Prováveis

**Módulos existentes reutilizados:**
- `src/modules/database.ts` — `DatabaseManager`: acesso ao SQLite, ao `sync_metadata` (métodos `getMetadata()` / `setMetadata()`), e ao path do banco via `getDbPath()` (método a ser adicionado).
- `src/modules/syncRetryManager.ts` — modelo direto para o `BackupRetryManager` (mesma interface pública).
- `src/modules/apiKeyManager.ts` — modelo de uso do `context.secrets` para o token PAT do GitHub (Fase 4).
- `src/ui/cssLoader.ts` — `CssLoader.loadDashboardStyles()`: carregamento de CSS externo para o painel WebView, seguindo o padrão de `statsPanel.ts` e `deletedProjectsPanel.ts`. O `BackupPanel` deve usar o mesmo mecanismo para consistência visual.

**APIs do VS Code:**
- `vscode.workspace.getConfiguration()` — leitura das settings `myTimeTraceVSCode.backup.*`.
- `vscode.workspace.onDidChangeConfiguration()` — reação a mudanças nas settings em tempo real.
- `context.globalState` — persistência de estado interno como `backup.github.notificationDismissed`.
- `context.secrets` — armazenamento seguro do token PAT do GitHub (Fase 4).
- `vscode.window.showOpenDialog()` — file picker nativo para seleção da pasta de destino no wizard. Retorna `vscode.Uri[] | undefined` — extrair `.fsPath` do primeiro elemento para obter string de path:
  ```typescript
  const folders = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Selecionar pasta de backup'
  });
  if (!folders || folders.length === 0) return; // usuário cancelou
  const destPath = folders[0].fsPath; // Uri → string de path absoluto
  ```
- `vscode.window.showQuickPick()` / `vscode.window.showInputBox()` — UI do wizard (padrão já usado em `commands.ts`).
- `vscode.env.openExternal(vscode.Uri.file(destPath))` — implementação do comando `openBackupFolder`: abre a pasta no explorador de arquivos do SO de forma cross-platform. Não usar `child_process.exec('explorer')` ou similar — não é cross-platform.
- `vscode.commands.executeCommand('workbench.action.openSettings', 'myTimeTraceVSCode.backup')` — implementação do comando `editBackupSettings`: abre a UI de configurações do VS Code já filtrada para a seção de backup.
- **`vscode.workspace.fs` para operações de filesystem (além do `VACUUM INTO`):** as operações de arquivo do `BackupManager` e `BackupPanel` — `mkdir`, `unlink`, `rename`, `readdir`, `stat` — devem usar `vscode.workspace.fs` em vez de `fs.promises` diretamente. Em ambientes remotos (VS Code via SSH, WSL, Dev Containers), `fs.promises` opera no filesystem da máquina onde a extensão roda, que pode ser o servidor remoto — enquanto a pasta de backup está na máquina local do usuário. `vscode.workspace.fs` abstrai isso corretamente. **Exceção:** o `VACUUM INTO` do SQLite usa path nativo e não tem equivalente via `vscode.workspace.fs` — esse passo permanece com path de string. Mapeamento:
  | `fs.promises` | `vscode.workspace.fs` |
  |---|---|
  | `fs.promises.mkdir(p, { recursive: true })` | `vscode.workspace.fs.createDirectory(vscode.Uri.file(p))` |
  | `fs.promises.unlink(p)` | `vscode.workspace.fs.delete(vscode.Uri.file(p))` |
  | `fs.promises.rename(a, b)` | `vscode.workspace.fs.rename(Uri.file(a), Uri.file(b))` |
  | `fs.promises.stat(p)` | `vscode.workspace.fs.stat(vscode.Uri.file(p))` |
  | `fs.existsSync(p)` | `try { await vscode.workspace.fs.stat(Uri.file(p)); return true; } catch { return false; }` |

**Novos arquivos a criar:**
- `src/modules/backupManager.ts` — lógica de backup, agendamento e política de retenção.
- `src/modules/backupRetryManager.ts` — retry com arquitetura idêntica ao `SyncRetryManager`.
- `src/modules/backupCommands.ts` — registro dos comandos de backup (separado de `commands.ts` que já tem 573 LOC); usa `CommandManager.safeRegisterCommand()` de `commands.ts` para registrar os comandos, evitando crash em recarregamento da extensão. A assinatura segue o padrão de `CommandManager.registerSyncCommands()`:

  ```typescript
  export class BackupCommands {
    static registerBackupCommands(
      context: vscode.ExtensionContext,
      backupManager: BackupManager
    ): vscode.Disposable[] { ... }
  }
  ```

  Apenas `context` e `backupManager` são necessários: `databaseManager`, `myTimeTrace` e `storagePath` são injetados no construtor do `BackupManager`, que os encapsula internamente (especialmente para `restoreFromBackup()`). Registrado em `extension.ts` como:

  ```typescript
  const backupCmds = BackupCommands.registerBackupCommands(context, backupManager);
  context.subscriptions.push(...backupCmds);
  ```
- `src/ui/backupPanel.ts` — painel WebView de gerenciamento (padrão `statsPanel.ts` / `deletedProjectsPanel.ts`).

**Arquivos existentes a modificar:**
- `src/extension.ts` — instanciar `BackupManager` após `BACKUP_INITIAL_DELAY` e registrar via `context.subscriptions.push({ dispose: () => backupManager.dispose() })`; registrar também o listener `onDidChangeConfiguration` (Fase 2) via `context.subscriptions`. **Não** adicionar `BackupManager` ao `deactivate()` — o `context.subscriptions` é suficiente e é o padrão correto.
- `src/config/constants.ts` — adicionar constantes do backup (`BACKUP_MIN_RETENTION`, `BACKUP_DEFAULT_INTERVAL_HOURS`, `BACKUP_MAX_RETRIES`, `BACKUP_RETRY_DELAY_MS`, `BACKUP_INITIAL_DELAY`).
- `package.json` — adicionar em `contributes.configuration` as 6 settings `myTimeTraceVSCode.backup.*` e em `contributes.commands` os novos comandos de backup.

## Métricas De Sucesso

- % de backups concluídos com êxito.
- Tempo médio por backup.
- Número de falhas por semana.
- Número de usuários com backup ativo.
- Número de backups manuais vs automáticos.

> **Como coletar essas métricas:** a extensão já possui infraestrutura de sync com `https://mytimetrace.com.br/api`. Em vez de implementar telemetria do zero, eventos anonimizados de backup podem ser enviados via a rota existente como registros de atividade especiais. O projeto já envia `ActivityData` ao servidor — adicionar um tipo de evento `backup_event` (com campos: `event: 'backup_ok' | 'backup_failed'`, `duration_ms: number`, `size_mb: number`, `is_manual: boolean`) reutiliza o pipeline de sync inteiro sem nova infraestrutura. Dados sensíveis (path de destino, nome de arquivo) **nunca** devem ser incluídos — apenas métricas agregadas e anônimas. Esta coleta é opcional e deve respeitar a opção de opt-out do usuário caso exista na plataforma.

## Critérios De Aceite

**Wizard e configuração:**
- O wizard conduz o usuário pelos 4 passos e ao confirmar o primeiro backup é executado imediatamente.
- O usuário consegue definir intervalo, limite de retenção e pasta de destino.
- O wizard reabre preenchido com os valores atuais quando acessado para reconfiguração.

**Execução do backup:**
- O backup roda sem travar a extensão.
- O arquivo gerado tem nome no formato `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite` e é uma cópia válida do banco.
- Cópia feita via SQLite Backup API é íntegra mesmo com banco em uso.
- Se dois backups coincidirem no mesmo segundo, o nome recebe sufixo incremental (`_1`, `_2`).

**Agendamento e recuperação (Fase 2):**
- O status atualiza após cada execução mostrando data/hora do último backup e do próximo.
- Se o VS Code ficou fechado durante o horário do backup, o backup é executado imediatamente ao reabrir.
- Falhas geram log e aviso útil com mensagem descritiva.

**Retenção:**
- Ao atingir o limite de retenção, o backup mais antigo é removido automaticamente (mínimo 3 mantidos).
- O backup manual funciona como alternativa ao agendamento, inclusive com backup automático pausado.

**Painel de gerenciamento (RF09):**
- O painel exibe todos os arquivos `.sqlite` da pasta de destino em tabela ordenada do mais recente ao mais antigo.
- O backup mais recente tem badge `● atual` visível.
- O usuário consegue excluir um backup individual após confirmação.
- O usuário consegue selecionar múltiplos backups e excluí-los em lote após confirmação.
- O botão "Excluir Selecionados" só fica habilitado com ao menos uma seleção ativa.
- Ao excluir com total remanescente abaixo de 3, aviso informativo é exibido sem bloquear a ação.
- A tabela atualiza automaticamente após backup concluído, exclusão ou restauração.
- Com pasta vazia ou inacessível, o painel exibe mensagem orientativa em vez de tabela vazia.

**Integração técnica:**
- `BackupManager` é instanciado no `activate()` após `BACKUP_INITIAL_DELAY` e registrado em `context.subscriptions.push({ dispose: () => backupManager.dispose() })` — o VS Code gerencia o cleanup automaticamente, sem necessidade de chamar `dispose()` manualmente no `deactivate()`.
- `DatabaseManager` expõe `getDbPath()` e o `BackupManager` usa esse método para obter o path de origem do `VACUUM INTO`.
- Backup concorrente é prevenido pela flag `isBackingUp` — tentativa de backup com flag ativa retorna sem executar.
- Settings `myTimeTraceVSCode.backup.*` aparecem na seção de configurações do VS Code com validação de `minimum` e `markdownDescription`.
- Todos os comandos de backup aparecem na paleta de comandos (`Ctrl+Shift+P`).
- Chaves `backup.*` do `sync_metadata` não colidem com chaves existentes do `SyncManager`.

## Riscos

- Pasta de destino removida ou sem permissão durante o ciclo.
- Agenda perdida após restart (mitigado com `sync_metadata`).
- Diferença de fuso entre sistema e config (usar horário do sistema local).
- Crescimento alto do volume de backup (mitigado pela política de retenção).
- Arquivo `.sqlite` corrompido se copiado sem Backup API (mitigado pelo uso da API correta).
- Colisão de nome de arquivo: se um backup automático e um manual coincidirem no mesmo segundo, ambos gerariam o mesmo nome `time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite`. Mitigação: adicionar sufixo incremental quando o arquivo já existir (`_1`, `_2`, etc.).

## Fases Sugeridas

### Fase 1

**Funcionalidades:**
- Wizard de configuração inicial (pasta, intervalo, retenção) — RF08.
- Backup manual via comando `MyTimeTrace: Fazer Backup Agora` usando SQLite Backup API — RF07.
- Painel WebView de gerenciamento de backups com tabela, exclusão individual, exclusão em lote e ações globais — RF09.
- Status simples no painel: badge de estado e data/hora do último backup concluído — RF04 (parcial).
- Retenção básica: apagar o mais antigo ao atingir o limite configurado — RF06.
- Comandos disponíveis: `Gerenciar Backups`, `Fazer Backup Agora`, `Configurar Backup`, `Abrir Pasta de Backup`, `Editar Configurações de Backup`.

> O intervalo é coletado no wizard nesta fase e salvo no `settings.json`, mas o agendamento automático só entra em operação na Fase 2. O campo **"Próximo backup"** no bloco de status do painel deve exibir o texto `"—  (agendamento disponível na próxima versão)"` enquanto o agendador não existir — nunca deixar o campo vazio ou com placeholder genérico, pois o usuário configurou um intervalo e espera ver quando o próximo backup ocorrerá. O badge de estado deve ser `● Ativo` após o primeiro backup bem-sucedido (estado inicial = sistema operacional), `✕ Falha` em caso de erro, e não deve existir estado `Pausado` na Fase 1 (os comandos `Pausar`/`Retomar` são da Fase 2).

**Arquivos a criar:**

| Arquivo | Descrição |
|---|---|
| `src/modules/backupManager.ts` | Lógica de cópia via SQLite Backup API, política de retenção, persistência em `sync_metadata` |
| `src/modules/backupCommands.ts` | Registro dos comandos de backup (separado de `commands.ts` para não ultrapassar 600 LOC) |
| `src/ui/backupPanel.ts` | Painel WebView com tabela de backups, ações globais e bloco de status |

**Arquivos existentes a modificar:**

| Arquivo | Modificação |
|---|---|
| `src/extension.ts` | Instanciar `BackupManager` após delay (`BACKUP_INITIAL_DELAY`); registrar em `context.subscriptions.push({ dispose: () => backupManager.dispose() })` — **não** chamar `dispose()` manualmente no `deactivate()`, seguindo o padrão já adotado no projeto. O construtor do `BackupManager` recebe `(databaseManager, myTimeTrace, storagePath)` — `myTimeTrace` e `storagePath` são necessários para `restoreFromBackup()` na Fase 2, mas devem ser injetados já na Fase 1 para evitar refatoração do construtor entre fases. O `statusBarManager` **não** é passado — backup não exibe nada na status bar, que permanece exclusiva de tracking + IDE |
| `src/config/constants.ts` | Adicionar `BACKUP_MIN_RETENTION`, `BACKUP_DEFAULT_INTERVAL_HOURS`, `BACKUP_MAX_RETRIES`, `BACKUP_RETRY_DELAY_MS`, `BACKUP_INITIAL_DELAY` (ver tabela em Premissas Técnicas) |
| `src/modules/database.ts` | Três mudanças obrigatórias: (1) declarar propriedade `private dbPath: string = ''` na classe; (2) adicionar `this.dbPath = path.join(storagePath, 'time_tracker.sqlite')` no início de `initialize()`, antes de abrir o banco — `close()` zera `this.db` mas não toca em `this.dbPath`, garantindo que `getDbPath()` seja seguro mesmo após `close()`; (3) adicionar método `getDbPath(): string { return this.dbPath; }` |
| `src/modules/index.ts` | Exportar `BackupManager` e `BackupCommands` — apenas módulos de lógica, seguindo o padrão do barrel file existente |
| `src/ui/index.ts` | Exportar `BackupPanel` — painéis WebView são exportados de `src/ui/index.ts`, não de `src/modules/index.ts` (padrão do projeto: `StatsPanel`, `DeletedProjectsPanel` e `CssLoader` já estão lá) |
| `package.json` | Adicionar em `contributes.configuration` o schema completo das 6 settings `myTimeTraceVSCode.backup.*` (ver seção UX/UI) e em `contributes.commands` os 5 comandos de backup da Fase 1 |

**Comportamento de falha na Fase 1 (sem `BackupRetryManager`):**

Na Fase 1 não existe retry automático. Se o backup manual falhar (pasta inacessível, disco cheio, erro de permissão), o comportamento é:
1. Chamar `vscode.window.showErrorMessage()` com a mensagem de erro descritiva.
2. Persistir a mensagem em `sync_metadata` via chave `backup.lastError`.
3. Atualizar o badge de estado do painel para `✕ Falha`.
4. Não tentar novamente — o usuário pode acionar manualmente quando resolver o problema.

O retry automático entra apenas na Fase 2 com o `BackupRetryManager`.

**Testes:**
- Criar `src/test/backupManager.test.ts` cobrindo: execução de backup bem-sucedida, política de retenção (remoção do mais antigo), colisão de nome de arquivo (sufixo incremental), pasta inacessível (exibe erro, atualiza estado), e persistência de timestamp em `sync_metadata`.
- ~~`src/test/backupRetryManager.test.ts`~~ — **movido para Fase 2** (o módulo `backupRetryManager.ts` não existe na Fase 1).

### Fase 2

> **Dependência:** O painel WebView (`backupPanel.ts`) foi criado na Fase 1. A Fase 2 estende esse painel adicionando a coluna "Restaurar" na tabela e preenchendo o campo "Próximo backup" no bloco de status.

**Funcionalidades:**
- Agendamento automático usando estratégia `setTimeout` (para o próximo backup calculado) + `setInterval` (para ciclos subsequentes) — **não** `setInterval` puro com o intervalo total, pois isso causaria drift e não sobreviveria a mudanças de configuração em tempo real. Ver detalhe da estratégia em Premissas Técnicas (`scheduleNext()`). O intervalo configurado vem do `settings.json` desde a Fase 1.
- Verificação de backup perdido na inicialização do VS Code (lógica de inicialização completa descrita em "Lógica de Inicialização").
- `BackupRetryManager` com retry em falha — novo arquivo `src/modules/backupRetryManager.ts` baseado em `src/modules/syncRetryManager.ts`.
- Pausa e retomada via comandos `Pausar Backup Automático` e `Retomar Backup Automático`; estado persiste em `sync_metadata` via chave `backup.state`.
- Exibição do próximo backup agendado no bloco de status do painel (campo "Próximo backup").
- Restauração de backup: coluna "Restaurar" adicionada ao painel — o usuário seleciona um arquivo da pasta de destino e a extensão substitui o banco ativo após confirmação explícita.

  > **Encapsulamento obrigatório em `BackupManager.restoreFromBackup()`:** toda a lógica dos 9 passos abaixo deve ser implementada em `BackupManager.restoreFromBackup(backupFilePath: string): Promise<void>` — **não** diretamente no `BackupPanel.onDidReceiveMessage()`. O `BackupPanel` não tem acesso a `storagePath` (`context.globalStorageUri.fsPath`), que é necessário no passo 7 para re-inicializar o `DatabaseManager`. Centralizar no `BackupManager` mantém o painel thin (responsabilidade de UI apenas) e torna o fluxo testável. O WebView envia `{ command: 'restoreBackup', fileName }` e o handler no `BackupPanel` delega diretamente: `await backupManager.restoreFromBackup(filePath)`. O `BackupManager` deve receber `myTimeTrace` e `storagePath` no construtor para ter todos os recursos necessários.

  O fluxo de restauração é crítico e deve seguir exatamente esta sequência, pois o banco está aberto durante a operação:

  ```
  1. Confirmar com o usuário (showWarningMessage com botão "Restaurar")
  2. Parar o rastreamento de tempo: myTimeTrace.pauseTracking()
  3. Parar o agendamento de backup (backupManager.pauseScheduler())
  4. const targetPath = databaseManager.getDbPath() — capturar path ANTES de fechar;
     close() pode zerar a propriedade interna, tornando getDbPath() inválido depois
  5. await databaseManager.close() — close() é async; sem await o passo seguinte
     inicia com a conexão ainda aberta → EBUSY no Windows / corrupção no Linux
  6. await fs.promises.copyFile(backupFilePath, targetPath)
     — usar fs.promises (não fs.copyFile callback-based) para poder aguardar
  7. databaseManager.initialize(storagePath) — reabrir conexão
  8. Retomar agendador; retomar rastreamento via:
     vscode.commands.executeCommand('my-time-trace-vscode.startTracking')
     — não existe método público startTracking() no objeto; o resume vai pelo comando
  9. Notificar usuário do sucesso e sugerir reload da janela:
     vscode.commands.executeCommand('workbench.action.reloadWindow')
  ```

  Sem fechar o `DatabaseManager` antes (passo 4), a substituição do arquivo no Windows retorna `EBUSY` e no Linux pode corromper o banco em uso.
- Log detalhado de operações.

**Arquivos a criar:**

| Arquivo | Descrição |
|---|---|
| `src/modules/backupRetryManager.ts` | Retry com interface idêntica ao `SyncRetryManager`, defaults fixos (3 tentativas, 30s) |

**Arquivos existentes a modificar:**

| Arquivo | Modificação |
|---|---|
| `src/modules/backupManager.ts` | Adicionar `scheduleNext()` com estratégia `setTimeout` + `setInterval` (ver Premissas Técnicas), lógica de inicialização com verificação de backup perdido, integração com `BackupRetryManager`, `onConfigChange()` para reagendar ao mudar intervalo |
| `src/extension.ts` | Registrar listener `onDidChangeConfiguration` via `context.subscriptions` (ver Premissas Técnicas — `backupConfigListener`) para que mudanças em `myTimeTraceVSCode.backup.*` chamem `backupManager.onConfigChange()` |
| `src/ui/backupPanel.ts` | Adicionar coluna "Restaurar" na tabela, campo "Próximo backup" no bloco de status, e registrar `FileSystemWatcher` para detectar mudanças externas na pasta de destino |
| `src/modules/backupCommands.ts` | Registrar `Pausar Backup Automático` e `Retomar Backup Automático` |
| `package.json` | Adicionar comandos de pausa e retomada em `contributes.commands` |

**Testes:**
- Estender `src/test/backupManager.test.ts`: agendamento com `setTimeout`+`setInterval`, verificação de backup perdido ao inicializar (timestamp ultrapassado vs não ultrapassado), pausa e retomada do agendador, reagendamento ao mudar intervalo via settings.
- Criar `src/test/backupRetryManager.test.ts` seguindo `syncRetryManager.test.ts`: retry após falha, delay entre tentativas, notificação após esgotar tentativas, `updateConfig()` com valores mínimo/máximo.

### Fase 3

- Compressão dos arquivos de backup (ex: `.sqlite.gz`).
- Exportação para outros formatos (CSV, JSON).
- Notificação de backup bem-sucedido (opcional, configurável).

### Fase 4

Backup offsite opcional no GitHub, totalmente automatizado após configuração inicial guiada pelo usuário.

#### Ativação (opt-in)

A extensão oferece a opção via notificação após cada backup local concluído com sucesso, enquanto o backup no GitHub não estiver configurado e o usuário não tiver marcado "Não perguntar novamente". A notificação apresenta duas ações: **"Configurar backup no GitHub"** e **"Não perguntar novamente"**.

- Se o usuário clicar em "Não perguntar novamente", a notificação nunca mais é exibida e a flag é persistida nas configurações locais.
- Independente da escolha, o comando **`MyTimeTrace: Configurar Backup no GitHub`** fica sempre disponível na paleta de comandos do VS Code. O usuário pode iniciar o fluxo de configuração a qualquer momento por ali.
- Nada acontece sem consentimento explícito.

#### Fluxo de configuração inicial (assistido)

Ao aceitar, a extensão conduz o usuário passo a passo:

1. **Token PAT** — a extensão explica o que é um Personal Access Token, aponta o link de geração nas configurações do GitHub e solicita o token. O escopo mínimo necessário é `repo` (acesso a repositórios privados).
2. **Nome do repositório** — o usuário informa o nome desejado. A extensão deixa claro que o repositório **precisa ser privado** e explica o risco de um repositório público conter dados de rastreamento pessoal.
3. **Criação do repositório** — a extensão cria o repositório privado via API do GitHub automaticamente, sem que o usuário precise acessar o site.
4. **Confirmação** — a extensão exibe um resumo da configuração e confirma que está pronta para operar.

Após a configuração, o usuário não precisa fazer mais nada.

#### Operação automática (pós-configuração)

- A cada backup local concluído com sucesso, a extensão faz commit e push do arquivo para o repositório privado automaticamente.
- A mensagem de commit segue o padrão: `backup: time_tracker_YYYY-MM-DD_HH-mm-ss.sqlite`.
- O token PAT fica armazenado no VS Code Secret Storage (mesmo mecanismo da API Key atual), nunca em texto plano.
- A política de retenção local continua valendo normalmente; o GitHub mantém o histórico completo via Git.
- Em caso de falha no push, o backup local já está seguro — o erro é registrado em log e avisado ao usuário, mas não cancela nem desfaz o backup local.

## Decisões Registradas

| Decisão | Definição |
|---|---|
| Intervalos por dia | Um único intervalo fixo em horas (ex: a cada 4h). Sem múltiplos horários configurados manualmente. |
| Restauração de backup | Entra na Fase 2, como nova coluna no painel criado na Fase 1. |
| Mínimo de retenção | 3 backups. A política automática (RF06) nunca desce abaixo disso. A exclusão manual pelo usuário no painel (RF09) exibe aviso mas não bloqueia. |
| Backup e sync | Sistemas completamente independentes. O sync do servidor não interfere no backup local em nenhuma hipótese. |
| Backup perdido | Se o VS Code ficou fechado durante o horário de backup, o backup roda imediatamente ao abrir o VS Code. |
| Organização de arquivos | Novos módulos em `src/modules/` (backupManager, backupRetryManager, backupCommands) e novo painel em `src/ui/` (backupPanel), seguindo a estrutura existente do projeto. |
| Separação de comandos | Comandos de backup vão em `src/modules/backupCommands.ts` separado de `commands.ts` (já com 573 LOC) para manter os arquivos gerenciáveis. |
| Constantes centralizadas | Valores fixos do backup (`BACKUP_MIN_RETENTION`, `BACKUP_DEFAULT_INTERVAL_HOURS`, `BACKUP_MAX_RETRIES`, `BACKUP_RETRY_DELAY_MS`) ficam em `src/config/constants.ts`. |
| Chaves do sync_metadata | O `BackupManager` usa prefixo `backup.` nas chaves do `sync_metadata` para evitar colisão com as chaves existentes do `SyncManager`. |
| Painel na Fase 1 | O painel WebView de gerenciamento (RF09) é entregue na Fase 1 junto com o backup manual, pois é a interface principal do usuário para iniciar backups e ver o resultado imediatamente. |
