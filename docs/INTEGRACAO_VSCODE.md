# 🔗 Integração com VS Code Extension

**Data:** 21 de abril de 2026  
**Backend:** MyTimeTraceCloud (Este Repositório)  
**Extensão:** MyTimeTrace VS Code (Repositório Separado)

---

## ⚠️ IMPORTANTE - Divisão de Responsabilidades

### 🎯 **Este Repositório (MyTimeTraceCloud)**

**O que implementa:**
- ✅ Backend API REST (NestJS + PostgreSQL)
- ✅ Autenticação via API Key
- ✅ Endpoints de sincronização (`/sync/*`)
- ✅ Lógica de push unidirecional (ext -> cloud)
- ✅ Multi-tenant (multi-usuário)
- ✅ Admin panel (frontend React)
- ✅ Documentação Swagger (`/api/docs`)

**O que NÃO implementa:**
- ❌ Extensão VS Code (já existe em produção)
- ❌ Código TypeScript da extensão
- ❌ Comandos VS Code
- ❌ Interface local da extensão

### 📦 **Repositório MyTimeTrace VS Code (Separado)**

**O que já existe em produção:**
- ✅ Extensão VS Code funcional
- ✅ Rastreamento local de tempo (SQLite)
- ✅ Interface e comandos
- ✅ Publicado no VS Code Marketplace

**O que precisa integrar com este backend:**
- 🔄 Consumir endpoints `/sync/*`
- 🔄 Gerenciar API Key (SecretStorage)
- 🔄 Implementar envio automático para Cloud
- 🔄 Sincronizar apenas da extensão para a Cloud

---

## 🌐 Endpoints Disponíveis (Backend Completo)

### **1. POST /sync/register**
Registra um novo dispositivo no servidor.

```typescript
// Request
POST http://localhost:8989/api/sync/register
Headers: { "X-API-Key": "mtt_abc123..." }
Body: {
  "deviceKey": "uuid-do-dispositivo",
  "deviceName": "Notebook Dell",
  "deviceHostname": "DESKTOP-ABC",
  "devicePlatform": "linux",
  "deviceArch": "x64",
  "deviceType": "PC",
  "deviceRelease": "Ubuntu 22.04"
}

// Response 201
{
  "message": "Device registered successfully",
  "device": {
    "id": "uuid-device",
    "deviceKey": "uuid-do-dispositivo",
    "deviceName": "Notebook Dell",
    "createdAt": "2025-11-22T10:00:00Z"
  }
}
```

### **2. POST /sync/push**
Envia entries locais para o servidor (máx 500 por vez).

```typescript
// Request
POST http://localhost:8989/api/sync/push
Headers: { "X-API-Key": "mtt_abc123..." }
Body: {
  "deviceKey": "uuid-do-dispositivo",
  "entries": [
    {
      "clientId": "uuid-entry-1",
      "timestamp": "2025-11-22T10:30:00Z",
      "project": "MyProject",
      "file": "src/main.ts",
      "durationSeconds": 300,
      "isIdle": false
    },
    // ... até 500 entries
  ]
}

// Response 201
{
  "savedCount": 100,
  "conflictsCount": 0,
  "conflicts": [],
  "syncedAt": "2025-11-22T10:31:00Z"
}
```

### **3. GET /sync/pull**
> **LEGADO / REMOVIDO NO NOVO FLUXO DA EXTENSÃO**

Busca entries de outros dispositivos (paginado).

```typescript
// Request
GET http://localhost:8989/api/sync/pull?deviceKey=uuid-dispositivo&limit=100
Headers: { "X-API-Key": "mtt_abc123..." }

// Response 200
{
  "entries": [
    {
      "clientId": "uuid-entry-2",
      "timestamp": "2025-11-22T09:00:00Z",
      "project": "OtherProject",
      "file": "src/app.ts",
      "durationSeconds": 600,
      "isIdle": false
    },
    // ... entries de outros PCs
  ],
  "totalCount": 250,
  "hasMore": true,
  "nextOffset": 100,
  "syncedAt": "2025-11-22T10:32:00Z"
}
```

### **4. GET /sync/status**
Verifica status de sincronização.

```typescript
// Request
GET http://localhost:8989/api/sync/status?deviceKey=uuid-dispositivo
Headers: { "X-API-Key": "mtt_abc123..." }

// Response 200
{
  "currentDevice": {
    "id": "uuid-device-1",
    "deviceKey": "uuid-dispositivo",
    "deviceName": "Notebook Dell",
    "totalEntries": 150,
    "lastSeen": "2025-11-22T10:32:00Z"
  },
  "otherDevices": [
    {
      "id": "uuid-device-2",
      "deviceName": "Desktop Windows",
      "totalEntries": 100,
      "lastSeen": "2025-11-22T08:00:00Z"
    }
  ],
  "totals": {
    "totalDevices": 2,
    "totalEntries": 250,
    "totalEntriesAllDevices": 250
  }
}
```

### **5. GET/PUT /sync/config** (Superadmin)
Gerencia configurações de sync (retry, horários).

```typescript
// GET - Obter config
GET http://localhost:8989/api/sync/config
Headers: { "X-API-Key": "mtt_superadmin..." }

// Response 200
{
  "maxRetries": 5,
  "retryDelayMs": 10000,
  "syncTimes": ["08:00", "17:00"]
}

// PUT - Atualizar config
PUT http://localhost:8989/api/sync/config
Headers: { "X-API-Key": "mtt_superadmin..." }
Body: {
  "maxRetries": 3,
  "retryDelayMs": 5000,
  "syncTimes": ["08:00", "12:00", "17:00", "22:00"]
}
```

---

## 🔐 Autenticação

**Todas as requests exigem header `X-API-Key`:**

```typescript
Headers: {
  "X-API-Key": "mtt_1a2b3c4d5e6f7g8h9i0j"
}
```

**Onde obter API Key:**
1. Usuário cria conta na plataforma web MyTimeTrace
2. Sistema gera API Key única (formato: `mtt_xxxxx`)
3. Usuário copia e cola na extensão VS Code
4. Extensão salva em SecretStorage (criptografado)

**Validação:**
- Backend valida via `ApiKeyGuard` middleware
- HTTP 401 se inválida
- HTTP 403 se desabilitada

---

## 📊 Fluxo de Sincronização

```
┌─────────────────────────────────────────────────────────┐
│ 1. USUÁRIO: Cria conta na plataforma web               │
│    → Recebe API_KEY: "mtt_abc123xyz"                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 2. VS CODE PC A: Configura API_KEY                     │
│    → Comando: "MyTimeTrace: Set API Key"               │
│    → Salva em SecretStorage (criptografado)            │
│    → Gera device_key: "uuid-pc-a"                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 3. VS CODE PC A: Registra device no servidor           │
│    → POST /sync/register                                │
│    → Headers: X-API-Key                                 │
│    → Body: { deviceKey, deviceName, ... }              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 4. VS CODE PC A: Trabalha normalmente                  │
│    → Gera 100 time_entries no SQLite local             │
│    → synced = 0 (não sincronizadas)                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 5. VS CODE PC A: Auto-sync (horários configurados)     │
│    → POST /sync/push (100 entries)                     │
│    → Response: { savedCount: 100, conflicts: [] }      │
│    → Marca entries como synced = 1                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 6. VS CODE: reenvia somente o que está pendente       │
│    → Não existe mais pull na extensão                  │
│    → Dados locais seguem com synced = 1 após push      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 7. RESULTADO: Cloud recebe o histórico local            │
│    → Extensão: envia apenas o que faltava               │
│    → Servidor: consolida os registros do device        │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Comportamento de Notificações (Extensão)

**A extensão deve implementar:**

### 1️⃣ API Key NUNCA configurada
- ✅ Extension funciona 100% normal (modo local)
- ✅ time_entries rastreadas no SQLite
- ❌ Sync NÃO tenta executar
- 🔇 NENHUMA mensagem ao usuário (silencioso)

### 2️⃣ API Key configurada E válida
- ✅ Sync funciona normalmente (push only)
- ✅ Auto-sync em horários específicos (ex: [08:00, 17:00])
- 🔇 Sucesso = SILENCIOSO (sem notificação)

### 3️⃣ API Key configurada MAS inválida
- ⚠️ Tenta sync com retry (5 tentativas, 10s delay)
- ⚠️ Se todas falharem → Notifica usuário
- 🔔 "API Key inválida. Reconfigure se desejar sync."
- ✅ Extension continua funcionando (modo local)

---

## 🔧 Configurações Dinâmicas (Admin)

**Superadmin pode ajustar via `/sync/config`:**

### Retry
- `maxRetries`: 1 a 10 tentativas
- `retryDelayMs`: 1000 a 60000ms (1s a 60s)

### Auto-Sync
- `syncTimes`: Array de horários HH:MM
- Exemplos:
  - `["08:00"]` → 1x/dia
  - `["08:00", "17:00"]` → 2x/dia
  - `["08:00", "12:00", "17:00", "22:00"]` → 4x/dia

**Extensão deve buscar config ao iniciar:**
```typescript
GET /sync/config
→ Atualiza SYNC_TIMES, MAX_RETRIES, RETRY_DELAY
```

---

## 📚 Documentos de Referência

### Para Time da Extensão VS Code

1. **[VSCODE_SYNC_IMPLEMENTATION.md](./VSCODE_SYNC_IMPLEMENTATION.md)**
   - Especificação completa de integração
   - Código de exemplo (ApiKeyManager, SyncManager)
   - Fluxos de autenticação e sync
   - Guia de testes

2. **[BACKEND_SYNC_SPEC.md](./BACKEND_SYNC_SPEC.md)**
   - Especificação técnica completa do backend
   - Schema Prisma detalhado
   - Lógica de negócio
   - Casos de uso

### Para Backend MyTimeTraceCloud

3. **[BACKEND_ANALYSIS.md](./BACKEND_ANALYSIS.md)**
   - Análise da arquitetura atual
   - Estrutura de pastas
   - Padrões utilizados

---

## 🚀 Como Testar Integração

### 1. Iniciar Backend MyTimeTraceCloud

```bash
cd packages/backend
pnpm dev
# Backend rodando em http://localhost:8989
# Swagger em http://localhost:8989/api/docs
```

### 2. Criar Conta de Teste (Frontend)

```bash
cd packages/frontend
pnpm dev
# Frontend em http://localhost:5173
# 1. Criar conta
# 2. Ver API Key em /settings/api-key
```

### 3. Testar Endpoints (cURL ou Postman)

```bash
# Registrar device
curl -X POST http://localhost:8989/api/sync/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mtt_abc123..." \
  -d '{
    "deviceKey": "test-uuid",
    "deviceName": "Test PC",
    "deviceHostname": "DESKTOP-TEST",
    "devicePlatform": "linux",
    "deviceArch": "x64",
    "deviceType": "PC",
    "deviceRelease": "Ubuntu 22.04"
  }'

# Push entries
curl -X POST http://localhost:8989/api/sync/push \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mtt_abc123..." \
  -d '{
    "deviceKey": "test-uuid",
    "entries": [
      {
        "clientId": "entry-uuid-1",
        "timestamp": "2025-11-22T10:00:00Z",
        "project": "TestProject",
        "file": "test.ts",
        "durationSeconds": 300,
        "isIdle": false
      }
    ]
  }'

# Pull entries
> A extensão não consome mais `GET /sync/pull` no novo fluxo.
```

---

## 📞 Contato

**Dúvidas sobre integração?**
- Backend (este repo): Consultar documentação ou issues
- Extensão VS Code: Levar especificações para o repositório da extensão

**Status atual:**
- ✅ Backend 100% completo e funcional
- 📋 Documentação de integração pronta
- ⏳ Aguardando implementação no repositório da extensão

---

**Última atualização:** 21 de abril de 2026
