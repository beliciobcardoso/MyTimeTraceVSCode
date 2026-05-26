---
name: release
description: Orquestra o ciclo completo de release semântico do MyTimeTrace VSCode — bump de versão, CHANGELOG, README, commit e tag git.
license: MIT
metadata:
  author: MyTimeTrace
  version: "1.0"
---

Executa o ciclo completo de release seguindo Semantic Versioning 2.0 e Keep a Changelog 1.0.

**Argumentos aceitos**: `patch` | `minor` | `major` | `--dry-run`  
Se nenhum argumento for passado, o tipo de bump será perguntado ao usuário.

**Steps**

---

### 1. Pré-flight: estado do repositório e versão atual

Execute em paralelo:

```bash
rtk git status
```
```bash
cat package.json | grep '"version"' | head -1
```
```bash
rtk git log --oneline -5
```
```bash
git tag --sort=-version:refname | head -10
```

Use o tool **Read** para ler as primeiras 12 linhas do `CHANGELOG.md`.

**Regras**:
- Se `git status` mostrar arquivos com mudanças não commitadas: **PARE** e informe o usuário:  
  *"Existem mudanças não commitadas. Faça commit ou stash antes de continuar."*  
  Não prossiga sem confirmação explícita.
- Extraia a versão atual (`CURRENT`) do `package.json`.
- Identifique se existe uma seção `## [Unreleased]` no `CHANGELOG.md`. Se sim, armazene que há mudanças pendentes documentadas.

---

### 2. Determinar o tipo de bump

Se o argumento passado for `patch`, `minor` ou `major`: use-o diretamente.

Se não houver argumento: analise o conteúdo do `[Unreleased]` (se existir) e sugira o tipo adequado conforme a tabela abaixo, mas **sempre confirme com o usuário antes de prosseguir**:

| Conteúdo encontrado             | Sugestão   |
|---------------------------------|------------|
| Somente `### Corrigido`         | `patch`    |
| `### Adicionado` ou `### Alterado` | `minor` |
| `### Removido` + quebra de API  | `major`    |

Pergunte ao usuário:  
*"Tipo de bump detectado como `<sugestão>` (CURRENT → NEW). Confirma? (patch / minor / major)"*

Calcule `NEW_VERSION` a partir de `CURRENT`:
- `patch`: incrementa o terceiro dígito → `0.6.1 → 0.6.2`
- `minor`: incrementa o segundo dígito, zera o terceiro → `0.6.1 → 0.7.0`
- `major`: incrementa o primeiro dígito, zera os demais → `0.6.1 → 1.0.0`

Se `--dry-run` foi passado: exiba o plano completo (quais linhas seriam alteradas em cada arquivo) e **encerre sem modificar nada**.

---

### 3. Atualizar `package.json`

Leia o `package.json` completo via **Read**.

Substitua apenas o valor do campo `"version"` de `CURRENT` para `NEW_VERSION`. Use o tool **Edit** com `old_string` sendo a linha exata encontrada (ex: `"version": "0.6.1"`) e `new_string` com a nova versão.

Não altere nenhum outro campo.

---

### 4. Atualizar `CHANGELOG.md`

Leia o `CHANGELOG.md` completo via **Read**.

**Caso A — existe seção `[Unreleased]`**:

Renomeie `## [Unreleased]` para `## [NEW_VERSION] - TODAY` onde `TODAY` é a data de hoje no formato `YYYY-MM-DD`. Insira uma nova seção `## [Unreleased]` vazia **acima** da nova versão com o placeholder:

```markdown
## [Unreleased]

<!-- Adicione aqui as mudanças não lançadas -->

---

## [NEW_VERSION] - TODAY
```

**Caso B — não existe seção `[Unreleased]`**:

Não crie entradas automaticamente. Insira uma seção `[Unreleased]` vazia no topo (abaixo do cabeçalho do arquivo, acima da primeira versão):

```markdown
## [Unreleased]

<!-- Adicione aqui as mudanças não lançadas -->

---
```

Em seguida, pergunte ao usuário:  
*"Não encontrei seção `[Unreleased]` no CHANGELOG. Deseja adicionar as notas de release manualmente agora antes de continuar, ou prefere lançar com as notas da última versão como referência?"*

Se o usuário quiser adicionar notas: **PAUSE aqui** e aguarde. Quando o usuário confirmar, continue do passo 5.  
Se preferir continuar sem notas adicionais: siga para o passo 5.

Use o tool **Edit** para todas as alterações no CHANGELOG.

---

### 5. Atualizar `README.md`

Leia as primeiras 15 linhas do `README.md` via **Read**.

Aplique as seguintes substituições com **Edit** (cada uma em chamada separada, pois são trechos distintos):

1. **Título**: `# My Time Trace VSCode (vCURRENT)` → `# My Time Trace VSCode (vNEW_VERSION)`
2. **Badge de versão**: `Version-CURRENT_ENCODED-blue` → `Version-NEW_ENCODED-blue`  
   Onde `CURRENT_ENCODED` e `NEW_ENCODED` são as versões com pontos substituídos por `%2E` conforme o padrão shields.io.  
   Exemplo: `0.6.1` → `0%2E6%2E1` para a URL do badge.  
   
   **Atenção**: leia o conteúdo exato do badge no README antes de editar — use a string literal encontrada, não uma versão assumida.

---

### 6. Criar o commit de release

Faça stage dos três arquivos modificados:

```bash
rtk git add package.json CHANGELOG.md README.md
```

Confirme o que foi staged:

```bash
rtk git status
```

Crie o commit:

```bash
git commit -m "$(cat <<'EOF'
chore(release): v{NEW_VERSION}

- Bump version em package.json: {CURRENT} → {NEW_VERSION}
- CHANGELOG.md: [Unreleased] promovido para [{NEW_VERSION}] - {TODAY}
- README.md: título e badge de versão atualizados

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Substitua `{NEW_VERSION}`, `{CURRENT}` e `{TODAY}` pelos valores reais antes de executar.

---

### 7. Criar a git tag

```bash
git tag -a "v{NEW_VERSION}" -m "Release v{NEW_VERSION}"
```

Confirme:

```bash
git tag --sort=-version:refname | head -5
```

---

### 8. Perguntar sobre push

Exiba o resumo do que foi feito e pergunte:

*"Release `v{NEW_VERSION}` criado localmente com sucesso. Deseja fazer push agora? (commit + tag)"*

Se o usuário confirmar:

```bash
rtk git push && git push origin "v{NEW_VERSION}"
```

Se não: informe que o push pode ser feito manualmente com:
```
git push && git push origin v{NEW_VERSION}
```

---

**Heuristics**

- **Nunca altere** `package-lock.json`, `pnpm-lock.yaml` ou `.vscodeignore` — apenas `package.json`, `CHANGELOG.md` e `README.md`
- **Data sempre UTC**: use `date -u +%Y-%m-%d` para obter a data do release
- **Badge encoding**: pontos no shields.io são `%2E`, não `.` — ex: `0.6.1` → `0%2E6%2E1`; verifique o padrão exato no README antes de editar
- **Commit atômico**: os três arquivos devem ir em um único commit, nunca separados
- **Tag anotada**: sempre use `git tag -a`, nunca `git tag` simples — mensagem de tag = `Release vX.Y.Z`
- **Pré-flight é bloqueante**: mudanças não commitadas BLOQUEIAM o release; não ofereça alternativas além de "commit ou stash primeiro"

**Graceful Degradation**

- Se `README.md` não tiver a linha de título com versão: pule a atualização do título, mas atualize o badge
- Se `README.md` não tiver badge de versão: documente no relatório final, mas não falhe
- Se o CHANGELOG já tiver uma entrada para `NEW_VERSION` (release repetido acidental): PARE e avise o usuário antes de qualquer modificação
- Se `git tag` já existir para `vNEW_VERSION`: PARE e avise: *"Tag v{NEW_VERSION} já existe. Verifique se este release já foi criado."*
- Em modo `--dry-run`: jamais chame Edit, Write ou qualquer comando git que modifique estado; apenas leia e exiba o plano

**Output Format**

Relatório final após o passo 8, em lista compacta:

```
Release v{NEW_VERSION} criado

  package.json   : {CURRENT} → {NEW_VERSION}
  CHANGELOG.md   : [Unreleased] → [{NEW_VERSION}] - {TODAY}
  README.md      : título + badge atualizados
  Commit         : {hash curto}
  Tag            : v{NEW_VERSION}
  Push           : ✅ enviado / ⏳ pendente (git push && git push origin v{NEW_VERSION})
```
