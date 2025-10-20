# Referência Completa de Cores VS Code

> 📚 Guia definitivo de variáveis CSS do VS Code com valores hexadecimais reais para os temas Dark+ e Light+

## 🎨 Como Usar

```css
/* Sintaxe no CSS */
.meu-elemento {
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
}
```

---

## 🌙 Dark+ Theme (Tema Escuro Padrão)

### Cores de Texto

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-foreground` | `#CCCCCC` | Texto padrão (baixo contraste) |
| `--vscode-editor-foreground` | `#D4D4D4` | Texto do editor (melhor contraste) |
| `--vscode-descriptionForeground` | `#CCCCCC` + 70% opacity | Texto secundário |
| `--vscode-errorForeground` | `#F48771` | Mensagens de erro |
| `--vscode-textLink-foreground` | `#3794FF` | Links clicáveis ⭐ |
| `--vscode-textLink-activeForeground` | `#3794FF` | Links em hover |
| `--vscode-textPreformat-foreground` | `#D7BA7D` | Texto formatado/código |

**💡 Recomendação:** Para títulos e cabeçalhos, prefira `textLink-foreground` (#3794FF) - excelente contraste!

---

### Cores de Background

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-editor-background` | `#1E1E1E` | Fundo principal |
| `--vscode-sideBar-background` | `#252526` | Sidebar/painéis |
| `--vscode-activityBar-background` | `#333333` | Barra de atividades |
| `--vscode-panel-background` | `#1E1E1E` | Painéis inferiores |
| `--vscode-statusBar-background` | `#007ACC` | Status bar |
| `--vscode-titleBar-activeBackground` | `#3C3C3C` | Title bar ativa |
| `--vscode-editor-inactiveSelectionBackground` | `#3A3D41` | Seleção inativa |

---

### Cores de Borda

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-focusBorder` | `#007ACC` | Bordas em foco |
| `--vscode-panel-border` | `#80808059` | Bordas de painéis |
| `--vscode-widget-border` | `#454545` | Bordas de widgets |
| `--vscode-contrastBorder` | `#6FC3DF` | Modo alto contraste |

---

### Cores de Status e Alerts

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-errorForeground` | `#F48771` | ❌ Erros críticos |
| `--vscode-notificationsErrorIcon-foreground` | `#F48771` | Ícones de erro |
| `--vscode-editorWarning-foreground` | `#CCA700` | ⚠️ Avisos |
| `--vscode-editorInfo-foreground` | `#3794FF` | ℹ️ Informações |
| `--vscode-successForeground` | `#89D185` | ✅ Sucesso |

---

### Cores de Botões

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-button-background` | `#0E639C` | Botão primário |
| `--vscode-button-hoverBackground` | `#1177BB` | Hover primário |
| `--vscode-button-foreground` | `#FFFFFF` | Texto do botão |
| `--vscode-button-secondaryBackground` | `#3A3D41` | Botão secundário |
| `--vscode-button-secondaryHoverBackground` | `#45494E` | Hover secundário |

---

### Cores de Progress Bar

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-progressBar-background` | `#0E70C0` | Barra de progresso ⭐ |

**💡 Destaque:** Excelente para elementos que precisam chamar atenção!

---

### Cores de Charts (Gráficos)

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-charts-red` | `#F48771` | Vermelho - Erros, crítico |
| `--vscode-charts-blue` | `#75BEFF` | Azul - Info, padrão ⭐ |
| `--vscode-charts-yellow` | `#CCA700` | Amarelo - Avisos |
| `--vscode-charts-orange` | `#D18616` | Laranja - Atenção |
| `--vscode-charts-green` | `#89D185` | Verde - Sucesso |
| `--vscode-charts-purple` | `#B180D7` | Roxo - Destaque |
| `--vscode-charts-lines` | `#CCCCCC80` | Linhas de grade |

---

### Cores de Terminal

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-terminal-ansiBlack` | `#000000` | ANSI Black |
| `--vscode-terminal-ansiRed` | `#CD3131` | ANSI Red |
| `--vscode-terminal-ansiGreen` | `#0DBC79` | ANSI Green |
| `--vscode-terminal-ansiYellow` | `#E5E510` | ANSI Yellow |
| `--vscode-terminal-ansiBlue` | `#2472C8` | ANSI Blue |
| `--vscode-terminal-ansiMagenta` | `#BC3FBC` | ANSI Magenta |
| `--vscode-terminal-ansiCyan` | `#11A8CD` | ANSI Cyan |
| `--vscode-terminal-ansiWhite` | `#E5E5E5` | ANSI White |

---

## ☀️ Light+ Theme (Tema Claro Padrão)

### Cores de Texto

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-foreground` | `#616161` | Texto padrão |
| `--vscode-editor-foreground` | `#000000` | Texto do editor |
| `--vscode-descriptionForeground` | `#717171` | Texto secundário |
| `--vscode-errorForeground` | `#E51400` | Mensagens de erro |
| `--vscode-textLink-foreground` | `#006AB1` | Links clicáveis ⭐ |
| `--vscode-textLink-activeForeground` | `#006AB1` | Links em hover |

---

### Cores de Background

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-editor-background` | `#FFFFFF` | Fundo principal |
| `--vscode-sideBar-background` | `#F3F3F3` | Sidebar/painéis |
| `--vscode-activityBar-background` | `#2C2C2C` | Barra de atividades |
| `--vscode-panel-background` | `#FFFFFF` | Painéis inferiores |
| `--vscode-statusBar-background` | `#007ACC` | Status bar |
| `--vscode-editor-inactiveSelectionBackground` | `#E5EBF1` | Seleção inativa |

---

### Cores de Status e Alerts

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-errorForeground` | `#E51400` | ❌ Erros críticos |
| `--vscode-editorWarning-foreground` | `#BF8803` | ⚠️ Avisos |
| `--vscode-editorInfo-foreground` | `#1A85FF` | ℹ️ Informações |

---

### Cores de Charts (Gráficos)

| Variável CSS | Hex | Uso Recomendado |
|-------------|-----|-----------------|
| `--vscode-charts-red` | `#E51400` | Vermelho - Erros |
| `--vscode-charts-blue` | `#1A85FF` | Azul - Info ⭐ |
| `--vscode-charts-yellow` | `#BF8803` | Amarelo - Avisos |
| `--vscode-charts-orange` | `#CA5010` | Laranja - Atenção |
| `--vscode-charts-green` | `#16825D` | Verde - Sucesso |
| `--vscode-charts-purple` | `#8764B8` | Roxo - Destaque |

---

## 🎯 Top 5 Cores Mais Visíveis (Dark Theme)

### 1. 🥇 `--vscode-textLink-foreground` - Azul Link
```css
color: var(--vscode-textLink-foreground); /* #3794FF */
```
**Melhor para:** Títulos, cabeçalhos, links, CTAs  
**Contraste:** Excelente sobre fundos escuros  
**Uso:** Quando precisa de máxima visibilidade

---

### 2. 🥈 `--vscode-charts-blue` - Azul Chart
```css
color: var(--vscode-charts-blue); /* #75BEFF */
```
**Melhor para:** Elementos de destaque, ícones informativos  
**Contraste:** Muito bom, tom mais claro que textLink  
**Uso:** Quando precisa de destaque sem ser agressivo

---

### 3. 🥉 `--vscode-progressBar-background` - Azul Progress
```css
color: var(--vscode-progressBar-background); /* #0E70C0 */
```
**Melhor para:** Indicadores de progresso, estados ativos  
**Contraste:** Excelente, tom médio  
**Uso:** Barras de progresso, estados de carregamento

---

### 4. 🎖️ `--vscode-editor-foreground` - Texto Editor
```css
color: var(--vscode-editor-foreground); /* #D4D4D4 */
```
**Melhor para:** Texto de corpo, parágrafos longos  
**Contraste:** Bom para leitura prolongada  
**Uso:** Conteúdo principal, texto de leitura

---

### 5. 🏅 `--vscode-charts-green` - Verde Chart
```css
color: var(--vscode-charts-green); /* #89D185 */
```
**Melhor para:** Mensagens de sucesso, estados positivos  
**Contraste:** Muito bom, verde suave  
**Uso:** Confirmações, badges de sucesso

---

## 📋 Recomendações para `deletedProjectsPanel.ts`

### ❌ Cor Atual (Linha 395)
```css
.modal-header h3 {
  color: var(--vscode-foreground); /* #CCCCCC - baixo contraste */
}
```

### ✅ Melhor Opção - Azul Link
```css
.modal-header h3 {
  color: var(--vscode-textLink-foreground); /* #3794FF - excelente contraste */
}
```

### ✅ Alternativa 1 - Azul Chart
```css
.modal-header h3 {
  color: var(--vscode-charts-blue); /* #75BEFF - tom mais claro */
}
```

### ✅ Alternativa 2 - Texto Editor
```css
.modal-header h3 {
  color: var(--vscode-editor-foreground); /* #D4D4D4 - melhor que foreground */
}
```

---

## 🎨 Paleta Personalizada do MyTimeTrace

Para referência, aqui estão as cores customizadas do projeto:

```css
:root {
  /* Identidade Visual */
  --primary-orange: #F5A623;    /* Laranja - Energia, tempo */
  --primary-blue: #4A90E2;      /* Azul - Tecnologia */
  
  /* Estados */
  --success-green: #7ED321;     /* Verde - Sucesso */
  --warning-yellow: #F5A623;    /* Amarelo - Atenção */
  --error-red: #D0021B;         /* Vermelho - Erro */
  
  /* Paleta de Projetos (7 cores) */
  --project-color-1: #FF6B6B;   /* Vermelho coral */
  --project-color-2: #4ECDC4;   /* Turquesa */
  --project-color-3: #45B7D1;   /* Azul céu */
  --project-color-4: #96CEB4;   /* Verde menta */
  --project-color-5: #FECA57;   /* Amarelo dourado */
  --project-color-6: #FF9FF3;   /* Rosa claro */
  --project-color-7: #54A0FF;   /* Azul royal */
}
```

---

## 🔍 Testando Cores

### Método 1: CSS Inspector
```
1. F5 (Debug Extension)
2. Ctrl+Shift+P → "Show Deleted Projects"
3. F12 (Dev Tools)
4. Inspect element → Modify CSS variable
```

### Método 2: Temporary Override
```css
/* Adicione no <style> temporariamente */
.modal-header h3 {
  color: #3794FF !important; /* Forçar cor para teste */
}
```

### Método 3: Comparação Visual
```html
<!-- Crie um elemento de teste -->
<div style="background: #1E1E1E; padding: 20px;">
  <h3 style="color: #CCCCCC;">Foreground (#CCCCCC)</h3>
  <h3 style="color: #3794FF;">TextLink (#3794FF)</h3>
  <h3 style="color: #75BEFF;">Charts Blue (#75BEFF)</h3>
  <h3 style="color: #D4D4D4;">Editor Foreground (#D4D4D4)</h3>
</div>
```

---

## 📚 Referências Oficiais

- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [Color Tokens Documentation](https://code.visualstudio.com/api/extension-guides/color-theme)
- [Webview CSS Variables](https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content)

---

## 💡 Dicas Finais

### ✅ Boas Práticas
- **Sempre use variáveis CSS** do VS Code para manter consistência com temas
- **Teste em ambos os temas** (dark e light) antes de commitar
- **Prefira cores semânticas** (errorForeground, successForeground) para clareza
- **Use `editor-foreground`** em vez de `foreground` para melhor contraste

### ❌ Evite
- **Cores hardcoded** (hex direto no CSS) - quebra temas customizados
- **`foreground` sozinho** - contraste geralmente baixo
- **Cores muito saturadas** - cansam a vista
- **Muitas cores diferentes** - poluição visual

---

**Última Atualização:** 19 de outubro de 2025  
**Versão do Projeto:** MyTimeTrace VSCode v0.2.1  
**Autor:** Belicio Cardoso
