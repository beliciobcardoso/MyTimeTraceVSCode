# Contrato do Payload de Push — `POST /sync/push`

> **Versão:** 3.0  
> **Data:** 2026-05-22  
> **Motivação:** Adição dos campos `ide_name` e `ide_version` para rastreamento da IDE de origem das entradas.

---

feat/add-ide-name-version-to-payload: Adiciona campos `ide_name` e `ide_version` ao payload de push para identificar a IDE de origem das entradas. O servidor deve aceitar ambos os formatos (com e sem os novos campos) para garantir compatibilidade com registros históricos.

## 1. Visão Geral

O endpoint `POST /sync/push` recebe lotes de registros de atividade acumulados localmente na extensão VSCode e os persiste na cloud. O servidor deve processar o payload de forma idempotente usando `clientId` como chave de deduplicação.

---

## 2. Requisição

### 2.1 Endpoint

```
POST {API_BASE_URL}/sync/push
```

| Ambiente | URL Base |
|----------|----------|
| Desenvolvimento | `http://localhost:3000/api` |
| Produção | `https://mytimetrace.com.br/api` |

### 2.2 Headers

| Header | Valor | Obrigatório |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Sim |
| `X-API-Key` | `mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Sim |

---

## 3. Estrutura do Payload

```json
{
  "deviceKey": "f7564d47-6581-4e3e-acc1-c4144222e919",
  "entries": [
    {
      "clientId": "local-436529bf-1099-4cc7-aae1-360d0f3ca862",
      "timestamp": "2026-04-21T12:56:05.077Z",
      "project": "MyTimeTraceVSCode",
      "file": "/home/bello/Projetos/arquivo.ts",
      "durationSeconds": 120,
      "isIdle": false,
      "ide_name": "VS Code",
      "ide_version": "1.98.0"
    },
    {
      "clientId": "local-100",
      "timestamp": "2025-11-10T08:30:00.000Z",
      "project": "OtherProject",
      "file": "/home/bello/outro/arquivo.py",
      "durationSeconds": 60,
      "isIdle": true
    }
  ]
}
```

> **Nota:** A segunda entrada do exemplo não possui `ide_name`/`ide_version` — isso representa um registro histórico anterior à migração. Ambos os formatos devem ser aceitos pelo servidor.

---

## 4. Campos do Payload

### 4.1 Raiz do Payload

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `deviceKey` | `string` (UUID v4) | Sim | Identificador único e imutável do dispositivo. Gerado no primeiro uso e armazenado no `globalState` da extensão. |
| `entries` | `Entry[]` | Sim | Array de registros de atividade não sincronizados. Tamanho máximo definido via `/sync/config` (padrão: 200). |

### 4.2 Campos de cada `Entry`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `clientId` | `string` | Sim | ID gerado localmente. Formato: UUID próprio ou `local-{id}` para registros antigos sem UUID. Usado como chave de deduplicação no servidor. |
| `timestamp` | `string` (ISO 8601 UTC) | Sim | Data/hora do início da atividade. Exemplo: `"2026-04-21T12:56:05.077Z"` |
| `project` | `string` | Sim | Nome do projeto (nome da pasta raiz do workspace). Fallback: `"Unknown"` |
| `file` | `string` | Sim | Caminho absoluto do arquivo ativo. Fallback: `"Unknown"` |
| `durationSeconds` | `integer` | Sim | Duração da atividade em segundos. Sempre inteiro positivo. |
| `isIdle` | `boolean` | Sim | `true` se o período foi de inatividade (sem interação do usuário). |
| `ide_name` | `string` | **Condicional** | Nome da IDE de origem. Presente apenas em registros novos (após migração). Ver [Seção 5](#5-campo-ide_name-novo). |
| `ide_version` | `string` | **Condicional** | Versão da IDE de origem. Incluído somente quando `ide_name` está presente. Ver [Seção 5](#5-campo-ide_name-novo). |

---

## 5. Campo `ide_name` (Novo)

### 5.1 Regra de Inclusão

Os campos `ide_name` e `ide_version` são incluídos no payload **somente quando o registro local possui a coluna `ide_name` preenchida** (não nula). Registros históricos (anteriores à migração do banco) **não terão esses campos**.

O servidor deve tratá-los como **opcionais** e aceitar entradas com ou sem eles.

Lógica de construção do payload (referência — `syncManager.ts:330`):

```typescript
if (entry.ide_name !== null && entry.ide_name !== undefined) {
  base.ide_name = entry.ide_name;
  base.ide_version = ideVersion; // obtido em tempo de sync via DeviceManager
}
```

### 5.2 Valores Possíveis de `ide_name`

| Valor | IDE |
|-------|-----|
| `"VS Code"` | Visual Studio Code (stable) |
| `"Code - Insiders"` | VS Code Insiders |
| `"Cursor"` | Cursor |
| `"Windsurf"` | Windsurf |
| `"Google Antigravity"` | Google Antigravity |
| `"unknown"` | IDE não identificada (fallback) |

### 5.3 Formato de `ide_version`

| IDE | Formato | Exemplo |
|-----|---------|---------|
| `"VS Code"` | `vscode.version` (API nativa) | `"1.98.0"` |
| `"Code - Insiders"` | `vscode.version` (API nativa) | `"1.99.0-insider"` |
| `"Cursor"` | Versão real lida de `resources/app/package.json` | `"0.45.2"` |
| `"Windsurf"` | Versão real lida de `resources/app/package.json` | `"1.2.0"` |
| `"Google Antigravity"` | Versão real lida de `resources/app/package.json` | `"0.1.0"` |
| Forks (fallback) | `${vscode.version}-base` | `"1.98.0-base"` |
| `"unknown"` | String literal | `"unknown"` |

> **Nota sobre forks:** Para IDEs como Cursor e Windsurf, a extensão tenta ler a versão real do `package.json` da instalação. Se o arquivo não for acessível, usa `${vscode.version}-base` como fallback.

---

## 6. Comportamento Esperado do Servidor

### 6.1 Deduplicação

O servidor usa uma chave composta como índice único de deduplicação:

```
@@unique([deviceId, startedAt, fileName, projectName, duration], name: "time_entry_dedup_key")
```

O `clientId` é armazenado no banco mas **não é** a chave de deduplicação. Se uma entrada com a mesma chave composta já existir na cloud:

- **Não deve retornar erro**
- A entrada é ignorada silenciosamente (`skipDuplicates: true`) e contada em `skippedCount` na resposta

### 6.2 Campos Opcionais

O servidor deve aceitar entradas **com e sem** `ide_name`/`ide_version`. Ambas as situações são válidas:

- **Sem os campos:** Registro histórico (anterior à v2.0 da extensão)
- **Com os campos:** Registro novo com informação de IDE

Sugestão de schema de validação no servidor:

```typescript
// Exemplo com zod (Node.js)
const EntrySchema = z.object({
  clientId: z.string(),
  timestamp: z.string().datetime(),
  project: z.string(),
  file: z.string(),
  durationSeconds: z.number().int().positive(),
  isIdle: z.boolean(),
  ide_name: z.string().optional(),    // Novo — opcional
  ide_version: z.string().optional(), // Novo — opcional, presente com ide_name
});

const PushPayloadSchema = z.object({
  deviceKey: z.string().uuid(),
  entries: z.array(EntrySchema).min(1).max(500),
});
```

### 6.3 Persistência Recomendada

O servidor deve armazenar `ide_name` e `ide_version` na tabela de registros da cloud. Sugestão de migração:

```sql
ALTER TABLE time_entries ADD COLUMN ide_name VARCHAR(50) DEFAULT NULL;
ALTER TABLE time_entries ADD COLUMN ide_version VARCHAR(20) DEFAULT NULL;
```

---

## 7. Resposta Esperada

O servidor retorna HTTP `200 OK` com o seguinte formato:

```json
{
  "pushedCount": 5,
  "receivedCount": 7,
  "skippedCount": 2,
  "newBadges": ["first-sync"]
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pushedCount` | `integer` | Quantidade de entradas novas salvas (inseridas) |
| `receivedCount` | `integer` | Quantidade total de entradas recebidas no payload |
| `skippedCount` | `integer` | Quantidade de entradas ignoradas por duplicidade (`receivedCount - pushedCount`) |
| `newBadges` | `string[]` | Badges desbloqueadas durante este sync (pode ser array vazio) |

> **Comportamento do cliente:** Independente de `pushedCount` vs `skippedCount`, todas as entradas enviadas são marcadas como `synced = 1` localmente. O cliente não reenvia entradas em nenhum dos casos.

**Em caso de erro:**

```json
HTTP 4xx/5xx
"Mensagem de erro textual ou JSON"
```

O cliente lança uma exceção e **não marca** as entradas como sincronizadas — elas serão reenviadas no próximo ciclo de sync.

---

## 8. Referências no Código-Fonte

| Componente | Arquivo | Linhas |
|-----------|---------|--------|
| Construção do payload | [syncManager.ts](../src/modules/syncManager.ts) | 312–337 |
| Busca de entries não sincronizadas | [database.ts](../src/modules/database.ts) | 696–718 |
| Migração da coluna `ide_name` | [database.ts](../src/modules/database.ts) | 175–189 |
| Detecção do nome da IDE | [deviceInfo.ts](../src/modules/deviceInfo.ts) | 59–80 |
| Detecção da versão da IDE | [deviceInfo.ts](../src/modules/deviceInfo.ts) | 114–138 |
| Interface `ActivityData` | [database.ts](../src/modules/database.ts) | 9–17 |
