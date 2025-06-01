# myTimeTracker

Uma extensão para o Visual Studio Code que monitora automaticamente o tempo gasto em cada arquivo e projeto, permitindo que você acompanhe suas atividades de desenvolvimento.

## Funcionalidades

- **Monitoramento Automático**: Registra automaticamente o tempo gasto em cada arquivo quando você trabalha no VS Code.
- **Rastreamento por Projeto**: Organiza os dados por projeto para melhor análise de tempo.
- **Detecção de Inatividade**: Detecta períodos de inatividade (após 5 minutos) para registros de tempo mais precisos.
- **Persistência Local**: Armazena todos os dados localmente em um banco de dados SQLite.
- **Baixo Consumo de Recursos**: Opera silenciosamente em segundo plano sem impactar o desempenho.

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

Configurações planejadas para versões futuras:

- `myTimeTracker.idleTimeout`: Define o tempo (em minutos) para considerar o usuário como inativo.
- `myTimeTracker.autoStart`: Ativa/desativa o início automático do monitoramento quando o VS Code é iniciado.

## Problemas Conhecidos

- Atualmente, a extensão não fornece uma interface visual para visualizar os dados coletados.

## Melhorias Planejadas

- **Status Bar Item**: Mostrar o tempo atual do arquivo ou o status do monitoramento na barra de status do VS Code.
- **Heartbeat**: Implementar "heartbeats" periódicos para uma contagem de tempo mais precisa.
- **Interface de Visualização**: Adicionar painéis e gráficos para visualizar os dados de tempo coletados.
- **Exportação de Dados**: Permitir a exportação dos dados em diferentes formatos.
- **Tratamento de Erros**: Melhora o tratamento de erros de rede e outras exceções.
- **Autenticação**: Planeja-se implementar um método de autenticação (como API Key) para permitir a sincronização segura dos dados com um servidor externo em versões futuras.
- **Separação de responsabilidades**: O arquivo extension.ts contém toda a lógica, poderia ser dividido em módulos
- **Melhor tratamento de erros**: Adicionar tratamento de exceções mais robusto
- **Visualização de dados**: Implementar painéis para visualizar as estatísticas de tempo
- **Status Bar interativa**: Melhorar a interação com o usuário através da barra de status

## Notas de Lançamento

### 0.0.1

Lançamento inicial com funcionalidades básicas:

- Monitoramento automático de tempo por arquivo
- Persistência local usando SQLite
- Detecção de inatividade
- Rastreamento por projeto

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
- ESBuild para bundle

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
