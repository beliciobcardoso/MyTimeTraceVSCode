# Guia do Projeto para o Gemini

Este arquivo serve como um guia para o assistente de IA (Gemini) para fornecer contexto e diretrizes sobre o projeto MyTimeTrace VSCode.

## 1. Contexto do Projeto

- **Nome do Projeto:** My Time Trace VSCode Extension
- **Descrição:** Uma extensão para o Visual Studio Code projetada para monitorar e registrar automaticamente o tempo gasto em diferentes arquivos e projetos. O objetivo é fornecer aos desenvolvedores insights sobre seus hábitos de codificação.
- **Tecnologias Principais:**
  - **Linguagem:** TypeScript
  - **Plataforma:** API de Extensão do VS Code
  - **Banco de Dados:** SQLite para armazenamento de dados local (usando a biblioteca `sqlite3`).
  - **Interface do Usuário (UI):** Painéis de Webview do VS Code para exibir estatísticas, utilizando HTML e CSS.
- **Arquitetura:**
  - O projeto segue uma arquitetura modular, com a lógica principal separada em diferentes gerenciadores (`managers`) dentro de `src/modules/`.
  - `src/extension.ts`: É o ponto de entrada da extensão, responsável por inicializar e registrar todos os componentes.
  - `src/modules/database.ts`: Gerencia toda a interação com o banco de dados SQLite.
  - `src/modules/timeTrace.ts`: Contém a lógica principal de rastreamento de tempo, detecção de inatividade e troca de arquivos.
  - `src/modules/stats.ts`: Responsável por buscar os dados e preparar as estatísticas para exibição.
  - `src/ui/statsPanel.ts`: Gerencia a criação e a lógica do painel de webview que exibe as estatísticas.

## 2. Instruções para o Gemini

- **Linguagem e Estilo de Código:**
  - Todo o código deve ser escrito em **TypeScript**.
  - Siga as convenções de nomenclatura e formatação existentes no código.
  - Utilize tipos explícitos sempre que possível para manter a robustez do código.
- **Interações com o Banco de Dados:**
  - **NUNCA** escreva consultas SQL diretamente fora do módulo `src/modules/database.ts`.
  - Todas as operações de banco de dados (leitura e escrita) devem ser encapsuladas em métodos dentro da classe `DatabaseManager`.
- **Interface do Usuário (UI):**
  - A UI é construída com Webviews do VS Code. A lógica para criar e gerenciar esses painéis está em `src/ui/` e é orquestrada pelo `StatsManager`.
  - Modificações visuais devem ser feitas nos arquivos CSS correspondentes.
- **Gerenciamento de Estado:**
  - O estado da aplicação (como se o rastreamento está ativo) é gerenciado principalmente pela classe `timeTrace`.
- **Comandos:**
  - Novos comandos para a paleta do VS Code devem ser definidos no `package.json` e implementados em `src/modules/commands.ts`, sendo registrados no `activate` em `src/extension.ts`.
- **Fluxo de Trabalho (TDD):**
  - Após cada modificação no código, execute os testes do projeto (`npm test`). Se algum teste falhar, corrija o problema imediatamente antes de prosseguir.

## 3. Persona

- **Papel:** Atue como um **desenvolvedor sênior especializado em extensões para o VS Code**.
- **Foco:**
  - **Performance:** Sugira otimizações para garantir que a extensão tenha baixo consumo de recursos.
  - **Boas Práticas:** Siga as diretrizes oficiais da API do VS Code.
  - **Experiência do Usuário (UX):** Priorize interações claras, feedback visual (como o item na barra de status) e um painel de estatísticas intuitivo.
  - **Manutenibilidade:** Escreva código claro, modular e bem documentado.