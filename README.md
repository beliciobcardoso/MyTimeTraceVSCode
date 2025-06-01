# myTimeTracker (Beta 0.1.0)

Uma extensão para o Visual Studio Code que monitora automaticamente o tempo gasto em cada arquivo e projeto, permitindo que você acompanhe suas atividades de desenvolvimento. Agora com visualização detalhada de estatísticas por projeto e arquivo!

## Funcionalidades

- **Monitoramento Automático**: Registra automaticamente o tempo gasto em cada arquivo quando você trabalha no VS Code.
- **Rastreamento por Projeto**: Organiza os dados por projeto para melhor análise de tempo.
- **Detecção de Inatividade**: Detecta períodos de inatividade (após 5 minutos) para registros de tempo mais precisos.
- **Persistência Local**: Armazena todos os dados localmente em um banco de dados SQLite.
- **Baixo Consumo de Recursos**: Opera silenciosamente em segundo plano sem impactar o desempenho.
- **Visualização de Estatísticas**: Exibe o tempo gasto por projeto e por arquivo em uma interface gráfica organizada.
- **Formatação Inteligente de Caminhos**: Apresenta os caminhos de arquivo de forma mais legível, removendo prefixos absolutos.

## Como Funciona

1. A extensão começa a monitorar automaticamente quando o VS Code é iniciado
2. Registra o tempo que você passa em cada arquivo
3. Detecta quando você muda de arquivos ou projetos
4. Registra períodos de inatividade para melhorar a precisão dos dados
5. Armazena todos os dados localmente para acesso posterior

## Requisitos

- Visual Studio Code 1.100.0 ou superior

## Instalação

No momento, esta extensão está em desenvolvimento e não está disponível no VS Code Marketplace. Para instalá-la:

1. Clone o repositório
2. Execute `npm install` para instalar as dependências
3. Execute `npm run package` para criar o arquivo VSIX
4. Use "Extensions: Install from VSIX..." no VS Code para instalar a extensão

## Configurações da Extensão

As seguintes configurações já estão disponíveis:

- `myTimeTracker.idleTimeout`: Define o tempo (em minutos) para considerar o usuário como inativo. Padrão: 5 minutos.
- `myTimeTracker.autoStart`: Ativa/desativa o início automático do monitoramento quando o VS Code é iniciado. Padrão: ativado.
- `myTimeTracker.showInStatusBar`: Controla a exibição do tempo atual na barra de status. Padrão: ativado.

## Melhorias Planejadas

- ✅ **Status Bar Item**: Mostrar o tempo atual do arquivo ou o status do monitoramento na barra de status do VS Code.
- ❌ **Heartbeat**: Implementar "heartbeats" periódicos para uma contagem de tempo mais precisa.
- ✅ **Interface de Visualização**: Adicionar painéis e gráficos para visualizar os dados de tempo coletados.
- ❌ **Exportação de Dados**: Permitir a exportação dos dados em diferentes formatos.
- ❌ **Tratamento de Erros**: Melhora o tratamento de erros de rede e outras exceções.
- ❌ **Autenticação**: Planeja-se implementar um método de autenticação (como API Key) para permitir a sincronização segura dos dados com um servidor externo em versões futuras.
- ❌ **Separação de responsabilidades**: O arquivo extension.ts contém toda a lógica, poderia ser dividido em módulos
- ✅ **Melhor tratamento de erros**: Adicionar tratamento de exceções mais robusto (implementado safeRegisterCommand)
- ✅ **Visualização de dados**: Implementar painéis para visualizar as estatísticas de tempo por projeto
- ✅ **Status Bar interativa**: Melhorar a interação com o usuário através da barra de status

## Notas de Lançamento

### 0.1.0 - Beta (01/06/2025)

Segunda versão com melhorias significativas:

- Visualização de estatísticas por projeto com detalhes de arquivos
- Exibição hierárquica de arquivos agrupados por projeto
- Formatação inteligente de caminhos de arquivos para melhor legibilidade
- Interface visual aprimorada para visualização dos dados coletados
- Correção do problema "command already exists" nos testes
- Implementação de registro seguro de comandos para evitar conflitos

### 0.0.1 - (31/05/2025)

Lançamento inicial com funcionalidades básicas:

- Monitoramento automático de tempo por arquivo
- Persistência local usando SQLite
- Detecção de inatividade após 5 minutos
- Rastreamento por projeto
- Status Bar mostrando o arquivo atual e tempo gasto

## Como Contribuir

Contribuições são bem-vindas! Se você tem alguma sugestão ou encontrou um bug:

1. Faça um fork deste repositório
2. Crie uma branch com sua feature ou correção (`git checkout -b minha-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona uma nova feature'`)
4. Push para a branch (`git push origin minha-feature`)
5. Abra um Pull Request

## Tecnologias Utilizadas

- TypeScript
- VS Code Extension API
- SQLite (via sqlite3)

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

---

## Desenvolvimento

Para iniciar o desenvolvimento:

```bash
# Instalar dependências
npm install

# Compilar a extensão em modo de desenvolvimento
npm run compile

# Compilar e observar mudanças
npm run watch
```

Para testar a extensão:

1. Pressione F5 no VS Code para iniciar uma nova janela com a extensão carregada
2. A extensão deve iniciar automaticamente e começar a monitorar seu tempo

**Aproveite o myTimeTracker e monitore seu tempo de desenvolvimento de forma eficiente!**
