# 🔄 Soft Delete - Exclusão Reversível de Projetos

**Status:** ✅ IMPLEMENTADO  
**Data:** 19 de outubro de 2025  
**Versão:** 0.2.1  
**Branch:** feature/dashboard2

---

## 🎯 O Que É Soft Delete?

**Soft Delete** é uma técnica onde os dados **NÃO são deletados permanentemente** do banco. Em vez disso, são **marcados como deletados** com um timestamp, permitindo:

- ✅ **Recuperação** de projetos deletados acidentalmente
- ✅ **Auditoria** completa de exclusões
- ✅ **Histórico** de quando foi deletado
- ✅ **Segurança** contra perda acidental de dados

---

## 🆚 Comparação: Soft vs Hard Delete

### **Hard Delete (Antigo)**
```sql
DELETE FROM time_entries WHERE project = 'MeuProjeto';
```
- ❌ Dados perdidos permanentemente
- ❌ Impossível recuperar
- ❌ Sem histórico de exclusão
- ✅ Libera espaço no banco

### **Soft Delete (Novo - Padrão)**
```sql
UPDATE time_entries 
SET deleted_at = datetime('now') 
WHERE project = 'MeuProjeto' AND deleted_at IS NULL;
```
- ✅ Dados preservados
- ✅ Possível recuperar
- ✅ Histórico completo
- ⚠️ Ocupa espaço no banco

---

## 📊 Estrutura do Banco de Dados

### **Nova Coluna Adicionada**

```sql
ALTER TABLE time_entries ADD COLUMN deleted_at TEXT DEFAULT NULL;
```

**Significado:**
- `deleted_at = NULL` → Registro **ATIVO** (visível)
- `deleted_at = '2025-10-19 14:30:00'` → Registro **DELETADO** (oculto)

### **Migração Automática**

A migração é aplicada automaticamente ao:
1. ✅ Iniciar a extensão pela primeira vez após atualização
2. ✅ Detecta se coluna já existe (não duplica)
3. ✅ Logs claros no console do VS Code
4. ✅ Compatível com bancos existentes

**Console Logs:**
```
✅ Coluna deleted_at adicionada com sucesso (migração aplicada)
// ou
✅ Coluna deleted_at já existe (migração já aplicada)
```

---

## 🔧 Métodos Implementados

### **1. deleteProjectHistory() - Soft Delete**

```typescript
await dbManager.deleteProjectHistory('MeuProjeto');
```

**Funcionalidade:**
- Marca registros como deletados
- Preserva dados no banco
- Permite recuperação posterior
- **Uso:** Exclusão padrão via interface

**SQL Executado:**
```sql
UPDATE time_entries 
SET deleted_at = datetime('now') 
WHERE project = ? AND deleted_at IS NULL
```

---

### **2. hardDeleteProjectHistory() - DELETE Permanente**

```typescript
await dbManager.hardDeleteProjectHistory('MeuProjeto');
```

**Funcionalidade:**
- Remove PERMANENTEMENTE do banco
- Sem possibilidade de recuperação
- Libera espaço em disco
- **Uso:** Limpeza administrativa

**SQL Executado:**
```sql
DELETE FROM time_entries WHERE project = ?
```

⚠️ **ATENÇÃO:** Usar apenas para limpeza definitiva!

---

### **3. restoreProjectHistory() - Recuperação**

```typescript
await dbManager.restoreProjectHistory('MeuProjeto');
```

**Funcionalidade:**
- Restaura projeto deletado
- Volta a aparecer no dashboard
- Remove marca de exclusão

**SQL Executado:**
```sql
UPDATE time_entries 
SET deleted_at = NULL 
WHERE project = ? AND deleted_at IS NOT NULL
```

---

### **4. getDeletedProjects() - Listar Deletados**

```typescript
const deletedProjects = await dbManager.getDeletedProjects();
```

**Retorna:**
```typescript
[
  {
    project: 'MeuProjeto',
    deleted_at: '2025-10-19 14:30:00',
    records_count: 42
  },
  {
    project: 'OutroProjeto',
    deleted_at: '2025-10-18 10:15:00',
    records_count: 15
  }
]
```

**Funcionalidade:**
- Lista todos os projetos deletados
- Ordenado por data de exclusão (mais recente primeiro)
- Mostra quantos registros cada projeto tem

---

## 🔍 Filtragem Automática

### **Todas as Queries Foram Atualizadas**

**ANTES:**
```sql
SELECT * FROM time_entries WHERE is_idle = 0
```

**AGORA:**
```sql
SELECT * FROM time_entries WHERE is_idle = 0 AND deleted_at IS NULL
```

**Locais Atualizados:**
- ✅ `showSimpleStats()` - Query de dados processados
- ✅ `showSimpleStats()` - Query de dados brutos
- ✅ `showStatsWithFilters()` - Query de dados brutos
- ✅ `showStatsWithFilters()` - Query de projetos disponíveis
- ✅ `loadStatsData()` - Helper de recarga

**Resultado:** Projetos deletados **não aparecem** automaticamente no dashboard!

---

## 🧪 Como Testar

### **Teste 1: Soft Delete Básico**

1. **Abra o dashboard**
2. **Veja quantos projetos tem** (ex: 5 projetos)
3. **Delete um projeto** via botão "Excluir"
4. ✅ Projeto desaparece do dashboard (agora 4 projetos)
5. **Verifique no banco:**
   ```bash
   sqlite3 ~/.vscode/globalStorage/.../time_tracker.sqlite
   
   SELECT project, deleted_at 
   FROM time_entries 
   WHERE project = 'NomeDoProjeto' 
   LIMIT 1;
   ```
6. ✅ **Resultado:** `deleted_at` tem valor (não é NULL)

---

### **Teste 2: Recuperação de Projeto**

**Via Developer Console do VS Code:**

```javascript
// 1. Abra Developer Tools (Help → Toggle Developer Tools)
// 2. Vá para aba "Console"
// 3. Execute:

// Listar projetos deletados
const deleted = await dbManager.getDeletedProjects();
console.log('Projetos deletados:', deleted);

// Restaurar um projeto
await dbManager.restoreProjectHistory('MeuProjeto');

// 4. Feche e reabra o dashboard
// ✅ Projeto voltou a aparecer!
```

---

### **Teste 3: Hard Delete (Cuidado!)**

```javascript
// ⚠️ ATENÇÃO: Isso é PERMANENTE!

// Deletar permanentemente
await dbManager.hardDeleteProjectHistory('ProjetoAntigo');

// Verificar no banco
// ✅ Registros foram REMOVIDOS completamente
```

---

## 📋 Interface Futura para Recuperação

### **Tela de Projetos Deletados (Sugestão)**

```
╔═══════════════════════════════════════════════════╗
║  🗑️ Projetos Deletados                            ║
╠═══════════════════════════════════════════════════╣
║                                                   ║
║  MeuProjeto                                       ║
║  📅 Deletado em: 19/10/2025 14:30                 ║
║  📊 42 registros                                   ║
║  [♻️ Restaurar] [💥 Deletar Permanentemente]      ║
║                                                   ║
║  ─────────────────────────────────────────────── ║
║                                                   ║
║  OutroProjeto                                     ║
║  📅 Deletado em: 18/10/2025 10:15                 ║
║  📊 15 registros                                   ║
║  [♻️ Restaurar] [💥 Deletar Permanentemente]      ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
```

---

## 🔒 Segurança e Performance

### **Índices Recomendados**

Para melhorar performance das queries:

```sql
-- Índice para filtragem de deletados
CREATE INDEX idx_deleted_at ON time_entries(deleted_at);

-- Índice composto (projeto + deleted_at)
CREATE INDEX idx_project_deleted ON time_entries(project, deleted_at);
```

### **Limpeza Periódica (Opcional)**

Para liberar espaço, você pode criar um job de limpeza:

```typescript
/**
 * Deleta permanentemente registros deletados há mais de X dias
 */
async cleanupOldDeletedRecords(daysOld: number = 30): Promise<number> {
  const sql = `
    DELETE FROM time_entries 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < datetime('now', '-${daysOld} days')
  `;
  
  return new Promise((resolve, reject) => {
    this.db!.run(sql, [], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}
```

---

## 📊 Comparação de Queries

### **Dashboard Principal**

**ANTES (Hard Delete):**
```sql
SELECT project, SUM(duration_seconds) as total
FROM time_entries
WHERE is_idle = 0
GROUP BY project;
-- Retorna TODOS os projetos
```

**AGORA (Soft Delete):**
```sql
SELECT project, SUM(duration_seconds) as total
FROM time_entries
WHERE is_idle = 0 AND deleted_at IS NULL
GROUP BY project;
-- Retorna apenas projetos ATIVOS
```

### **Listar Deletados**

**NOVO:**
```sql
SELECT DISTINCT project, 
       MAX(deleted_at) as deleted_at,
       COUNT(*) as records_count
FROM time_entries 
WHERE deleted_at IS NOT NULL
GROUP BY project
ORDER BY deleted_at DESC;
```

---

## 🎯 Vantagens do Soft Delete

### **Para Usuários**
- ✅ Proteção contra exclusão acidental
- ✅ Possibilidade de recuperar dados
- ✅ Histórico completo de ações
- ✅ Sem perda de dados importantes

### **Para Desenvolvedores**
- ✅ Auditoria de ações
- ✅ Logs de quando foi deletado
- ✅ Análise de padrões de exclusão
- ✅ Facilita debug e suporte

### **Para o Sistema**
- ✅ Integridade referencial mantida
- ✅ Queries consistentes
- ✅ Backup implícito
- ✅ Rollback simplificado

---

## ⚠️ Desvantagens e Mitigações

### **Desvantagem 1: Espaço em Disco**

**Problema:** Registros deletados ocupam espaço

**Mitigação:**
```typescript
// Limpeza automática mensal
setInterval(async () => {
  const cleaned = await dbManager.cleanupOldDeletedRecords(30);
  console.log(`🧹 ${cleaned} registros antigos limpos`);
}, 30 * 24 * 60 * 60 * 1000); // 30 dias
```

### **Desvantagem 2: Performance de Queries**

**Problema:** Adicionar `AND deleted_at IS NULL` em todas as queries

**Mitigação:**
- ✅ Índices otimizados
- ✅ Queries já estavam filtrando `is_idle = 0`
- ✅ Impacto mínimo na performance

### **Desvantagem 3: Complexidade**

**Problema:** Mais lógica para gerenciar

**Mitigação:**
- ✅ Métodos bem documentados
- ✅ Abstrações claras
- ✅ Testes automatizados (futuros)

---

## 📚 Referências Técnicas

### **Padrão de Soft Delete**

Soft Delete é um **padrão amplamente adotado** em sistemas enterprise:

- **Ruby on Rails:** gem `paranoia`
- **Laravel:** trait `SoftDeletes`
- **Django:** `deleted_at` field
- **ASP.NET:** `IsDeleted` property

### **Alternativas Consideradas**

1. **is_deleted BOOLEAN**
   - ❌ Perde informação de quando foi deletado
   - ❌ Não permite ordenação por tempo

2. **Tabela separada (recycle_bin)**
   - ❌ Mais complexo
   - ❌ Queries mais lentas
   - ✅ Separação clara

3. **deleted_at TIMESTAMP (Escolhido!)**
   - ✅ Simples e eficiente
   - ✅ Informação de quando
   - ✅ Padrão da indústria

---

## 🎓 Conclusão

O **Soft Delete** foi implementado com sucesso no MyTimeTrace! 

### **Estado Atual:**
- ✅ Exclusão reversível funcionando
- ✅ Migração automática do banco
- ✅ Todas as queries filtradas
- ✅ Métodos de recuperação prontos
- ⏳ Interface de recuperação (futuro)

### **Próximos Passos:**
1. Criar tela "Projetos Deletados" no dashboard
2. Adicionar botão "Restaurar" na interface
3. Implementar limpeza automática periódica
4. Adicionar testes automatizados

---

**🎉 Soft Delete implementado! Seus dados agora estão mais seguros!** ✅
