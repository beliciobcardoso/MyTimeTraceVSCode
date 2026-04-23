# Fluxo de Sincronização — Backend MyTimeTrace

Este documento descreve em detalhe **o que o backend faz com cada payload enviado pela extensão `MyTimeTraceVSCode`**, desde a chegada do request HTTP até a gravação no PostgreSQL via Prisma. Use como referência de contrato e comportamento.

**Base URL**: `http://localhost:3000` (dev) | `https://<host>` (prod)

---

## 1. Visão geral do fluxo

```
┌────────────────────────┐
│  MyTimeTraceVSCode     │
│  (extensão)            │
└───────────┬────────────┘
            │  x-api-key: mtt_...
            │
            ▼
┌────────────────────────────────────────────┐
│ Next.js (apps/web) — app/api/sync/*        │
│                                            │
│  1. requireApiKey(headers)                 │
│  2. zod.safeParse(body|query)              │
│  3. Lookup de Device por (userId,deviceKey)│
│  4. Operação Prisma (create/find/update)   │
│  5. NextResponse.json(...)                 │
└───────────┬────────────────────────────────┘
            │
            ▼
┌────────────────────────┐
│ PostgreSQL             │
│  User / ApiKey /       │
│  Device / TimeEntry    │
└────────────────────────┘
```

**Ordem típica de chamadas em uma sessão**:

1. `POST /api/sync/register` — uma vez por device (primeiro uso ou troca de nome/plataforma).
2. `GET  /api/sync/config`   — opcional, para obter parâmetros do servidor.
3. `POST /api/sync/push`     — envia entries acumuladas offline.
4. `GET  /api/sync/pull`     — legado/depreciado no novo fluxo da extensão.
5. `GET  /api/sync/status`   — opcional, confere `lastSyncAt` e contagem.

---

## 2. Autenticação (todos os endpoints `/api/sync/*`)

**Header obrigatório**:

```
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Formato aceito** (regex em `apps/web/lib/api-key.ts`):

```
^mtt_[a-z0-9]{32}$
```

**Como o backend valida** (`apps/web/lib/auth.ts:50`):

1. Lê `x-api-key` do header.
2. Rejeita com `401 INVALID_API_KEY` se ausente ou fora do formato.
3. Busca todas as `ApiKey` com `active: true` no banco.
4. Itera e compara via `bcrypt.compare(rawApiKey, candidate.hashedKey)`.
5. No primeiro match:
   - Atualiza `lastUsedAt = now()` dessa ApiKey.
   - Retorna `{ apiKeyId, userId }` (usado nos endpoints seguintes para escopo).
6. Se nenhum match → `401 INVALID_API_KEY`.

> **Observação**: a chave em claro **nunca é armazenada**. O banco guarda apenas o hash bcrypt (cost 12). O lookup é O(n) sobre chaves ativas. Para o MVP isso é aceitável; se o número de chaves crescer, introduziremos um índice determinístico (ex.: prefix + HMAC).

**Resposta em caso de falha** (usada por todos os endpoints):

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key nao encontrada ou revogada"
  }
}
```
Status: `401`.

---

## 3. `POST /api/sync/register`

**Arquivo**: `apps/web/app/api/sync/register/route.ts`

Registra (ou atualiza) um `Device` associado ao usuário dono da ApiKey. **Deve ser chamado antes de `push` ou `pull`** — caso contrário esses endpoints respondem `400 DEVICE_NOT_REGISTERED`.

### Request

**Headers**:
```
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
content-type: application/json
```

**Body**:
```json
{
  "deviceKey": "f7564d47-6581-4e3e-acc1-c4144222e919",
  "deviceName": "bello-linux",
  "devicePlatform": "linux"
}
```

**Schema zod**:
```ts
{
  deviceKey:      string.uuid(),
  deviceName:     string.trim().min(1).max(128),
  devicePlatform: enum(["linux","darwin","win32"])
}
```

### Fluxo interno

1. `requireApiKey(headers)` → `{ apiKeyId, userId }`.
2. `safeParse(body)`; em erro → `400 INVALID_BODY` com `message` do zod.
3. `prisma.device.findUnique({ where: { deviceKey } })` (deviceKey é `@unique` globalmente).
4. Se existe e pertence a **outro** `userId` → `409 DEVICE_CONFLICT`.
5. `prisma.device.upsert({ where: { deviceKey }, update: {...}, create: {...} })`:
   - `create`: insere novo Device com `userId` do identity.
   - `update`: atualiza `deviceName`, `devicePlatform`, `lastSyncAt`.
6. Retorna `{ deviceId, deviceKey }`.

### Response (sucesso)

```json
{
  "deviceId": "9f8a...uuid",
  "deviceKey": "f7564d47-6581-4e3e-acc1-c4144222e919"
}
```
Status: `200`.

### Efeito no banco

- Tabela `Device`: cria ou atualiza 1 linha.
- `lastSyncAt` fica setado para `now()`.

---

## 4. `POST /api/sync/push`

**Arquivo**: `apps/web/app/api/sync/push/route.ts`

Envia entries acumuladas localmente. O backend cria uma linha em `TimeEntry` para cada elemento do array.

### Request (payload real capturado)

**Headers relevantes**:
```
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
content-type: application/json
user-agent: node
sentry-trace: 2103fa44890b40efb7972d36c623570e-8b3bf11753e016e1
baggage: sentry-environment=production,sentry-release=0.6.44,...
```

**Body** (exemplo real, 11 entries, 2987 bytes):
```json
{
  "deviceKey": "f7564d47-6581-4e3e-acc1-c4144222e919",
  "entries": [
    {
      "clientId": "local-436529bf-1099-4cc7-aae1-360d0f3ca862",
      "timestamp": "2026-04-21T12:56:05.077Z",
      "project": "Arquivos Diversos",
      "file": "/home/bello/.dbclient/.../public.sql",
      "durationSeconds": 3,
      "isIdle": false
    }
    // ...
  ]
}
```

**Schema zod**:
```ts
pushSchema = {
  deviceKey: string.uuid(),
  entries:   array(entrySchema)
}

entrySchema = {
  clientId:        string.trim().optional().nullable().catch(undefined),
  project:         string.trim().nullable().catch("Unknown").transform(v => v || "Unknown"),
  file:            string.trim().nullable().catch("Unknown").transform(v => v || "Unknown"),
  durationSeconds: coerce.number().nonnegative().catch(0),
  timestamp:       string.catch(() => new Date().toISOString()),
  isIdle:          boolean.optional().nullable().catch(false)
}
```

> **Permissivo por design**: cada campo de `entry` tem `.catch(...)` — valores inválidos **não** rejeitam o request, são substituídos por defaults seguros. Isso protege contra clientes antigos ou dados corrompidos. Apenas `deviceKey` (UUID) e a estrutura externa são estritamente validados.

### Fluxo interno

1. `requireApiKey(headers)` → `{ apiKeyId, userId }`.
2. `await request.json()` (em caso de JSON malformado → body vira `{}` via `.catch`).
3. `safeParse(body)`; erro estrutural → `400 INVALID_BODY`.
4. `prisma.device.findFirst({ where: { userId, deviceKey } })`:
   - `userId` vem do identity (escopo de segurança).
   - `deviceKey` vem do body.
   - Se não encontrar → `400 DEVICE_NOT_REGISTERED`.
5. Se `entries.length > 0`:
   - `prisma.timeEntry.createMany({ data: entries.map(...) })`
   - Mapeamento:
     ```
     deviceId    ← device.id              (FK para Device)
     projectName ← entry.project
     fileName    ← entry.file
     duration    ← entry.durationSeconds  (Int, segundos)
     startedAt   ← new Date(entry.timestamp)
     ```
   - `id` do TimeEntry é gerado pelo Prisma (`@default(uuid())`).
   - `createdAt`/`updatedAt` são preenchidos pelo DB (`@default(now())`).
6. `prisma.device.update({ where:{id:device.id}, data:{ lastSyncAt: now } })`.
7. Retorna `{ pushedCount }` (é o `count` retornado pelo `createMany`).

### Response (sucesso)

```json
{ "pushedCount": 11 }
```
Status: `200`.

### Efeito no banco

- Tabela `TimeEntry`: insere N linhas (N = `entries.length`).
- Tabela `Device`: atualiza `lastSyncAt` do device.
- Tabela `ApiKey`: atualiza `lastUsedAt` da chave usada (pelo `requireApiKey`).

### ⚠️ Campos que NÃO são persistidos

| Campo enviado      | Por quê não é guardado                                                         |
|--------------------|---------------------------------------------------------------------------------|
| `clientId`         | Usado apenas pela extensão para deduplicar localmente. O backend **sempre** gera novo UUID (`TimeEntry.id`) via Prisma. O pull devolve esse UUID como `clientId`. |
| `isIdle`           | O schema atual de `TimeEntry` não tem essa coluna. Aceito pelo zod, descartado no insert. |

---

## 5. `GET /api/sync/pull`

**Arquivo**: `apps/web/app/api/sync/pull/route.ts`

Retorna entries do device gravadas no servidor a partir de um timestamp de corte. Útil quando múltiplos clientes compartilham o mesmo device ou para recuperação após reinstalação.

### Request (payload real capturado)

```
GET /api/sync/pull?deviceKey=f7564d47-6581-4e3e-acc1-c4144222e919&since=2026-04-21T12%3A55%3A32.437Z&limit=200
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Query params**:
```
deviceKey  (string, uuid)       — obrigatório
since      (string, ISO 8601)   — obrigatório, filtro por createdAt
limit      (string, numérico)   — enviado pela extensão, MAS IGNORADO pelo backend
```

**Schema zod**:
```ts
pullQuerySchema = {
  deviceKey: string.uuid(),
  since:     string.datetime()   // rejeita se não for ISO 8601 válido
}
```

### Fluxo interno

1. `requireApiKey(headers)` → `{ apiKeyId, userId }`.
2. `new URL(request.url).searchParams` → extrai `deviceKey` e `since`.
3. `safeParse({ deviceKey, since })`; erro → `400 INVALID_QUERY`.
4. `prisma.device.findFirst({ where: { userId, deviceKey } })`; não achou → `400 DEVICE_NOT_REGISTERED`.
5. `prisma.timeEntry.findMany`:
   ```ts
   {
     where: {
       deviceId: device.id,
       createdAt: { gte: new Date(since) }
     },
     orderBy: { createdAt: "asc" }
   }
   ```
6. Remapeia cada registro para o formato esperado pela extensão:
   ```ts
   {
     clientId:        entry.id,                          // UUID do DB
     timestamp:       entry.startedAt.toISOString(),
     project:         entry.projectName,
     file:            entry.fileName,
     durationSeconds: entry.duration,
     isIdle:          false,                             // hardcoded (backend nao armazena)
     deviceKey:       deviceKey                          // echoed do query param
   }
   ```
7. Retorna `{ entries: [...], syncedAt: new Date().toISOString() }`.

### Response (sucesso)

```json
{
  "entries": [
    {
      "clientId": "a1b2...uuid",
      "timestamp": "2026-04-21T12:56:05.077Z",
      "project": "Arquivos Diversos",
      "file": "/home/bello/.dbclient/.../public.sql",
      "durationSeconds": 3,
      "isIdle": false,
      "deviceKey": "f7564d47-6581-4e3e-acc1-c4144222e919"
    }
  ],
  "syncedAt": "2026-04-21T13:40:00.123Z"
}
```
Status: `200`.

### ⚠️ Detalhes importantes do pull

1. **Filtro é `createdAt` (servidor), não `startedAt` (cliente)**.
   - `since` deve ser um timestamp do relógio do **servidor** (ex.: o `syncedAt` da resposta anterior). Se passar um `startedAt` do cliente, entries podem ser reentregues ou puladas.
2. **`limit` não é aplicado**. A extensão envia `limit=200` mas o backend faz `findMany` sem `take`. Se isso virar problema (muitas entries acumuladas), abra ticket para adicionar `take: parsed.data.limit`.
3. **`isIdle` sempre `false`**. Como não é armazenado, a extensão não deve confiar nesse valor quando vem do pull — só ele mesmo sabe se uma entry local é idle.
4. **`clientId` no pull ≠ `clientId` no push**. Para itens puxados do servidor, o `clientId` devolvido é o próprio `TimeEntry.id` (UUID do DB). Use isso como chave de deduplicação local.

---

## 6. `GET /api/sync/config`

**Arquivo**: `apps/web/app/api/sync/config/route.ts`

Retorna parâmetros de sincronização definidos pelo servidor. Útil para a extensão ajustar intervalos de retry, horários, batch sizes etc.

### Request

```
GET /api/sync/config
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Fluxo interno

1. `requireApiKey(headers)`.
2. Retorna objeto constante (no MVP não é configurável por usuário).

### Response

```json
{
  "apiVersion": "1.0",
  "maxEntriesPerPush": 1000,
  "syncTimes": ["08:00", "12:00", "17:00"],
  "batchLimit": 200,
  "maxRetries": 5,
  "retryDelayMs": 10000
}
```

---

## 7. `GET /api/sync/status`

**Arquivo**: `apps/web/app/api/sync/status/route.ts`

Informa a situação atual do device — útil para UI do cliente exibir "última sincronização" e total de entries.

### Request

```
GET /api/sync/status?deviceKey=f7564d47-...
x-api-key: mtt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Fluxo interno

1. `requireApiKey(headers)`.
2. `safeParse({ deviceKey })`; erro → `400 INVALID_QUERY`.
3. `prisma.device.findFirst({ where: { userId, deviceKey }, select: { id, lastSyncAt, _count: { timeEntries } } })`.
4. Não achou → `400 DEVICE_NOT_REGISTERED`.

### Response

```json
{
  "lastSyncAt": "2026-04-21T13:24:17.015Z",
  "deviceId": "9f8a...uuid",
  "entriesCount": 147,
  "lastError": null
}
```

`lastError` está sempre `null` — placeholder para futura telemetria.

---

## 8. Schema relevante do banco

`apps/web/prisma/schema.prisma`

```prisma
model User {
  id          String   @id @default(uuid()) @db.Uuid
  firebaseUid String   @unique
  email       String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  apiKeys     ApiKey[]
  devices     Device[]
}

model ApiKey {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  hashedKey  String                    // bcrypt(fullKey)
  label      String
  active     Boolean   @default(true)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Device {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @db.Uuid
  deviceKey      String    @unique        // UUID gerado pelo cliente
  deviceName     String
  devicePlatform String                   // "linux" | "darwin" | "win32"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  lastSyncAt     DateTime?
  timeEntries    TimeEntry[]
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model TimeEntry {
  id          String   @id @default(uuid()) @db.Uuid
  deviceId    String   @db.Uuid
  projectName String
  fileName    String
  duration    Int                         // segundos
  startedAt   DateTime                    // derivado de entry.timestamp
  createdAt   DateTime @default(now())    // usado como cursor no pull
  updatedAt   DateTime @updatedAt
  device      Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@index([deviceId])
  @@index([deviceId, startedAt])
}
```

---

## 9. Códigos de erro (resumo)

| HTTP | `code`                  | Origem                                      |
|------|-------------------------|---------------------------------------------|
| 400  | `INVALID_BODY`          | zod falhou em push/register                 |
| 400  | `INVALID_QUERY`         | zod falhou em pull/status                   |
| 400  | `DEVICE_NOT_REGISTERED` | deviceKey não encontrado para este userId   |
| 401  | `INVALID_API_KEY`       | x-api-key ausente, malformado ou não ativo  |
| 409  | `DEVICE_CONFLICT`       | deviceKey já pertence a outro usuário       |

Formato sempre:
```json
{ "error": { "code": "...", "message": "..." } }
```

---

## 10. Observações para a extensão

1. **Use `syncedAt` da resposta do pull** como `since` da próxima chamada. Não use `Date.now()` do relógio local para evitar drift.
2. **Dedup no cliente**: após pull, compare `clientId` (que é o UUID do servidor) com os IDs já conhecidos localmente. Entries que você enviou via push aparecerão no próximo pull com `clientId` **diferente** do que você mandou (porque o servidor gera novo UUID) — a dedup precisa ser por `(deviceKey, startedAt, file, project)` ou similar, não pelo `clientId` original.
3. **Ordem importa**: sempre `register` antes de `push`/`pull`. Em reinstalações, rechame `register` — o `upsert` no servidor tolera múltiplas chamadas.
4. **Sentry headers (`sentry-trace`, `baggage`)** são ignorados pelo backend atual — podem continuar sendo enviados sem problema.
5. **Tamanho do payload**: o zod não limita `entries.length`. `GET /api/sync/config` devolve `maxEntriesPerPush: 1000` como guideline, mas hoje não é enforced no servidor.
