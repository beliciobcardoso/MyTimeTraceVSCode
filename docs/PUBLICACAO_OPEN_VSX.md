# Publicação no Open VSX Registry (Google Antigravity)

O Google Antigravity (e outros forks do VS Code como VSCodium) não usa o VS Code Marketplace da Microsoft. Em vez disso, usa o **Open VSX Registry**, mantido pela Eclipse Foundation.

- **URL:** https://open-vsx.org/extension/BelicioBCardoso/my-time-trace-vscode
- **Ferramenta CLI:** `ovsx` (diferente do `vsce` usado para o VS Code Marketplace)

---

## Pré-requisitos (primeira vez)

### 1. Criar conta no Open VSX

1. Acesse https://open-vsx.org
2. Faça login com sua conta GitHub
3. Assine o **Publisher Agreement** da Eclipse Foundation (exigido na primeira publicação)

### 2. Gerar Personal Access Token

1. Acesse: **Avatar → Settings → Access Tokens → Generate New Token**
2. Guarde o token gerado com segurança — ele não é exibido novamente
3. **Nunca compartilhe o token em chats, commits ou arquivos do repositório**
4. Se um token for exposto acidentalmente, invalide-o imediatamente nessa mesma tela

### 3. Criar o namespace (apenas uma vez)

O namespace deve ser igual ao campo `publisher` do `package.json` (`BelicioBCardoso`).

```bash
npx ovsx create-namespace BelicioBCardoso --pat <seu-token>
```

> Esse passo só é necessário na primeira publicação. Nas próximas, pule direto para o passo de publicar.

---

## Publicar nova versão

### Passo 1 — Garantir que a versão está correta

Verifique o campo `version` em [package.json](../package.json) antes de publicar.

```bash
grep '"version"' package.json
```

### Passo 2 — Compilar e testar

```bash
npm run compile
npm test
```

### Passo 3 — Publicar no Open VSX

```bash
npx ovsx publish --pat <seu-token>
```

O comando compila, empacota e envia automaticamente. A saída esperada:

```
🚀  Published BelicioBCardoso.my-time-trace-vscode v0.5.5
```

### Passo 4 — Verificar publicação

Acesse https://open-vsx.org/extension/BelicioBCardoso/my-time-trace-vscode e confirme que a nova versão aparece.

---

## Publicar no VS Code Marketplace e no Open VSX juntos

Para publicar nos dois marketplaces de uma vez, execute em sequência:

```bash
# 1. VS Code Marketplace (Microsoft)
npx vsce publish

# 2. Open VSX (Antigravity, VSCodium e outros forks)
npx ovsx publish --pat <seu-token>
```

Ambos os comandos leem o mesmo `package.json` e geram o `.vsix` internamente — não é necessário gerar o arquivo separadamente.

---

## Compatibilidade com forks (engine)

O campo `engines.vscode` em `package.json` deve usar `>=` em vez de `^` para cobrir forks com versões maiores (ex: Antigravity 2.x):

```json
"engines": {
  "vscode": ">=1.100.0"
}
```

O operador `^1.100.0` seria interpretado como `< 2.0.0` pelo Antigravity, gerando erro de incompatibilidade.

---

## Segurança do token

| Ação | Quando fazer |
|------|-------------|
| Gerar novo token | Antes de cada publicação (ou manter um de longa duração em local seguro) |
| Invalidar token | Imediatamente após expor acidentalmente (chat, commit, log) |
| Onde armazenar | Gerenciador de senhas ou variável de ambiente — nunca em arquivos do repositório |

---

## Referências

- Documentação oficial do Open VSX: https://github.com/eclipse/openvsx/wiki/Publishing-Extensions
- CLI `ovsx` no npm: https://www.npmjs.com/package/ovsx
- Painel de extensões: https://open-vsx.org/user-settings/extensions
