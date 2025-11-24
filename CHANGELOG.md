# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e este projeto adhere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-11-23

### Adicionado

- **Configurações Dinâmicas via API**: Sistema completo de configuração remota via `/sync/config`
  - `syncTimes` - Horários de auto-sync configuráveis pelo superadmin
  - `batchLimit` - Limite de entries por batch configurável remotamente
  - `maxRetries` - Número de tentativas de retry ajustável
  - `retryDelayMs` - Delay entre tentativas configurável
  - **Persistência Local**: Configs salvas no SQLite para uso offline
  - **Fallback Inteligente**: constants → banco → API (sempre atualizado)

- **Loop Automático de Sincronização**: Sistema inteligente que processa todas entries pendentes
  - Continua automaticamente enquanto houver entries não sincronizadas
  - Reduz ações do usuário em 80% (5 comandos → 1 comando)
  - Feedback de progresso batch por batch nos logs
  - Para automaticamente quando `synced=0` acabar

- **Documentação Backend Completa**: Novo arquivo `BACKEND_SYNC_VALIDATION.md`
  - Checklist de 10 etapas para validação de sincronização
  - Queries SQL de diagnóstico
  - Estrutura da tabela recomendada
  - Testes manuais com exemplos práticos
  - Problemas comuns e soluções

### Alterado

- **SyncManager.pushEntries()**: Retorna objeto `{ syncedCount, conflictsCount }` ao invés de `number`
- **Marcação Inteligente**: Marca todas entries enviadas como `synced=1` (conflitos = já na cloud)
- **DatabaseManager.getUnsyncedEntries()**: Aceita parâmetro `limit` dinâmico (padrão: 100)
- **Loop de Sync**: Baseado em `result.syncedCount > 0` (independente de conflitos)
- **Logs Melhorados**: Distingue entre entries novas salvas e conflitos detectados
- **SYNC_DEFAULT_TIMES**: Movido de valor hard-coded para constante exportável

### Corrigido

- **Bug de Conflitos Infinitos**: Entries com conflito não ficam mais presas em loop
- **Sincronização Incompleta**: Agora processa TODAS entries até `synced=0` acabar
- **Inconsistência de Config**: `batchLimit` agora sincronizado entre extensão e backend

## [Não Lançado]

### Adicionado

- **Sincronização com Cloud**: Sistema completo de sincronização bidirecional com backend
  - **ApiKeyManager**: Gerenciamento seguro de API Key via VS Code SecretStorage
  - **DeviceManager**: Identificação única de dispositivos com UUID v4
  - **SyncManager**: Orquestração de push/pull automático e manual
  - **SyncRetryManager**: Sistema de retry com backoff exponencial (até 5 tentativas)
  - **Comandos de Sync**:
    - `MyTimeTrace: Set API Key` - Configurar chave de autenticação
    - `MyTimeTrace: View API Key` - Visualizar API Key mascarada com opções de teste e cópia
    - `MyTimeTrace: Revoke API Key` - Remover API Key e voltar ao modo local
    - `MyTimeTrace: Sync Now` - Sincronização manual com progress notification
    - `MyTimeTrace: View Sync Status` - Painel webview com status de todos os dispositivos
  - **Indicador Visual**: Ícone animado `$(sync~spin)` na status bar durante sincronização ativa
  - **Auto-Sync**: Sincronização automática em horários configuráveis (padrão: 08:00 e 17:00)
  - **Configurações**:
    - `syncEnabled` - Habilitar/desabilitar sincronização automática
    - `syncInterval` - Intervalo de verificação em minutos (5-1440)
  - **Mensagens de Erro Melhoradas**: Botões de ação "Tentar Novamente" e "Ver Detalhes" com cópia para clipboard
  - **Suporte Multi-Tenant**: Isolamento por API Key + device_key
  - **Batch Sync**: Limite de 500 entries por push/pull para otimização

- **Rastreamento de Dispositivo**: Novo campo `device_name` na tabela `time_entries` para identificar o computador de origem
- **Módulo deviceInfo**: Novo módulo `src/modules/deviceInfo.ts` para capturar informações do dispositivo usando `os.hostname()`
- **Migração Automática**: Sistema de migração automática para adicionar coluna `device_name` em bancos existentes
- **Testes Completos**: 
  - 27 testes para ApiKeyManager (validação, formato, teste de conexão)
  - 20 testes para DeviceManager (registro, status de sync)
  - 20+ testes para SyncRetryManager (retry logic, configuração dinâmica)
  - 13 testes para comandos de UI (syncNow, viewSyncStatus, integração statusBar)
  - **88% de cobertura de testes** nos módulos de sincronização

### Alterado

- Interface `ActivityData` agora inclui campo opcional `device_name?: string`
- Método `saveActivityData()` atualizado para salvar nome do dispositivo em todos os registros
- `timeTrace.ts` agora captura automaticamente `device_name` usando `getDeviceName()`
- `StatusBarManager` agora suporta método `setSyncStatus(boolean)` para controle visual de sync
- `DatabaseManager` estendido com 5 métodos de sincronização:
  - `getUnsyncedEntries()` - Busca entries locais não sincronizadas
  - `markAsSynced()` - Marca entries como sincronizadas
  - `insertSyncedEntry()` - Insere entry de outro dispositivo (INSERT OR IGNORE)
  - `getMetadata()/setMetadata()` - Store key-value para controle de sync
- `extension.ts` atualizado para orquestrar todos os managers de sincronização
- Configuração `UserConfig` agora inclui `syncEnabled: boolean`

### Técnico

- **Arquitetura Manager Pattern**: Separação clara de responsabilidades (ApiKey, Device, Sync, Retry)
- **SecretStorage**: Credenciais criptografadas nativamente pelo SO
- **Retry com Backoff**: Configuração dinâmica via backend (maxRetries: 1-10, delay: 1s-60s)
- **Tabela sync_metadata**: Store key-value SQLite para controle de estado
- **Webview Responsivo**: Dashboard de status com CSS integrado ao tema VS Code
- **Traduções i18n**: Suporte completo pt-BR e EN para todos os comandos de sync
- Preparação para sincronização com API: device_name permitirá identificar origem dos dados
- Export de `getDeviceName()` e `getDeviceInfo()` no barrel file `modules/index.ts`
- Dependências adicionadas: `uuid@10.0.0`, `@types/uuid@10.0.0`

## [0.3.0] - 2025-10-20

### Adicionado

- **Dashboard Moderno Unificado**: Consolidação de dois dashboards em um único, com design responsivo e integração de filtros
- **Paleta de Cores Expandida**: 50 cores distintas para suportar múltiplos projetos sem conflitos visuais
- **Filtros Integrados**: Filtros por data (inicial/final) e seleção múltipla de projetos no dashboard principal
- **Gráfico Donut Interativo**: Visualização dinâmica com tooltips, atualização em tempo real com filtros
- **Tabela Expansível de Projetos**: Visualização detalhada de projetos com ordenação por coluna (nome, tempo, arquivos)
- **Sistema de Cores Consistente**: Função `getProjectColor()` garante cores constantes independente de filtros
- **Cards de Estatísticas**: Resumo em tempo real (Total, Hoje, Arquivos, Esta Semana) atualizados dinamicamente
- **Sistema de Exclusão com Histórico**: Soft delete, hard delete, cleanup automático (>30 dias) e restauração

### Alterado

- Removido dashboard legacy com filtros separados (`generateStatsWithFiltersHtml`)
- Simplificado o método `showStats()` para chamar `showSimpleStats()` diretamente
- Removida duração de menu QuickPick (interface simplificada)
- Atualizado sistema de testes para refletir nova arquitetura unificada
- CSS refatorizado com melhor separação de responsabilidades
- Melhorado layout responsivo do painel de estatísticas

### Removido

- Método `generateStatsWithFiltersHtml()` (~84 linhas)
- Método `getFiltersJavaScript()` (~250 linhas)
- Método `createStatsWithFiltersPanel()` (~21 linhas)
- Método `showStatsWithFilters()` (~48 linhas)
- Menu de escolha de dashboard (QuickPick)
- Arquivo `filters-styles.css` (não mais necessário)
- Método `loadFiltersStyles()` de CssLoader

### Corrigido

- Problemas de layout com nomes de arquivo longos (text wrapping)
- Duplicação de cores entre array principal e função `getProjectColor()`
- Sincronização automática de paleta de cores em todas as visualizações
- Removed dead code `getFiltersStyles()` (~200 linhas)

### Técnico

- Cobertura de testes: 88% (21 testes passando, 100% sucesso)
- Arquitetura simplificada: 1 dashboard unificado em vez de 2
- Performance: Redução de ~600 linhas de código desnecessário
- Compatibilidade: VS Code v1.100.0+, Node 20.x+

## [0.2.1] - 2025-06-29

### Adicionado

- **Nova Identidade Visual Profissional**: Logo criada com IA representando tempo (relógio laranja) e código (chevron azul)
- **Documentação da Identidade Visual**: Arquivo `IDENTIDADE_VISUAL.md` com conceitos, significados e aplicações da logo
- **Apresentação Aprimorada**: Logo integrada ao README.md e package.json
- **Descrição Melhorada**: Texto mais detalhado e atrativo no package.json

### Alterado

- Atualização da versão seguindo padrão SemVer (0.2.0 → 0.2.1)
- README.md com nova logo centralizada como header
- Documentação de publicação atualizada com nova identidade

## [0.2.0] - 2025-06-28

### Adicionado

- Separação de responsabilidades em módulos específicos
- Módulo de configuração (`config.ts`) para gerenciar configurações do usuário
- Módulo de banco de dados (`database.ts`) com classe `DatabaseManager`
- Módulo de status bar (`statusBar.ts`) com classe `StatusBarManager`
- Módulo de estatísticas (`stats.ts`) com classe `StatsManager`
- Módulo de rastreamento de tempo (`timeTrace.ts`) com classe `timeTrace`
- Módulo de comandos (`commands.ts`) com classe `CommandManager`
- **Pasta UI (`src/ui/`)** com componentes de interface separados:
  - `StatsPanel` classe para gerenciar painéis de estatísticas
  - **Filtros interativos avançados** por data e projeto nas estatísticas
  - Interface responsiva com layout em grid (40/60) para melhor usabilidade
  - Controles de filtragem em tempo real com aplicação instantânea
  - Resumo estatístico dinâmico de dados filtrados
  - Header fixo para melhor navegação
  - Projetos expansíveis/colapsáveis para organização visual
  - Verificações robustas de elementos DOM no JavaScript
  - CSS modular com variáveis do tema VS Code
  - JavaScript otimizado com tratamento de erros
- Melhor organização do código com classes especializadas
- Tratamento de erros aprimorado com async/await

### Alterado

- Refatoração completa do arquivo `extension.ts` para usar arquitetura modular
- Conversão de funções globais para classes com responsabilidades específicas
- Melhoria na gestão de recursos e limpeza de memória
- **Layout das estatísticas redesenhado** com grid responsivo
- **Interface de filtros aprimorada** com melhor UX
- Atualização da versão seguindo padrão SemVer (0.1.0 → 0.2.0)

### Corrigido

- **Bug crítico**: Elemento `resultsSummary` ausente no HTML causando erro JavaScript
- **Verificações de segurança**: Elementos DOM são verificados antes do acesso
- Melhor isolamento de responsabilidades evitando acoplamento
- Gestão mais robusta de recursos e handlers de eventos
- Correção de possíveis vazamentos de memória
- **Layout responsivo** funcionando corretamente em diferentes tamanhos de tela

## [0.1.0] - 2025-06-18

### Adicionado

- Visualização de estatísticas por projeto com detalhes de arquivos
- Exibição hierárquica de arquivos agrupados por projeto
- Formatação inteligente de caminhos de arquivos para melhor legibilidade
- Interface visual aprimorada para visualização dos dados coletados
- Seções de projetos colapsáveis para melhor organização das estatísticas

### Corrigido

- Correção do problema "command already exists" nos testes
- Melhor manuseio de caminhos de arquivo absolutos na visualização de estatísticas
- Correção da funcionalidade de toggle para todos os projetos na visualização de estatísticas

## [Planejado]

## [0.0.1] - 2025-05-31

### Adicionado

- Sistema de monitoramento automático de tempo por arquivo
- Rastreamento por projeto para organização dos dados
- Detecção de inatividade após 5 minutos
- Persistência local de dados usando SQLite
- Inicialização automática do monitoramento ao abrir o VS Code

## [Planejado]

- Interface visual para visualização dos dados
- Status Bar Item para mostrar o tempo atual do arquivo
- Implementação de "heartbeats" periódicos
- Exportação de dados
- Configurações personalizáveis
