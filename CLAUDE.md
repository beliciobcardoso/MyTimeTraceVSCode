# CLAUDE.md — My Time Trace VSCode

Extensão do VS Code (`my-time-trace-vscode`) que registra tempo de trabalho por
projeto e arquivo. TypeScript, publicada no marketplace — o que entra na `main`
chega em quem já tem a extensão instalada.

Requer VS Code `>=1.100.0`.

## Comandos

```bash
npm run compile   # build
npm run watch     # build incremental durante o desenvolvimento
npm run lint      # ESLint
npm test          # suíte de testes
npm run package    # gera o .vsix
```

Para testar na prática: F5 abre a Extension Development Host com a extensão
carregada.

## Estrutura

| Caminho | O que é |
|---|---|
| `src/extension.ts` | ponto de entrada — ativação e registro de comandos |
| `src/modules/` | lógica de domínio da extensão |
| `src/ui/` | views, painéis e itens de status bar |
| `src/config/` | leitura de configuração do usuário |
| `src/i18n.ts` | strings traduzíveis |
| `src/test/` | testes |

## Git

Toda mudança nasce numa branch e entra por pull request, com base em `main`.
Nada direto na `main`, nem para uma linha: o push direto pula o ponto de review
e não deixa rastro revisável do porquê da mudança. Hoje só 11 dos últimos 50
commits da `main` chegaram por merge — o resto foi empurrado direto.

Todo commit feito em sessão de pareamento termina com o trailer de co-autoria,
separado do corpo por uma linha em branco:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

O e-mail é o que identifica a conta no GitHub — o nome é livre. Não use o seu
próprio e-mail como co-autor: autor e co-autor iguais não descrevem um par, e o
trailer é descartado.

O trailer sobrevive ao squash merge: o GitHub agrega os co-autores de todos os
commits esmagados no commit final.

Formato da mensagem: `<tipo>: <descrição>`, com tipo em
`feat|fix|refactor|docs|test|chore|perf|ci`. Descrição em inglês, no imperativo.
