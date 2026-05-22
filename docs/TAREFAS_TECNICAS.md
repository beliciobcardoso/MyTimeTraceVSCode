# Tarefas Técnicas Pendentes

Registro de melhorias de infraestrutura, qualidade e manutenção da extensão que não pertencem a nenhum PRD de funcionalidade específica.

---

## [x] Criar `.vscodeignore` para reduzir tamanho do `.vsix`

**Prioridade:** Alta  
**Origem:** Aviso do `vsce` na publicação da v0.5.5

### Contexto

O pacote `my-time-trace-vscode-0.5.5.vsix` ficou com **1.049 arquivos / 594 JS / ~7 MB** porque não existe um arquivo `.vscodeignore` no repositório. O `vsce` inclui tudo que não está explicitamente ignorado.

### O que fazer

Criar o arquivo `.vscodeignore` na raiz do repositório excluindo pastas e arquivos que não fazem parte do runtime da extensão:

```
# Documentação
docs/
openspec/
UI/
CODEBASE.md
GEMINI.md
CHANGELOG.md

# CI/CD e configuração de desenvolvimento
.github/
.claude/
.vscode-test/
.nycrc.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.json
eslint.config.mjs

# Código-fonte TypeScript (o compilado já está em out/)
src/

# Testes
out/test/

# Dependências de desenvolvimento
node_modules/
```

> `node_modules/` de produção (`sqlite3`, `uuid`, `vscode-nls`) são resolvidas automaticamente pelo VS Code — não precisam estar no `.vsix`.

### Resultado esperado

Redução estimada de ~1.000 arquivos e ~6 MB no pacote final, tornando a instalação e atualização mais rápidas para os usuários.

---

## Referências de processo

- [Publicação no Open VSX (Antigravity)](./PUBLICACAO_OPEN_VSX.md) — passo a passo para publicar no Open VSX Registry
