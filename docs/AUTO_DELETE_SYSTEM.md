# 🗑️ Sistema de Exclusão Automática Após 30 Dias

## 📋 Visão Geral

O MyTimeTrace VSCode implementa um sistema de **soft delete** com janela de recuperação de **30 dias** e exclusão permanente automática após esse período.

---

## 🔄 Fluxo Completo do Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CICLO DE VIDA DO PROJETO                        │
└─────────────────────────────────────────────────────────────────────┘

Estado 1: ATIVO (deleted_at = NULL)
  │
  │ Usuário clica "Deletar Projeto" no dashboard
  │
  ├──► soft_delete_project(projectName)
  │     └─► UPDATE time_entries SET deleted_at = datetime('now')
  │
Estado 2: DELETADO (deleted_at = '2025-01-15 14:30:00')
  │
  │ ┌────────────── Período de Recuperação (0-30 dias) ──────────────┐
  │ │                                                                  │
  │ │  Usuário pode:                                                  │
  │ │  1. Visualizar no painel "Projetos Deletados"                  │
  │ │  2. Ver quanto tempo resta (dias restantes)                    │
  │ │  3. Restaurar o projeto a qualquer momento                     │
  │ │     └─► restore_project(projectName)                           │
  │ │         └─► UPDATE time_entries SET deleted_at = NULL          │
  │ │                                                                  │
  │ └──────────────────────────────────────────────────────────────────┘
  │
  │ 30 dias se passam... (julianday('now') - julianday(deleted_at) > 30)
  │
  ├──► cleanupExpiredProjects() [Executado manualmente ou por trigger]
  │     └─► DELETE FROM time_entries WHERE deleted_at IS NOT NULL
  │         AND (julianday('now') - julianday(deleted_at)) > 30
  │
Estado 3: REMOVIDO PERMANENTEMENTE ❌
  │
  └──► Dados NÃO podem mais ser recuperados!
```

---

## 🧮 Cálculo de Dias Desde Exclusão

### Função SQL: `julianday()`

```sql
-- Cálculo de dias desde a exclusão
CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) as days_since_deletion

-- Exemplo:
-- deleted_at = '2025-01-15 14:30:00'
-- Data atual = '2025-02-10 10:00:00'
-- Resultado: 26 dias (ainda recuperável)
```

### Classificação de Urgência (UI)

```typescript
// src/ui/deletedProjectsPanel.ts

days_since_deletion <= 7   → 🟢 Verde (Seguro) - "Faltam 23+ dias"
days_since_deletion 8-14   → 🟡 Amarelo (Atenção) - "Faltam 16-22 dias"
days_since_deletion 15-29  → 🔴 Vermelho (Crítico) - "Faltam 1-15 dias"
days_since_deletion >= 30  → ⚫ Cinza (EXPIRADO) - "EXPIRADO - Será deletado"
```

---

## 🔧 Implementação Técnica

### 1. **Soft Delete (Exclusão Inicial)**

```typescript
// src/modules/database.ts - linha ~189
async softDeleteProject(projectName: string): Promise<number> {
  const sql = `
    UPDATE time_entries 
    SET deleted_at = datetime('now') 
    WHERE project = ? 
    AND deleted_at IS NULL
  `;
  
  // Registra no histórico
  await this.logDeletion(projectName, changes, 'soft');
  
  return changes; // Número de registros marcados como deletados
}
```

**Resultado no Banco:**
```
| id | project | file      | deleted_at           | duration_seconds |
|----|---------|-----------|----------------------|------------------|
| 1  | db      | index.ts  | 2025-01-15 14:30:00 | 3600             |
| 2  | db      | auth.ts   | 2025-01-15 14:30:00 | 1800             |
```

---

### 2. **Consulta de Projetos Deletados com Dias Restantes**

```typescript
// src/modules/database.ts - linha ~472
async getDeletedProjectsWithDays(): Promise<Array<{
  project: string;
  deleted_at: string;
  records_count: number;
  days_since_deletion: number;
}>> {
  const sql = `
    SELECT 
      project,
      deleted_at,
      COUNT(*) as records_count,
      CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) as days_since_deletion
    FROM time_entries
    WHERE deleted_at IS NOT NULL
    GROUP BY project, deleted_at
    ORDER BY deleted_at DESC
  `;
  
  return rows;
}
```

**Exemplo de Retorno:**
```json
[
  {
    "project": "db",
    "deleted_at": "2025-01-15 14:30:00",
    "records_count": 145,
    "days_since_deletion": 4  // ← Cálculo automático
  },
  {
    "project": "api-gateway",
    "deleted_at": "2024-12-20 10:00:00",
    "records_count": 89,
    "days_since_deletion": 31  // ← EXPIRADO!
  }
]
```

---

### 3. **Cleanup Automático (Exclusão Permanente)**

```typescript
// src/modules/database.ts - linha ~497
async cleanupExpiredProjects(): Promise<number> {
  console.log('🧹 Iniciando limpeza de projetos expirados (>30 dias)...');

  // PASSO 1: Identificar projetos que serão deletados
  const projectsToDelete = await this.db.all(`
    SELECT DISTINCT project, COUNT(*) as records_count
    FROM time_entries 
    WHERE deleted_at IS NOT NULL 
    AND CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) > 30
    GROUP BY project
  `);

  if (projectsToDelete.length === 0) {
    console.log('✅ Nenhum projeto expirado para limpar');
    return 0;
  }

  // PASSO 2: Registrar no histórico ANTES de deletar
  for (const project of projectsToDelete) {
    await this.logDeletion(project.project, project.records_count, 'hard');
  }

  // PASSO 3: Deletar PERMANENTEMENTE do banco
  await this.db.run(`
    DELETE FROM time_entries 
    WHERE deleted_at IS NOT NULL 
    AND CAST((julianday('now') - julianday(deleted_at)) AS INTEGER) > 30
  `);

  console.log(`✅ ${this.changes} registro(s) de ${projectsToDelete.length} projeto(s) removidos permanentemente`);
  
  return projectsToDelete.length;
}
```

**Logs de Execução:**
```
🧹 Iniciando limpeza de projetos expirados (>30 dias)...
📝 Projetos a serem removidos:
   - api-gateway (89 registros) - 31 dias desde exclusão
   - old-frontend (234 registros) - 45 dias desde exclusão
✅ 323 registro(s) de 2 projeto(s) removidos permanentemente
```

---

### 4. **Histórico de Exclusões**

```sql
-- Tabela deletion_history (rastreamento de auditoria)
CREATE TABLE deletion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  records_count INTEGER NOT NULL,
  deletion_type TEXT NOT NULL,  -- 'soft' ou 'hard'
  restored_at TEXT DEFAULT NULL -- NULL se não restaurado
);
```

**Exemplo de Registros:**
```
| id | project_name | deleted_at           | records_count | deletion_type | restored_at          |
|----|--------------|----------------------|---------------|---------------|----------------------|
| 1  | db           | 2025-01-15 14:30:00 | 145           | soft          | NULL                 |
| 2  | api-gateway  | 2024-12-20 10:00:00 | 89            | hard          | NULL                 |
| 3  | frontend     | 2025-01-10 09:00:00 | 67            | soft          | 2025-01-12 10:30:00 |
```

---

## 🎯 Gatilhos de Exclusão Permanente

### Método 1: Manual (Usuário)

```typescript
// Usuário clica no botão "Limpar Expirados" no painel
// src/modules/stats.ts - linha ~521
private async handleCleanupExpired(panel: vscode.WebviewPanel): Promise<void> {
  try {
    const deletedCount = await this.dbManager.cleanupExpiredProjects();
    
    vscode.window.showInformationMessage(
      `${deletedCount} projeto(s) expirado(s) removido(s) permanentemente`
    );
    
    // Atualiza painel
    this.showDeletedProjects();
  } catch (error) {
    vscode.window.showErrorMessage(`Erro ao limpar projetos: ${error}`);
  }
}
```

### Método 2: Automático ✅ (Implementado)

```typescript
// src/extension.ts - Linha ~90

// 🧹 CLEANUP AUTOMÁTICO DE PROJETOS EXPIRADOS (>30 DIAS)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

// Executar cleanup inicial após 5 minutos
setTimeout(async () => {
  const deletedCount = await dbManager.cleanupExpiredProjects();
  if (deletedCount > 0) {
    console.log(`🧹 Cleanup inicial: ${deletedCount} projeto(s) removido(s)`);
    vscode.window.showInformationMessage(
      `My Time Trace: ${deletedCount} projeto(s) expirado(s) limpo(s) automaticamente`
    );
  }
}, 5 * 60 * 1000);

// Executar cleanup a cada 24 horas
cleanupInterval = setInterval(async () => {
  try {
    const deletedCount = await dbManager.cleanupExpiredProjects();
    if (deletedCount > 0) {
      console.log(`🧹 Cleanup automático: ${deletedCount} projeto(s) removido(s)`);
      vscode.window.showInformationMessage(
        `My Time Trace: ${deletedCount} projeto(s) expirado(s) limpo(s) automaticamente`
      );
    }
  } catch (error) {
    console.error('❌ Erro no cleanup automático:', error);
  }
}, CLEANUP_INTERVAL);

// Registrar para cancelamento ao desativar extensão
context.subscriptions.push({
  dispose: () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  }
});
```

**Como Funciona:**
1. **Cleanup Inicial:** Executa 5 minutos após a extensão iniciar
2. **Cleanup Periódico:** Executa a cada 24 horas automaticamente
3. **Notificação:** Mostra mensagem quando projetos são removidos
4. **Logs:** Registra todas as operações no console
5. **Cleanup ao Desativar:** Cancela o timer quando extensão é desativada

---

## 📊 Interface do Usuário

### Painel de Projetos Deletados

```
╔════════════════════════════════════════════════════════════════════╗
║               📂 Projetos Deletados (Recuperação)                  ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  📊 Estatísticas                                                   ║
║  ┌────────────┬────────────┬────────────┬────────────┐            ║
║  │   Total    │  Críticos  │  Atenção   │ Expirados  │            ║
║  │     3      │     1      │     1      │     1      │            ║
║  └────────────┴────────────┴────────────┴────────────┘            ║
║                                                                    ║
║  🟢 db (Seguro - 4 dias)                          [Restaurar]     ║
║     145 registros · Deletado em 15/01/2025        [Deletar ❌]    ║
║     Faltam 26 dias para expirar                                   ║
║                                                                    ║
║  🔴 old-api (Crítico - 28 dias)                   [Restaurar]     ║
║     89 registros · Deletado em 20/12/2024         [Deletar ❌]    ║
║     Faltam 2 dias para expirar                                    ║
║                                                                    ║
║  ⚫ legacy-app (EXPIRADO - 31 dias)                               ║
║     234 registros · Deletado em 15/11/2024                        ║
║     ⚠️ Será removido permanentemente no próximo cleanup           ║
║                                                                    ║
║  [🧹 Limpar Todos os Expirados (1)]               [🔄 Atualizar] ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## ⚠️ Avisos Importantes

### 🔴 Exclusão Permanente é IRREVERSÍVEL

```typescript
// Modal de confirmação de cleanup
openCleanupModal() {
  // Aviso explícito ao usuário
  "⚠️ ATENÇÃO: EXCLUSÃO PERMANENTE
  
  Você está prestes a remover permanentemente 1 projeto(s) expirado(s).
  
  ❌ Esta ação NÃO PODE SER DESFEITA!
  ❌ Todos os registros serão removidos do banco de dados
  ❌ Não será possível restaurar após confirmar
  
  Projetos que serão removidos:
  • api-gateway (89 registros)
  
  [Cancelar]  [Confirmar Exclusão Permanente]"
}
```

### 📋 Checklist Antes de Cleanup

- [ ] Verifiquei que realmente não preciso mais desses dados
- [ ] Exportei relatórios se necessário (futuro)
- [ ] Entendo que a exclusão é permanente
- [ ] Confirmo que todos os projetos listados podem ser removidos

---

## 🧪 Testes do Sistema

### Teste 1: Soft Delete

```typescript
// 1. Deletar projeto
await dbManager.softDeleteProject('test-project');

// 2. Verificar marcação
const deleted = await dbManager.getDeletedProjectsWithDays();
expect(deleted[0].project).toBe('test-project');
expect(deleted[0].deleted_at).toBeTruthy();
expect(deleted[0].days_since_deletion).toBe(0);
```

### Teste 2: Restauração

```typescript
// 1. Restaurar projeto
await dbManager.restoreProjectHistory('test-project');

// 2. Verificar remoção da marcação
const active = await dbManager.getStats({ startDate: '2020-01-01' });
expect(active.byProject['test-project']).toBeTruthy();
```

### Teste 3: Cleanup (Simulado)

```typescript
// 1. Criar projeto com data antiga (31+ dias)
await db.run(`
  UPDATE time_entries 
  SET deleted_at = datetime('now', '-31 days') 
  WHERE project = 'old-project'
`);

// 2. Executar cleanup
const count = await dbManager.cleanupExpiredProjects();
expect(count).toBe(1);

// 3. Verificar remoção permanente
const deleted = await dbManager.getDeletedProjectsWithDays();
expect(deleted.find(p => p.project === 'old-project')).toBeUndefined();
```

---

## 📈 Fluxograma de Decisão

```
                    Deletar Projeto?
                          │
                          ▼
                    [Soft Delete]
                    deleted_at = now
                          │
                ┌─────────┴─────────┐
                │                   │
            0-7 dias            8-30 dias
            🟢 Seguro          🔴 Crítico
                │                   │
                └─────────┬─────────┘
                          │
                    Usuário Decide
                          │
            ┌─────────────┼─────────────┐
            │             │             │
        Restaurar     Ignorar      Cleanup Manual
            │             │             │
    deleted_at=NULL       │        DELETE WHERE
      (Recuperado)        │        days > 30
                          │             │
                      30 dias      [PERMANENTE]
                      passam            │
                          │             │
                          └─────────────┘
                                  │
                          ❌ Dados Perdidos
```

---

## 🔐 Segurança e Auditoria

### Registro Completo de Ações

```typescript
// Toda ação é registrada na tabela deletion_history
await this.logDeletion(projectName, recordsCount, deletionType);

// Permite rastrear:
// - Quando foi deletado
// - Quantos registros tinha
// - Se foi restaurado
// - Quando foi removido permanentemente
```

**⚠️ Nota Técnica - Correção SQLite:**
A função `logRestoration()` foi corrigida para usar subquery, pois o SQLite não permite `ORDER BY` e `LIMIT` diretamente em um `UPDATE` statement:

```typescript
// ❌ INCORRETO (gera SQLITE_ERROR: near "ORDER": syntax error)
UPDATE deletion_history 
SET restored_at = datetime('now')
WHERE project_name = ? AND restored_at IS NULL
ORDER BY deleted_at DESC LIMIT 1

// ✅ CORRETO (usa subquery para selecionar o ID correto)
UPDATE deletion_history 
SET restored_at = datetime('now')
WHERE id = (
  SELECT id FROM deletion_history
  WHERE project_name = ? AND restored_at IS NULL
  ORDER BY deleted_at DESC LIMIT 1
)
```

Essa correção garante que apenas o registro mais recente de exclusão seja marcado como restaurado.

### Logs no Console

```
✅ Projeto "db" deletado (soft) - 145 registro(s)
📝 Registrado no histórico: deletion_history.id = 15
🟢 Janela de recuperação: 30 dias (até 14/02/2025)

[28 dias depois...]

🔴 ALERTA: Projeto "db" expira em 2 dias!
⚠️ Última chance de restaurar antes da exclusão permanente

[31 dias depois...]

🧹 Cleanup automático detectado:
   - Projeto "db" (31 dias) será removido permanentemente
✅ 145 registro(s) removidos do banco de dados
❌ Projeto não pode mais ser recuperado
```

---

## 🎓 Resumo Executivo

| Aspecto | Detalhes |
|---------|----------|
| **Janela de Recuperação** | 30 dias desde exclusão |
| **Método de Cálculo** | `julianday('now') - julianday(deleted_at)` |
| **Gatilho de Exclusão** | Manual (botão "Limpar Expirados") |
| **Reversibilidade** | Sim (0-30 dias), Não (31+ dias) |
| **Auditoria** | Tabela `deletion_history` completa |
| **Classificação** | Seguro/Atenção/Crítico/Expirado |
| **Aviso ao Usuário** | Cores, dias restantes, modais de confirmação |

---

## 📞 Arquivos Relacionados

- `src/modules/database.ts` - Lógica SQL de cleanup
- `src/modules/stats.ts` - Handlers de UI
- `src/ui/deletedProjectsPanel.ts` - Interface visual
- `docs/DELETION_HISTORY.md` - Documentação completa

---

**Última Atualização:** 19/10/2025  
**Versão:** 0.2.1 (Beta)
