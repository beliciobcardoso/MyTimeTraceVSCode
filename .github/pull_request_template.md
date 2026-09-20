## Contexto

<!-- Por que esta mudança existe. Link da issue, se houver. -->

## O que mudou

<!-- O que foi feito, em alto nível. Não recite o diff — explique a decisão. -->

## Como testar

<!-- Passos pra reproduzir dentro da Extension Development Host (F5). -->

1.
2.

## Checklist

- [ ] `npm run compile` passa
- [ ] `npm run lint` limpo
- [ ] `npm test` verde
- [ ] Se mexeu em comando, view ou configuração: `package.json` (`contributes`)
      atualizado e a entrada aparece na Command Palette
- [ ] Se mexeu em string visível: as chaves de i18n existem em todos os idiomas
- [ ] Se mexeu no schema local de dados: migração de quem já tem a extensão
      instalada foi considerada
- [ ] Sem segredo, chave ou token no diff

## Riscos

<!-- O que pode quebrar pra quem já usa a extensão publicada. "Nenhum" vale
     como resposta, desde que você tenha olhado. -->
