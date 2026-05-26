---
name: update-codebase
description: Análise completa do projeto MyTimeTrace VSCode para criar ou atualizar CODEBASE.md com dados reais de módulos, dependências, testes e arquitetura.
license: MIT
metadata:
  author: MyTimeTrace
  version: "1.2"
---

Analisa o projeto em profundidade e reescreve `CODEBASE.md` com dados extraídos diretamente do código-fonte.

**Input**: Nenhum argumento necessário. Se o usuário especificar módulos específicos para focar, priorize-os na leitura.

**Steps**

1. **Confirmar CWD e ler o CODEBASE.md existente**

   Verifique que está na raiz do projeto e leia o estado atual da documentação:
   ```bash
   ls package.json CODEBASE.md 2>/dev/null
   ```
   Use o tool **Read** para ler `CODEBASE.md` inteiro. Isso estabelece a linha de base para identificar o que mudou.

2. **Coletar dados estruturais em paralelo**

   Execute todos os comandos abaixo em um único bloco de tool calls paralelos:
   ```bash
   cat package.json
   ```
   ```bash
   find src/ -name "*.ts" | sort | xargs wc -l | sort -rn
   ```
   ```bash
   grep -rE "^\s*(it|test)\(" src/test/ | wc -l && ls src/test/*.ts 2>/dev/null | wc -l
   ```
   ```bash
   find src/ -type f -name "*.ts" | sort && find docs/ -type f 2>/dev/null | sort
   ```
   ```bash
   grep -n "CREATE TABLE\|CREATE INDEX\|ALTER TABLE\|PRAGMA" src/modules/database.ts | head -60
   ```
   ```bash
   grep -n "registerCommand" src/modules/commands.ts src/extension.ts 2>/dev/null | grep -v "//.*registerCommand"
   ```
   ```bash
   cat src/config/constants.ts 2>/dev/null || find src/ -name "constants.ts" -exec cat {} \;
   ```
   ```bash
   rtk git log --oneline -10
   ```

3. **Apresentar resumo de divergências e aguardar confirmação**

   Com os dados do passo 2, compare com o CODEBASE.md lido no passo 1. Apresente uma tabela resumida:

   | Arquivo | LOC atual | LOC no doc | Δ |
   |---------|-----------|------------|---|
   | src/extension.ts | NNN | NNN | +N / igual |
   | ... | | | |

   Inclua: versão lida vs documentada, total de testes, módulos existentes mas não documentados, módulos documentados mas que não existem mais.

   Pergunte ao usuário: *"Resumo coletado. Posso prosseguir com a leitura detalhada dos módulos?"*

   **IMPORTANT**: Não avance para o passo 4 sem confirmação explícita.

4. **Ler módulos em paralelo**

   Primeiro, liste o que realmente existe:
   ```bash
   find src/ -name "*.ts" -not -path "*/test/*" | sort
   ```

   Em seguida, use o tool **Read** em paralelo para todos os arquivos listados. Para arquivos com mais de 300 LOC (conforme passo 2), leia em duas fatias usando `offset`. Não tente ler arquivos que não apareceram no `find`.

   Prioridade de leitura: `extension.ts`, `database.ts`, `syncManager.ts`, `timeTrace.ts`, `config.ts`, demais módulos em `src/modules/`, painéis em `src/ui/`.

   Para cada arquivo lido, extraia: nome da classe principal, métodos públicos com assinatura real, dependências internas (imports de `./` ou `../`).

   Pergunte ao usuário: *"Módulos lidos. Posso reescrever o CODEBASE.md agora?"*

   **IMPORTANT**: Não escreva nada antes dessa confirmação.

5. **Reescrever o CODEBASE.md**

   Use **exclusivamente** os dados dos passos 2 e 4. Se um dado não foi coletado, escreva `[não disponível]` — nunca invente LOC, versões ou assinaturas.

   O documento deve conter, nesta ordem: cabeçalho com versão/data/LOC/testes reais; índice com âncoras; visão geral baseada no `package.json description` e no código; stack tecnológico com versões literais; árvore de diretórios com LOC ao lado de cada arquivo; seção por módulo com responsabilidade, métodos públicos e imports; schema real do banco; tabela de comandos registrados; fluxo de sincronização; painéis de UI; configurações com interface real; suítes de testes com contagem real; padrões arquiteturais observados no código; constantes e build config.

   Seções do CODEBASE.md atual que não têm base no código (ex: Roadmap) devem ser removidas ou marcadas como `[A definir]`. Mantenha o estilo visual (emojis, formatação) do arquivo existente.

6. **Validar e reportar**

   Após gravar, execute:
   ```bash
   grep -n "\[[^\]]*\]" CODEBASE.md | grep -v "^\s*-\s\[" | head -30
   ```
   O `grep -v` exclui checkboxes de lista para evitar falsos positivos. Se encontrar placeholders, preencha-os antes de encerrar.

   Apresente o relatório final conforme descrito em **Output Format**.

**Heuristics**

- **LOC**: use os números exatos do `wc -l` — não estime nem arredonde
- **Versões**: copie literalmente de `package.json` — `"5.1.6"` não vira `"~5"`
- **Módulo ausente**: se o arquivo não foi lido, escreva `[não disponível]` na seção correspondente
- **Inferência de responsabilidade**: se a classe não tem docstring, infira pela lista de métodos públicos — não invente nomes de features
- **Divergências grandes**: LOC com diferença >20% ou módulos novos/removidos são CRÍTICOS — reportar em destaque

**Graceful Degradation**

- Se `CODEBASE.md` não existe: crie do zero sem comparação de divergências; pule o passo 3 e vá direto para o passo 4
- Se `src/test/` não existe: documente "sem testes automatizados", não omita a seção
- Se `docs/` não existe: omita a seção de docs na árvore de diretórios
- Se um módulo tem mais de 600 LOC e não cabe em duas fatias: documente os métodos extraídos do `grep` de assinaturas públicas em vez de ler o arquivo inteiro
- Se o usuário negar a confirmação em qualquer checkpoint: pergunte o que deseja ajustar antes de continuar

**Output Format**

Relatório final após a validação, em lista compacta:

- Versão documentada
- LOC total em `src/`
- Número de testes documentados
- Seções atualizadas — o que mudou em cada uma
- Seções mantidas iguais
- Módulos novos descobertos e documentados (se houver)
- Módulos removidos cuja seção foi deletada (se houver)
- Placeholders que permaneceram (se houver, com os motivos)
