# 🔍 Checklist de Validação - Sincronização Backend

Este documento lista todas as verificações necessárias no backend para garantir 100% de assertividade na sincronização com a extensão VSCode.

---

## 📋 **1. Endpoint `/sync/push` - Validações Críticas**

### **1.1 Detecção de Duplicatas por `clientId`**

```typescript
// ✅ CORRETO: Verificar duplicatas usando clientId único
const existingEntry = await this.timeEntryRepository.findOne({ 
  where: {
    userId: user.id,
    clientId: entry.clientId  // ⚠️ CRÍTICO: usar clientId!
  }
});

if (existingEntry) {
  conflicts.push({
    clientId: entry.clientId,
    reason: 'Duplicata - entry já existe no backend'
  });
  continue; // Não salva duplicata
}

// ❌ ERRADO: Verificar por timestamp (pode ter duplicatas no mesmo segundo)
// const existing = await findOne({ timestamp: entry.timestamp })
```

### **1.2 Response com Contadores Corretos**

```typescript
// ✅ Backend DEVE retornar:
return {
  savedCount: savedEntries.length,      // Entries REALMENTE salvas no banco
  conflictsCount: conflicts.length,     // Duplicatas ignoradas (não salvas)
  failedCount: failed.length,           // Opcional: erros de validação
  conflicts: conflicts.map(c => ({      // Opcional: detalhes dos conflitos
    clientId: c.clientId,
    reason: c.reason
  }))
};

// ⚠️ IMPORTANTE:
// - savedCount: apenas entries que foram INSERT no banco
// - conflictsCount: entries ignoradas por já existirem
// - Total enviado = savedCount + conflictsCount + failedCount
```

---

## 🔑 **2. Campo `clientId` - Identificador Único**

### **2.1 Formato na Extensão**

```typescript
// Extensão envia no formato:
clientId: `local-${entry.id}` // Ex: "local-12345"

// Onde entry.id é o AUTOINCREMENT do SQLite local
```

### **2.2 Validação no Backend**

```typescript
// ✅ Backend DEVE validar formato
if (!entry.clientId || !entry.clientId.startsWith('local-')) {
  throw new BadRequestException('clientId inválido');
}

// ✅ Criar índice único composto
@Index(['userId', 'clientId'], { unique: true })
export class TimeEntry {
  @Column({ unique: false })
  clientId: string; // "local-12345"
  
  @ManyToOne(() => User)
  user: User;
}
```

### **2.3 Query SQL para Verificar Duplicatas**

```sql
-- Execute no banco do backend para verificar integridade:

-- 1. Tem clientId duplicado? (NÃO DEVERIA TER!)
SELECT clientId, COUNT(*) as count 
FROM time_entries 
WHERE clientId IS NOT NULL
GROUP BY clientId 
HAVING count > 1;

-- Resultado esperado: 0 linhas (sem duplicatas)
```

---

## 📊 **3. Logs Backend - O Que Registrar**

### **3.1 Request Recebido**

```typescript
@Post('/push')
async push(@Body() dto: SyncPushDto, @User() user: UserEntity) {
  console.log(`📥 [SYNC PUSH] User: ${user.email}`);
  console.log(`📥 [SYNC PUSH] DeviceKey: ${dto.deviceKey}`);
  console.log(`📥 [SYNC PUSH] Entries recebidas: ${dto.entries.length}`);
  
  // ... lógica de processamento
}
```

### **3.2 Detecção de Conflitos**

```typescript
// Durante processamento de cada entry:
if (existingEntry) {
  console.warn(`⚠️ [SYNC PUSH] Conflito detectado:`);
  console.warn(`   - ClientId: ${entry.clientId}`);
  console.warn(`   - Timestamp: ${entry.timestamp}`);
  console.warn(`   - Razão: Entry já existe no banco`);
  conflicts.push(entry);
}
```

### **3.3 Response Enviado**

```typescript
const response = {
  savedCount: savedEntries.length,
  conflictsCount: conflicts.length
};

console.log(`📤 [SYNC PUSH] Response:`, response);
console.log(`✅ [SYNC PUSH] Salvas: ${response.savedCount}`);
console.log(`⚠️ [SYNC PUSH] Conflitos: ${response.conflictsCount}`);

return response;
```

---

## 🔧 **4. Endpoint `/sync/config` - Configurações Globais**

### **4.1 Estrutura da Response**

```typescript
@Get('/config')
async getConfig() {
  return {
    batchLimit: 100,              // ⚠️ DEVE ser igual na extensão
    syncTimes: ['08:00', '17:00'], // Horários de auto-sync
    maxRetries: 5,                 // Tentativas em caso de falha
    retryDelayMs: 10000            // Delay entre tentativas (ms)
  };
}
```

### **4.2 Validação de Consistência**

```bash
# Verificar se extensão e backend estão alinhados:

# 1. Backend retorna:
GET /sync/config → { batchLimit: 100 }

# 2. Extensão usa:
const SYNC_BATCH_LIMIT = 200 // ❌ INCONSISTENTE!

# ✅ CORRETO: Ambos devem usar o mesmo valor (100)
```

---

## 🧪 **5. Testes Manuais - Validação de Conflitos**

### **5.1 Teste de Duplicata Simples**

```bash
# Envie a mesma entry 2x:
curl -X POST http://localhost:8989/sync/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceKey": "test-device",
    "entries": [
      {
        "clientId": "local-999",
        "timestamp": "2025-11-23T10:00:00Z",
        "project": "TestProject",
        "file": "test.ts",
        "durationSeconds": 300,
        "isIdle": false
      }
    ]
  }'

# Primeira chamada:
# Response: { savedCount: 1, conflictsCount: 0 }

# Segunda chamada (mesma entry):
# Response: { savedCount: 0, conflictsCount: 1 } ✅
```

### **5.2 Teste de Batch com Conflitos**

```bash
# Envie 10 entries, sendo 5 duplicatas:
curl -X POST http://localhost:8989/sync/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceKey": "test-device",
    "entries": [
      {"clientId": "local-1", ...},  // Nova
      {"clientId": "local-2", ...},  // Nova
      {"clientId": "local-999", ...}, // Duplicata!
      {"clientId": "local-3", ...},  // Nova
      {"clientId": "local-999", ...}, // Duplicata!
      ...
    ]
  }'

# Response esperado:
# { savedCount: 5, conflictsCount: 5 } ✅
```

---

## 🗄️ **6. Estrutura da Tabela Backend**

### **6.1 Schema Recomendado**

```sql
CREATE TABLE time_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  device_key VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,  -- ⚠️ CRÍTICO: deve existir!
  timestamp TIMESTAMP NOT NULL,
  project VARCHAR(255),
  file VARCHAR(255),
  duration_seconds INTEGER NOT NULL,
  is_idle BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Índice único composto para evitar duplicatas
  UNIQUE(user_id, client_id)
);

-- Índices para performance
CREATE INDEX idx_time_entries_user_device ON time_entries(user_id, device_key);
CREATE INDEX idx_time_entries_timestamp ON time_entries(timestamp);
```

### **6.2 Validação no Banco**

```sql
-- 1. Verificar se campo client_id existe:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_entries' AND column_name = 'client_id';

-- Resultado esperado: 1 linha
-- client_id | character varying

-- 2. Verificar constraint UNIQUE:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'time_entries' AND constraint_type = 'UNIQUE';

-- Deve ter constraint em (user_id, client_id)
```

---

## 📈 **7. Queries de Diagnóstico**

### **7.1 Verificar Total de Entries**

```sql
-- Quantas entries por usuário?
SELECT u.email, COUNT(te.id) as total_entries
FROM users u
LEFT JOIN time_entries te ON te.user_id = u.id
GROUP BY u.id, u.email
ORDER BY total_entries DESC;
```

### **7.2 Verificar Entries por Device**

```sql
-- Quantas entries por dispositivo?
SELECT device_key, COUNT(*) as total
FROM time_entries
GROUP BY device_key
ORDER BY total DESC;
```

### **7.3 Detectar Possíveis Duplicatas**

```sql
-- Entries com mesmo timestamp e projeto (pode ser duplicata)?
SELECT timestamp, project, COUNT(*) as count
FROM time_entries
GROUP BY timestamp, project
HAVING count > 1
LIMIT 10;
```

---

## ⚠️ **8. Problemas Comuns e Soluções**

### **8.1 Backend retorna `savedCount` errado**

**Sintoma:** Extensão marca entries como synced, mas elas não aparecem no backend.

**Causa:** Backend conta conflitos no `savedCount`.

**Solução:**
```typescript
// ❌ ERRADO
const savedCount = entries.length; // Conta tudo!

// ✅ CORRETO
const savedCount = savedEntries.length; // Apenas as realmente salvas
```

### **8.2 Campo `clientId` não existe**

**Sintoma:** Todas entries são tratadas como duplicatas.

**Causa:** Tabela backend não tem coluna `client_id`.

**Solução:**
```sql
-- Adicionar coluna:
ALTER TABLE time_entries ADD COLUMN client_id VARCHAR(255);

-- Criar índice único:
CREATE UNIQUE INDEX idx_unique_client ON time_entries(user_id, client_id);
```

### **8.3 Conflitos Infinitos**

**Sintoma:** Loop nunca termina, sempre retorna conflitos.

**Causa:** Backend usa timestamp ao invés de clientId para detectar duplicatas.

**Solução:**
```typescript
// ❌ ERRADO
const existing = await findOne({ timestamp: entry.timestamp });

// ✅ CORRETO
const existing = await findOne({ 
  userId: user.id,
  clientId: entry.clientId 
});
```

---

## ✅ **9. Checklist Final**

Antes de considerar o sync 100% funcional, verifique:

- [ ] Campo `client_id` existe na tabela `time_entries`
- [ ] Índice UNIQUE em `(user_id, client_id)` criado
- [ ] Backend detecta duplicatas usando `clientId`
- [ ] `savedCount` retorna apenas entries realmente salvas
- [ ] `conflictsCount` retorna entries ignoradas (duplicatas)
- [ ] `/sync/config` retorna `batchLimit` igual à extensão
- [ ] Logs registram conflitos com detalhes
- [ ] Teste manual com duplicata retorna `conflictsCount > 0`
- [ ] Query SQL não encontra `clientId` duplicado

---

## 📞 **10. Informações para Debug**

Se a sincronização ainda não funcionar, compartilhe:

1. **Log completo de 1 request `/sync/push`** (backend)
2. **Estrutura da tabela:** `DESCRIBE time_entries;`
3. **5 entries de exemplo:** `SELECT * FROM time_entries LIMIT 5;`
4. **Contagem de duplicatas:** Query da seção 6.2
5. **Config atual:** `GET /sync/config` response
6. **Logs da extensão:** Output do console durante sync

---

**Última atualização:** 23 de novembro de 2025  
**Versão da extensão:** 0.2.1  
**Versão do documento:** 1.0
