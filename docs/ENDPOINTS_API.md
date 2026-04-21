# 📡 Documentação de Endpoints - MyTimeTrace Backend API

> **Base URL:** `http://localhost:8989` (desenvolvimento)  
> **Produção:** `https://api.mytimetrace.com` (futuro)

## 🔐 Autenticação

Todos os endpoints (exceto registro) requerem autenticação via header HTTP:

```http
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

---

## 📋 Endpoints Implementados

### 1. POST /sync/register

**Descrição:** Registra um novo dispositivo no servidor e associa ao usuário via API Key.

**Headers:**
```http
Content-Type: application/json
X-API-Key: mtt_xxxxx
```

**Request Body:**
```json
{
  "deviceKey": "550e8400-e29b-41d4-a716-446655440000",
  "deviceName": "Notebook Dell",
  "deviceHostname": "DESKTOP-ABC",
  "devicePlatform": "linux",
  "deviceArch": "x64",
  "deviceType": "Linux",
  "deviceRelease": "Ubuntu 22.04"
}
```

**Response (201 Created):**
```json
{
  "message": "Device registered successfully",
  "device": {
    "id": "device-uuid-123",
    "deviceKey": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (200 OK - Dispositivo já existente):**
```json
{
  "message": "Device already registered",
  "device": {
    "id": "device-uuid-123",
    "deviceKey": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida
- `400 Bad Request` - Dados inválidos

---

### 2. POST /sync/push

**Descrição:** Envia entries locais não sincronizadas para o servidor (batch de até 500 entries).

**Headers:**
```http
Content-Type: application/json
X-API-Key: mtt_xxxxx
```

**Request Body:**
```json
{
  "deviceKey": "550e8400-e29b-41d4-a716-446655440000",
  "entries": [
    {
      "clientId": "local-123",
      "timestamp": "2025-11-22T10:00:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "src/extension.ts",
      "durationSeconds": 120,
      "isIdle": false
    },
    {
      "clientId": "local-124",
      "timestamp": "2025-11-22T10:02:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "src/modules/database.ts",
      "durationSeconds": 180,
      "isIdle": false
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "savedCount": 2,
  "conflictsCount": 0,
  "syncedAt": "2025-11-22T10:05:00.000Z"
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida
- `400 Bad Request` - Formato de dados inválido
- `413 Payload Too Large` - Mais de 500 entries

---

### 3. GET /sync/pull

> **LEGADO / DEPRECIADO**

**Descrição:** Recebe entries de outros dispositivos do mesmo usuário (sincronização incremental).

**Headers:**
```http
X-API-Key: mtt_xxxxx
```

**Query Parameters:**
- `deviceKey` (required): UUID do dispositivo atual
- `since` (optional): Timestamp ISO 8601 para sync incremental (default: epoch)
- `limit` (optional): Máximo de entries retornadas (default: 500, max: 500)

**URL Exemplo:**
```
GET /sync/pull?deviceKey=550e8400-e29b-41d4-a716-446655440000&since=2025-11-17T00:00:00.000Z&limit=500
```

**Response (200 OK):**
```json
{
  "entries": [
    {
      "clientId": "remote-456",
      "timestamp": "2025-11-22T09:00:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "src/modules/database.ts",
      "durationSeconds": 180,
      "isIdle": false,
      "deviceKey": "other-device-uuid-789"
    }
  ],
  "syncedAt": "2025-11-22T10:05:00.000Z"
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida
- `400 Bad Request` - deviceKey ausente

---

### 4. GET /sync/status

**Descrição:** Retorna informações sobre todos os dispositivos do usuário e estatísticas de sincronização.

**Headers:**
```http
X-API-Key: mtt_xxxxx
```

**Query Parameters:**
- `deviceKey` (required): UUID do dispositivo atual

**URL Exemplo:**
```
GET /sync/status?deviceKey=550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "currentDevice": {
    "id": "device-uuid-1",
    "deviceKey": "550e8400-e29b-41d4-a716-446655440000",
    "deviceName": "Notebook Dell",
    "totalEntries": 150,
    "lastSeen": "2025-11-22T10:00:00.000Z"
  },
  "otherDevices": [
    {
      "id": "device-uuid-2",
      "deviceName": "PC Desktop",
      "totalEntries": 100,
      "lastSeen": "2025-11-21T18:00:00.000Z"
    }
  ],
  "totals": {
    "totalDevices": 2,
    "totalEntriesAllDevices": 250
  }
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida
- `404 Not Found` - Device não encontrado

---

### 5. GET /sync/config

**Descrição:** Retorna configurações de sincronização (horários, retries, delays).

**Headers:**
```http
X-API-Key: mtt_xxxxx
```

**Response (200 OK):**
```json
{
  "syncTimes": ["08:00", "17:00"],
  "maxRetries": 5,
  "retryDelayMs": 10000
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida

---

### 6. PUT /sync/config *(Superadmin apenas)*

**Descrição:** Atualiza configurações globais de sincronização.

**Headers:**
```http
Content-Type: application/json
X-API-Key: mtt_xxxxx (admin)
```

**Request Body:**
```json
{
  "syncTimes": ["08:00", "12:00", "17:00"],
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

**Response (200 OK):**
```json
{
  "message": "Config updated successfully",
  "config": {
    "syncTimes": ["08:00", "12:00", "17:00"],
    "maxRetries": 3,
    "retryDelayMs": 5000
  }
}
```

**Errors:**
- `401 Unauthorized` - API Key inválida
- `403 Forbidden` - Não é superadmin

---

## 📊 Endpoints Opcionais (Futuros)

### 7. GET /entries

**Descrição:** Consulta registros com filtros avançados.

**Query Parameters:**
- `device_key` (optional): Filtrar por dispositivo
- `project` (optional): Filtrar por projeto
- `start_date` (optional): Data inicial (ISO 8601)
- `end_date` (optional): Data final (ISO 8601)
- `limit` (optional): Máximo de resultados (default: 100)
- `offset` (optional): Paginação (default: 0)

**URL Exemplo:**
```
GET /entries?device_key=xxx&project=MyTimeTraceVSCode&start_date=2025-11-01&limit=50
```

---

### 8. GET /stats/summary

**Descrição:** Estatísticas agregadas de tempo de desenvolvimento.

**Query Parameters:**
- `start_date` (optional): Data inicial
- `end_date` (optional): Data final
- `group_by` (optional): Agrupamento (project, file, device)

**URL Exemplo:**
```
GET /stats/summary?start_date=2025-11-01&group_by=project
```

---

### 9. DELETE /entries/:id

**Descrição:** Deleta um registro específico.

**URL Exemplo:**
```
DELETE /entries/server-uuid-789
```

---

## 🔧 Configuração no VS Code Extension

### Constantes Globais (`src/config/constants.ts`):

```typescript
export const API_BASE_URL = 'http://localhost:8989';
export const SYNC_BATCH_LIMIT = 500;
export const REQUEST_TIMEOUT = 30000; // 30 segundos
```

### Secret Keys (SecretStorage):

```typescript
export const SECRET_KEYS = {
  API_KEY: 'mytimetrace.apiKey',
  DEVICE_KEY: 'mytimetrace.deviceKey'
};
```

---

## 📝 Notas de Implementação

### Sincronização Automática:
- **Horários padrão:** 08:00 e 17:00 (configurável via `/sync/config`)
- **Intervalo de verificação:** 1 minuto
- **Retry automático:** 5 tentativas com delay de 10 segundos

### Limites:
- **Batch size (push):** 500 entries por request
- **Request timeout:** 30 segundos
- **Cleanup automático:** Projetos deletados >30 dias são removidos a cada 24h

### Segurança:
- **API Key:** Armazenada criptografada no SecretStorage do OS
- **Device Key:** UUID v4 gerado automaticamente na primeira sync
- **Headers obrigatórios:** `X-API-Key` em todos os endpoints (exceto register)

---

## 🐛 Debugging

### Ver logs de sincronização:
```bash
# No VS Code, abrir Output panel
View > Output > Select "MyTimeTrace"
```

### Testar conexão:
```typescript
// Usar comando no VS Code
MyTimeTrace: View Sync Status
```

### Códigos HTTP importantes:
- `200 OK` - Sucesso
- `201 Created` - Recurso criado com sucesso
- `400 Bad Request` - Dados inválidos
- `401 Unauthorized` - API Key inválida ou ausente
- `403 Forbidden` - Sem permissão (superadmin required)
- `404 Not Found` - Recurso não encontrado
- `413 Payload Too Large` - Batch muito grande (>500 entries)
- `500 Internal Server Error` - Erro no servidor

---

**Última atualização:** 22/11/2025  
**Versão da API:** v1.0  
**Versão da Extension:** v0.4.0
