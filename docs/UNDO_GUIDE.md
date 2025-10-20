# ♻️ Guia de Undo - Como Recuperar Projetos Deletados

**Status:** ✅ IMPLEMENTADO  
**Versão:** 0.2.1  
**Data:** 19 de outubro de 2025

---

## 🎯 O Que é o Undo?

Sistema de **restauração de projetos** que permite recuperar projetos deletados acidentalmente. Funciona através do **Soft Delete**, onde os dados são apenas marcados como deletados, mas não removidos permanentemente.

---

## ⚡ Guia Rápido (TL;DR)

```javascript
// 1. Ver projetos deletados
const deleted = await dbManager.getDeletedProjects();
console.table(deleted);

// 2. Restaurar um projeto
await dbManager.restoreProjectHistory('NomeDoProjeto');

// 3. Reabrir dashboard para ver o projeto de volta!
```

---

## 📋 Passo a Passo Completo

### **Passo 1: Abrir Developer Tools**

```
Menu: Help → Toggle Developer Tools
Ou: Ctrl+Shift+I (Windows/Linux) / Cmd+Opt+I (Mac)
```

### **Passo 2: Ir para o Console**

```
Clique na aba "Console" no Developer Tools
```

### **Passo 3: Ver Histórico de Exclusões**

#### **Método A: Comando Visual**
```
1. Pressione Ctrl+Shift+P
2. Digite "Deletion History" ou "Histórico"
3. Selecione "My Time Trace: Deletion History"
4. ✅ Ver lista de projetos deletados com estatísticas
```

#### **Método B: Via Console**
```javascript
// Ver lista completa de projetos deletados
const deleted = await dbManager.getDeletedProjects();
console.table(deleted);

// Output exemplo:
// ┌─────────┬──────────────┬─────────────────────┬───────────────┐
// │ (index) │   project    │     deleted_at      │ records_count │
// ├─────────┼──────────────┼─────────────────────┼───────────────┤
// │    0    │ 'MeuProjeto' │ '2025-10-19 14:30'  │      42       │
// │    1    │ 'OutroProjeto'│ '2025-10-18 10:20' │      15       │
// └─────────┴──────────────┴─────────────────────┴───────────────┘
```

### **Passo 4: Restaurar um Projeto**

```javascript
// Substituir 'MeuProjeto' pelo nome do projeto que deseja restaurar
await dbManager.restoreProjectHistory('MeuProjeto');

// ✅ Output esperado:
// "♻️ Restaurando projeto: MeuProjeto"
// "✅ 42 registro(s) restaurado(s) do projeto MeuProjeto"
// "📝 Restauração registrada: MeuProjeto"
```

### **Passo 5: Verificar Restauração**

```javascript
// Confirmar que projeto não está mais na lista de deletados
const stillDeleted = await dbManager.getDeletedProjects();
console.log('Projetos ainda deletados:', stillDeleted.length);

// Ver histórico completo (incluindo restaurados)
const fullHistory = await dbManager.getDeletionHistory(true);
console.table(fullHistory);
```

### **Passo 6: Reabrir Dashboard**

```
1. Feche o dashboard atual (se estiver aberto)
2. Ctrl+Shift+P → "My Time Trace: Show Stats"
3. Selecione "Simple Stats" ou "Stats with Filters"
4. ✅ Projeto restaurado aparece normalmente!
```

---

## 🧪 Cenários de Uso

### **Cenário 1: Deletou Por Acidente Há Pouco Tempo**

```javascript
// 1. Ver o que foi deletado recentemente
const deleted = await dbManager.getDeletedProjects();
console.log('Último deletado:', deleted[0]); // Mais recente primeiro

// 2. Restaurar imediatamente
await dbManager.restoreProjectHistory(deleted[0].project);

// ✅ Projeto de volta em segundos!
```

---

### **Cenário 2: Deletou Vários Projetos, Quer Restaurar Apenas Um**

```javascript
// 1. Ver todos os deletados
const deleted = await dbManager.getDeletedProjects();
deleted.forEach((p, i) => {
  console.log(`${i + 1}. ${p.project} - ${p.records_count} registros`);
});

// Output:
// 1. MeuProjeto - 42 registros
// 2. OutroProjeto - 15 registros
// 3. ProjetoAntigo - 8 registros

// 2. Escolher qual restaurar
await dbManager.restoreProjectHistory('OutroProjeto'); // Apenas este

// ✅ Apenas o escolhido é restaurado!
```

---

### **Cenário 3: Restaurar Tudo Que Foi Deletado**

```javascript
// 1. Buscar todos os deletados
const deleted = await dbManager.getDeletedProjects();

// 2. Restaurar todos em loop
for (const project of deleted) {
  await dbManager.restoreProjectHistory(project.project);
  console.log(`✅ ${project.project} restaurado!`);
}

// ✅ Todos os projetos voltaram!
```

---

### **Cenário 4: Ver Histórico Completo de Exclusões e Restaurações**

```javascript
// Ver TUDO: deletados, restaurados, permanentes
const fullHistory = await dbManager.getDeletionHistory(true);

console.table(fullHistory);

// Filtrar apenas restaurados
const restored = fullHistory.filter(h => h.status === 'restored');
console.log(`${restored.length} projeto(s) já foram restaurados antes`);

// Filtrar apenas pendentes
const pending = fullHistory.filter(h => h.status === 'deleted');
console.log(`${pending.length} projeto(s) ainda podem ser restaurados`);

// Filtrar permanentes (não podem ser restaurados)
const permanent = fullHistory.filter(h => h.status === 'permanent');
console.log(`${permanent.length} projeto(s) foram deletados permanentemente`);
```

---

## ⚠️ Limitações Importantes

### **1. Hard Delete NÃO Pode Ser Restaurado**

```javascript
// ❌ PERMANENTE - impossível recuperar
await dbManager.hardDeleteProjectHistory('ProjetoAntigo');

// Tentar restaurar:
await dbManager.restoreProjectHistory('ProjetoAntigo');
// ✅ Retorna: 0 registros restaurados (porque não existem mais)
```

**Como identificar:**
```javascript
const history = await dbManager.getDeletionHistory(true);
const permanent = history.filter(h => h.deletion_type === 'hard');
console.log('Estes NÃO podem ser restaurados:', permanent);
```

### **2. Soft Delete Pode Ser Restaurado**

```javascript
// ✅ REVERSÍVEL - pode ser restaurado
await dbManager.deleteProjectHistory('MeuProjeto');

// Restaurar a qualquer momento:
await dbManager.restoreProjectHistory('MeuProjeto');
// ✅ Retorna: 42 registros restaurados
```

### **3. Dashboard Não Atualiza Automaticamente**

⚠️ **Importante:** Após restaurar, você precisa **fechar e reabrir o dashboard** para ver as mudanças.

**Por quê?**
- Dashboard gera HTML estático no momento da abertura
- Restauração acontece no banco, mas HTML já foi gerado
- Solução: Fechar painel e abrir novamente

---

## 🔍 Comandos Úteis

### **Ver Estatísticas de Restauração**

```javascript
const history = await dbManager.getDeletionHistory(true);

const stats = {
  total: history.length,
  softDeletes: history.filter(h => h.deletion_type === 'soft').length,
  hardDeletes: history.filter(h => h.deletion_type === 'hard').length,
  restored: history.filter(h => h.status === 'restored').length,
  pending: history.filter(h => h.status === 'deleted').length,
  permanent: history.filter(h => h.status === 'permanent').length
};

console.log(`
📊 Estatísticas:
───────────────────────
Total de operações: ${stats.total}
  ├─ Soft deletes: ${stats.softDeletes}
  └─ Hard deletes: ${stats.hardDeletes}

Status:
  ├─ Restaurados: ${stats.restored}
  ├─ Pendentes: ${stats.pending}
  └─ Permanentes: ${stats.permanent}

Taxa de restauração: ${((stats.restored / stats.softDeletes) * 100).toFixed(1)}%
`);
```

### **Ver Quando Projeto Foi Deletado**

```javascript
const deleted = await dbManager.getDeletedProjects();
const project = deleted.find(p => p.project === 'MeuProjeto');

if (project) {
  const deletedDate = new Date(project.deleted_at);
  const now = new Date();
  const hoursSince = Math.floor((now - deletedDate) / (1000 * 60 * 60));
  
  console.log(`
📝 ${project.project}
───────────────────────
Deletado em: ${deletedDate.toLocaleString('pt-BR')}
Há: ${hoursSince} horas
Registros: ${project.records_count}
  `);
}
```

### **Verificar Se Projeto Existe (Ativo ou Deletado)**

```javascript
// Verificar se está ativo
const active = await dbManager.query(`
  SELECT COUNT(*) as count 
  FROM time_entries 
  WHERE project = ? AND deleted_at IS NULL
`, ['MeuProjeto']);

// Verificar se está deletado
const deleted = await dbManager.query(`
  SELECT COUNT(*) as count 
  FROM time_entries 
  WHERE project = ? AND deleted_at IS NOT NULL
`, ['MeuProjeto']);

console.log(`
Status de "MeuProjeto":
  Registros ativos: ${active[0].count}
  Registros deletados: ${deleted[0].count}
  
${active[0].count > 0 ? '✅ Projeto ATIVO' : ''}
${deleted[0].count > 0 ? '🗑️ Projeto DELETADO (pode restaurar)' : ''}
${active[0].count === 0 && deleted[0].count === 0 ? '❌ Projeto não existe' : ''}
`);
```

---

## 🎯 Casos de Uso Avançados

### **Restauração Seletiva Por Data**

```javascript
// Restaurar apenas projetos deletados hoje
const deleted = await dbManager.getDeletedProjects();
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

for (const project of deleted) {
  if (project.deleted_at.startsWith(today)) {
    await dbManager.restoreProjectHistory(project.project);
    console.log(`✅ ${project.project} restaurado (deletado hoje)`);
  }
}
```

### **Restauração Por Tamanho**

```javascript
// Restaurar apenas projetos com mais de 50 registros
const deleted = await dbManager.getDeletedProjects();

for (const project of deleted) {
  if (project.records_count >= 50) {
    await dbManager.restoreProjectHistory(project.project);
    console.log(`✅ ${project.project} restaurado (${project.records_count} registros)`);
  }
}
```

### **Preview Antes de Restaurar**

```javascript
// Ver quantos registros serão restaurados
const projectName = 'MeuProjeto';

const preview = await dbManager.query(`
  SELECT 
    COUNT(*) as total_records,
    MIN(timestamp) as first_entry,
    MAX(timestamp) as last_entry,
    SUM(duration_seconds) as total_seconds
  FROM time_entries
  WHERE project = ? AND deleted_at IS NOT NULL
`, [projectName]);

console.log(`
📊 Preview de Restauração: ${projectName}
─────────────────────────────────────
Registros: ${preview[0].total_records}
Primeira entrada: ${new Date(preview[0].first_entry).toLocaleString('pt-BR')}
Última entrada: ${new Date(preview[0].last_entry).toLocaleString('pt-BR')}
Tempo total: ${Math.floor(preview[0].total_seconds / 3600)}h ${Math.floor((preview[0].total_seconds % 3600) / 60)}min

Confirma restauração? Execute:
await dbManager.restoreProjectHistory('${projectName}');
`);
```

---

## 📚 Documentação Relacionada

- 📘 [SOFT_DELETE.md](./SOFT_DELETE.md) - Sistema completo de Soft Delete
- 📘 [DELETION_HISTORY.md](./DELETION_HISTORY.md) - Histórico e auditoria
- 📘 [IMPLEMENTACAO_EXCLUSAO.md](./IMPLEMENTACAO_EXCLUSAO.md) - Implementação técnica

---

## 🚀 Interface Visual (Futuro - v0.3.0)

Em breve haverá uma interface visual para facilitar restaurações:

```
╔══════════════════════════════════════════════════╗
║  🗑️ Projetos Deletados                          ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  ┌────────────────────────────────────────────┐ ║
║  │ MeuProjeto                      [Deletado] │ ║
║  │ 📅 Deletado há 2 horas                     │ ║
║  │ 📊 42 registros                            │ ║
║  │                                            │ ║
║  │ [♻️ Restaurar] [💥 Deletar Permanentemente]│ ║
║  └────────────────────────────────────────────┘ ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

Por enquanto, use o console do Developer Tools conforme este guia! 🚀

---

**🎉 Undo totalmente funcional! Seus dados estão seguros!** ✅
