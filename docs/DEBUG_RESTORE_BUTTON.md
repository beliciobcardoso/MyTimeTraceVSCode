# 🐛 Guia de Debug: Botão "Restaurar Projeto" Não Funciona

**Data:** 19 de outubro de 2025  
**Status:** 🔧 Debugging em Progresso

---

## 🔍 Problema Relatado

**Sintoma:** Ao clicar no botão "♻️ Restaurar Projeto", nada acontece. Nenhum modal, nenhum erro, nenhuma ação.

**Contexto:** O painel mostra 4 projetos deletados corretamente.

---

## ✅ Correções Aplicadas

### 1. Logs de Debug Extensivos
Adicionei logs detalhados em TODAS as funções JavaScript para rastrear o fluxo:

```javascript
// Logs adicionados:
console.log('🚀 Inicializando painel de projetos deletados...');
console.log('✅ VS Code API adquirida:', typeof vscode);
console.log('🔵 Função restoreProject chamada com:', projectName);
console.log('📊 Registros encontrados:', records);
console.log('❓ Mostrando confirmação...');
console.log('✅ Usuário confirmou restauração');
console.log('📤 Enviando postMessage para backend...');
console.log('✅ Mensagem enviada com sucesso!');
// ... e muitos outros
```

### 2. Funções Registradas no `window`
Mudei de funções locais para propriedades do objeto `window`:

**ANTES:**
```javascript
function restoreProject(projectName) { ... }
```

**DEPOIS:**
```javascript
window.restoreProject = function(projectName) { ... }
```

**Motivo:** Garantir que as funções estejam acessíveis globalmente no contexto do webview.

### 3. IIFE (Immediately Invoked Function Expression)
Envolvi todo o código em uma IIFE para evitar conflitos de escopo:

```javascript
(function() {
  const vscode = acquireVsCodeApi();
  window.restoreProject = function() { ... };
  // ... outras funções
})();
```

### 4. Escape de Backticks em Nomes de Projetos
Adicionei `.replace(/\`/g, '\\`')` para evitar quebra de sintaxe:

```typescript
onclick="window.restoreProject(\`${project.project.replace(/`/g, '\\`')}\`)"
```

### 5. `return false;` nos Eventos
Adicionei `return false;` para prevenir comportamento padrão:

```html
<button onclick="window.restoreProject(...); return false;">
```

### 6. Try-Catch em Todas as Funções
Envolvi todas as funções com tratamento de erro:

```javascript
try {
  // código
} catch (error) {
  console.error('❌ ERRO:', error);
  alert('Erro: ' + error.message);
}
```

---

## 🧪 Como Testar Agora

### Passo 1: Recarregar Extensão
```
Pressione F5 (ou Developer: Reload Window)
```

### Passo 2: Abrir Developer Tools
```
Help → Toggle Developer Tools
Ou: Ctrl+Shift+I (Linux/Windows)
Ou: Cmd+Option+I (Mac)
```

### Passo 3: Abrir Painel de Projetos Deletados
```
Ctrl+Shift+P → "My Time Trace: Deleted Projects"
```

### Passo 4: Verificar Logs de Inicialização
No console do Developer Tools, você DEVE ver:

```
🚀 Inicializando painel de projetos deletados...
✅ VS Code API adquirida: object
✅ Função restoreProject registrada no window
✅ Função deletePermanently registrada no window
✅ Função refreshData registrada no window
✅ Função cleanupExpired registrada no window
📝 Painel de Projetos Deletados carregado
Recuperáveis: 4
Expirados: 0
🧪 Teste: window.restoreProject existe? function
🧪 Teste: window.deletePermanently existe? function
🧪 Teste: window.refreshData existe? function
🧪 Teste: window.cleanupExpired existe? function
```

**❌ SE NÃO VER ESSES LOGS:** O JavaScript não está sendo executado corretamente!

### Passo 5: Clicar no Botão "Restaurar Projeto"
Ao clicar, você DEVE ver no console:

```
🔵 Função restoreProject chamada com: NomeDoProjeto
🔍 Buscando registros para projeto: NomeDoProjeto
📦 Total de projetos carregados: 4
🎯 Projeto encontrado: {project: "NomeDoProjeto", records_count: 42, ...}
📊 Registros encontrados: 42
❓ Mostrando confirmação...
```

**Depois de confirmar no modal:**
```
✅ Usuário confirmou restauração
📤 Enviando postMessage para backend...
✅ Mensagem enviada com sucesso!
```

**❌ SE NÃO VER NADA:** O evento onclick não está disparando!

---

## 🔍 Diagnósticos Possíveis

### Cenário 1: Nenhum Log Aparece
**Problema:** JavaScript não está sendo executado

**Possíveis causas:**
- CSP (Content Security Policy) bloqueando script inline
- Erro de sintaxe no HTML gerado
- Webview não carregou corretamente

**Solução:**
1. Verificar se há erros no console
2. Inspecionar elemento do painel (botão direito → Inspect)
3. Ver se o `<script>` está presente no HTML

---

### Cenário 2: Logs de Inicialização OK, Mas Clique Não Dispara
**Problema:** Evento onclick não está vinculado

**Possíveis causas:**
- Botão está desabilitado (CSS)
- Z-index de outro elemento sobrepondo
- Nome do projeto com caracteres especiais quebrando

**Solução:**
1. Inspecionar elemento do botão
2. Verificar atributo `onclick` no HTML
3. Tentar executar no console: `window.restoreProject('NomeDoProjeto')`

---

### Cenário 3: Clique Dispara, Mas Modal Não Aparece
**Problema:** `confirm()` não está funcionando

**Possíveis causas:**
- Bloqueio de popups no webview
- Erro antes do confirm()

**Solução:**
1. Verificar logs até o ponto "❓ Mostrando confirmação..."
2. Verificar se há erro após esse log
3. Testar no console: `confirm('teste')`

---

### Cenário 4: Modal OK, Mas PostMessage Não Chega ao Backend
**Problema:** Comunicação webview → backend

**Possíveis causas:**
- Listener não registrado no backend
- vscode API não inicializada corretamente

**Solução:**
1. Verificar log: "📤 Enviando postMessage para backend..."
2. Verificar backend (src/modules/stats.ts) se listener está ativo
3. Adicionar log no backend: `console.log('Mensagem recebida:', message)`

---

## 🧪 Teste Manual no Console

Abra o Developer Tools e execute esses comandos no console:

### Teste 1: Verificar Funções
```javascript
console.log('Funções disponíveis:');
console.log('restoreProject:', typeof window.restoreProject);
console.log('deletePermanently:', typeof window.deletePermanently);
console.log('refreshData:', typeof window.refreshData);
console.log('cleanupExpired:', typeof window.cleanupExpired);
```

**Resultado esperado:** Todos devem retornar `"function"`

---

### Teste 2: Executar Restauração Manualmente
```javascript
window.restoreProject('NomeDoProjeto'); // Use um nome real
```

**Resultado esperado:** Modal de confirmação deve aparecer

---

### Teste 3: Verificar VS Code API
```javascript
console.log('VS Code API:', typeof acquireVsCodeApi);
```

**Resultado esperado:** `"function"`

---

### Teste 4: Enviar Mensagem Diretamente
```javascript
const vscode = acquireVsCodeApi();
vscode.postMessage({
  command: 'restoreProject',
  projectName: 'TesteProjeto'
});
```

**Resultado esperado:** Backend deve receber a mensagem

---

## 📝 Checklist de Diagnóstico

Execute este checklist e me informe os resultados:

- [ ] 1. Extensão recarregada (F5)
- [ ] 2. Developer Tools aberto (Help → Toggle Developer Tools)
- [ ] 3. Painel "Deleted Projects" aberto
- [ ] 4. Console mostra logs de inicialização (🚀 🧪)
- [ ] 5. Teste: `typeof window.restoreProject` retorna "function"
- [ ] 6. Clique no botão dispara log "🔵 Função restoreProject chamada"
- [ ] 7. Modal de confirmação aparece
- [ ] 8. Ao confirmar, log "✅ Mensagem enviada com sucesso!" aparece
- [ ] 9. Notificação do VS Code aparece
- [ ] 10. Painel atualiza automaticamente

---

## 🎯 Próximos Passos

**Faça o seguinte:**

1. ✅ **Pressione F5** para recarregar a extensão
2. ✅ **Abra Developer Tools** (Help → Toggle Developer Tools)
3. ✅ **Abra o painel** (Ctrl+Shift+P → "Deleted Projects")
4. ✅ **Copie TODOS os logs** que aparecem no console
5. ✅ **Clique no botão** "Restaurar Projeto"
6. ✅ **Copie TODOS os novos logs** que aparecem
7. ✅ **Me envie os logs**

Com os logs, poderei identificar exatamente onde está o problema!

---

## 📸 Screenshots Úteis

Se possível, tire screenshots de:
1. Console do Developer Tools mostrando os logs
2. Painel com os 4 projetos deletados
3. Inspetor do elemento (botão com botão direito → Inspect)

---

## 🔧 Alterações Feitas nos Arquivos

### Arquivo: `src/ui/deletedProjectsPanel.ts`

**Mudanças principais:**
- ✅ Todas as funções agora são propriedades de `window`
- ✅ Logs de debug em cada etapa do fluxo
- ✅ Try-catch para capturar erros
- ✅ IIFE para encapsulamento
- ✅ Escape de backticks em nomes de projetos
- ✅ `return false;` em todos os onclick
- ✅ Logs de teste de funções ao carregar

---

**🎯 AÇÃO NECESSÁRIA:** Teste agora e me envie os logs do console!
