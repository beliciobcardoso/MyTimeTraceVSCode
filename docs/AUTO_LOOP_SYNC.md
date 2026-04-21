# 🔄 Sistema de Loop Automático de Sincronização

⚠️ **STATUS: LEGADO (Deprecated desde v0.5.1)**  
Este documento descreve a implementação anterior com pull bidirecional. A partir de v0.5.1, o sync é **unidirecional (push-only)**. Veja [PLANO_SYNC_UNIDIRECIONAL_EXT_CLOUD.md](PLANO_SYNC_UNIDIRECIONAL_EXT_CLOUD.md) para arquitetura atual.

---

## Visão Geral

Implementação de sincronização automática em loop que processa **todas** as entries pendentes em batches sequenciais de 100 entries, sem necessidade de múltiplas execuções manuais.

## Motivação

**Problema Original:**
- Usuários com 500+ entries pendentes precisavam executar "Sync Now" 5+ vezes
- Cada execução sincronizava apenas 100 entries
- Experiência de usuário frustrante e propensa a erros

**Solução Implementada:**
- Um único comando "Sync Now" processa **todas** as entries automaticamente
- Loop inteligente que detecta quando não há mais entries pendentes
- Feedback de progresso batch por batch

## Arquitetura

### Fluxo de Execução

```
┌─────────────────────────────────────────────────┐
│ performSync() - Orquestrador Principal         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Loop Automático (while hasMoreEntries)        │
├─────────────────────────────────────────────────┤
│ 1️⃣ pushEntries(apiKey) → retorna syncedCount   │
│ 2️⃣ pullEntries(apiKey) → legado/não usado ⚠️  │
│ 3️⃣ Verifica: syncedCount >= 100?              │
│    ├─ SIM → hasMoreEntries = true (continua)  │
│    └─ NÃO → hasMoreEntries = false (para)     │
└─────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Resultado: Todas entries sincronizadas! 🎉    │
└─────────────────────────────────────────────────┘
```

### Código Core

**Antes (Manual):**
```typescript
private async performSync(): Promise<boolean> {
  await this.pushEntries(apiKey);  // Só 100 entries
  await this.pullEntries(apiKey);  // Uma vez só
  return true;
}
```

**Depois (Auto-Loop - LEGADO):**
```typescript
private async performSync(): Promise<boolean> {
  let totalSynced = 0;
  let hasMoreEntries = true;
  let batchCount = 0;
  
  while (hasMoreEntries) {
    batchCount++;
    const syncedCount = await this.pushEntries(apiKey);
    // await this.pullEntries(apiKey); // ❌ REMOVIDO - legado desde v0.5.1
    
    totalSynced += syncedCount;
    hasMoreEntries = syncedCount >= 100; // Continua se batch cheio
  }
  
  console.log(`✅ Total: ${totalSynced} entries em ${batchCount} batches`);
  return true;
}
```

## Modificações Técnicas

### 1. `pushEntries()` - Nova Assinatura

**Antes:**
```typescript
private async pushEntries(apiKey: string): Promise<void>
```

**Depois:**
```typescript
private async pushEntries(apiKey: string): Promise<number>
```

**Mudanças:**
- Retorna `result.savedCount` do backend (número de entries salvas)
- Usado para determinar se há mais batches pendentes
- `return 0` quando não há entries para sincronizar

### 2. `performSync()` - Loop Inteligente

**Lógica de Continuação:**
```typescript
hasMoreEntries = syncedCount >= 100;
```

| Cenário | syncedCount | hasMoreEntries | Ação |
|---------|-------------|----------------|------|
| 250 entries total | 100 → 100 → 50 | true → true → false | 3 batches |
| 80 entries total | 80 | false | 1 batch (para) |
| 0 entries | 0 | false | Nenhum batch |

### 3. Feedback de Progresso

**Logs por Batch:**
```
🔄 Batch 1...
📤 Push: Enviando 100 entries...
✅ Push: 100 entries sincronizadas
📊 Batch 1 completo. 100 entries sincronizadas. Continuando...

🔄 Batch 2...
📤 Push: Enviando 100 entries...
✅ Push: 100 entries sincronizadas
📊 Batch 2 completo. 100 entries sincronizadas. Continuando...

🔄 Batch 3...
📤 Push: Enviando 50 entries...
✅ Push: 50 entries sincronizadas

✅ Sincronização completa! Total: 250 entries em 3 batch(es)
```

## Integração com Sistema Existente

### Retry Automático Mantido

```typescript
const result = await this.retryManager.execute(async () => {
  const syncedCount = await this.pushEntries(apiKey);
  // await this.pullEntries(apiKey); // ❌ REMOVIDO - legado desde v0.5.1
  return syncedCount;
});

if (result === null) {
  console.error('❌ Sincronização falhou após todos os retries');
  return false;
}
```

- **5 tentativas** por batch (configurável)
- **10s de delay** entre tentativas
- Se um batch falhar após retries, o loop **para** e retorna `false`

### Status Bar Integration

```typescript
this.statusBarManager.setSyncStatus(true);   // Ativa ícone de sync
// ... loop executa ...
this.statusBarManager.setSyncStatus(false);  // Desativa ao concluir
```

Usuário vê feedback visual durante **todo** o processo de sync (mesmo em múltiplos batches).

## Testes Recomendados

### Cenário 1: Sync de 250 Entries
```
Preparação:
- Criar 250 entries não sincronizadas no SQLite
- Executar: "MyTimeTrace: Sync Now"

Resultado Esperado:
✅ 3 batches executados (100 + 100 + 50)
✅ Log mostra progresso de cada batch
✅ Total: 250 entries sincronizadas
✅ 0 entries pendentes após conclusão
```

### Cenário 2: Sync Incremental
```
Preparação:
- Criar 80 entries não sincronizadas
- Executar: "MyTimeTrace: Sync Now"

Resultado Esperado:
✅ 1 batch executado (80)
✅ Loop para imediatamente (80 < 100)
✅ Total: 80 entries sincronizadas
```

### Cenário 3: Nenhuma Entry Pendente
```
Preparação:
- Todas entries já sincronizadas
- Executar: "MyTimeTrace: Sync Now"

Resultado Esperado:
✅ 0 batches executados
✅ Log: "Nenhuma entry para sincronizar"
✅ Retorno imediato
```

## Performance e Limites (LEGADO)

### Carga no Backend - Antiga (com pull bidirecional)

| Entries Totais | Batches | Requests HTTP | Tempo Estimado* |
|----------------|---------|---------------|------------------|
| 100 | 1 | 1 (push only) | ~1s |
| 500 | 5 | 5 (5 push) | ~5s |
| 1000 | 10 | 10 (10 push) | ~10s |

*Desde v0.5.1: apenas push-only, sem pull. Tempo reduzido 50%

### Otimizações Futuras

1. **Batch Size Dinâmico:**
   - Aumentar para 200 se servidor suportar
   - Reduzir para 50 em conexões lentas

3. **Progress Callback:**
   - Emitir eventos de progresso para UI
   - Barra de progresso no status bar

## Compatibilidade

### Mudanças Backward Compatible

✅ **Comandos VSCode:** Nenhuma mudança na API pública  
✅ **Backend:** Usa endpoints existentes (`/sync/push` ativo, `/sync/pull` legado)  
✅ **Database:** Mesma estrutura SQLite  
✅ **Configuração:** Nenhuma nova config necessária  

### Breaking Changes

❌ **Nenhuma!** Implementação 100% retrocompatível.

## Logs de Exemplo

### Sync Completo (250 entries)
```
🔄 Iniciando sincronização completa...
🔄 Batch 1...
📤 Push: Enviando 100 entries...
✅ Push: 100 entries sincronizadas
� Batch 1 completo. 100 entries sincronizadas. Continuando...

🔄 Batch 2...
📤 Push: Enviando 100 entries...
✅ Push: 100 entries sincronizadas
📊 Batch 2 completo. 100 entries sincronizadas. Continuando...

🔄 Batch 3...
📤 Push: Enviando 50 entries...
✅ Push: 50 entries sincronizadas

✅ Sincronização completa! Total: 250 entries em 3 batch(es)
```

## Conclusão

O sistema de loop automático transforma o sync de uma **tarefa manual repetitiva** em um **processo transparente e eficiente**. Usuários com grandes backlogs agora têm uma experiência fluida, independente do volume de entries pendentes.

**Benefícios:**
- ✅ Experiência de usuário superior
- ✅ Sincronização completa garantida
- ✅ Feedback de progresso detalhado
- ✅ Mantém retry automático por batch
- ✅ Zero breaking changes

---

**Documentação Criada:** 2024  
**Versão da Extensão:** 0.4.0+  
**Status:** ✅ Implementado e testado
