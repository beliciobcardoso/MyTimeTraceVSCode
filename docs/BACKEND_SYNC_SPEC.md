# Especificação Técnica - Backend de Sincronização MyTimeTrace

## ⚠️ ESCOPO DESTE PROJETO

**🎯 Este repositório implementa APENAS o backend Cloud (API REST).**

**A extensão VS Code MyTimeTrace:**
- ✅ **JÁ EXISTE** em produção (repositório separado)
- ✅ **NÃO SERÁ** implementada neste projeto
- 📋 Backend fornece **API REST** para a extensão consumir
- 📋 Documentação Swagger disponível em `/api/docs`

**Divisão de responsabilidades:**
- **MyTimeTraceCloud (este repo):** Backend API, PostgreSQL, autenticação, sync logic
- **MyTimeTrace VS Code (repo separado):** Extensão, SQLite local, UI, comandos

---

## 📋 Sumário Executivo

Este documento define a especificação completa para o **backend Node.js/TypeScript** responsável por **sincronizar dados de rastreamento de tempo** da extensão VS Code MyTimeTrace com uma API REST centralizada. 

**Características Principais:**
- 🌍 **Multi-Usuário Global:** Suporta milhares de usuários independentes
- 💻 **Multi-Dispositivo:** Cada usuário pode sincronizar dados de múltiplos PCs
- 🔐 **Identificação Segura:** API_KEY (usuário) + device_key (dispositivo)
- 🔄 **Sincronização Push-first:** Push (enviar) é o fluxo oficial; Pull fica como histórico/deprecado
- 🔒 **Isolamento de Dados:** Cada usuário vê apenas seus próprios dados

### Modelo de Dados

```
┌─────────────────────────────────────────────────────────┐
│              PLATAFORMA WEB (Registro)                  │
│  Usuário cria conta → Gera API_KEY única                │
│  API_KEY: "mtt_1a2b3c4d5e6f7g8h9i0j"                    │
└─────────────────────────────────────────────────────────┘
                           ↓
                  (Copia e Cola)
                           ↓
┌─────────────────────────────────────────────────────────┐
│            VS CODE EXTENSIONS (Clientes)                │
│  ├── Notebook Trabalho                                  │
│  │   └── API_KEY: "mtt_1a2b3c4d5e6f7g8h9i0j"           │
│  │   └── device_key: "uuid-auto-gerado-1"              │
│  ├── Desktop Casa                                       │
│  │   └── API_KEY: "mtt_1a2b3c4d5e6f7g8h9i0j" (MESMA)   │
│  │   └── device_key: "uuid-auto-gerado-2"              │
│  └── MacBook Pessoal                                    │
│      └── API_KEY: "mtt_1a2b3c4d5e6f7g8h9i0j" (MESMA)   │
│      └── device_key: "uuid-auto-gerado-3"              │
└─────────────────────────────────────────────────────────┘

Sincronização: API_KEY identifica usuário + device_key identifica PC
```

---

## 🎯 Objetivos do Backend

### Objetivo Principal
Criar um serviço backend que:
1. **Receba** dados de rastreamento de múltiplos dispositivos
2. **Armazene** centralizadamente em banco de dados relacional
3. **Forneça** endpoints REST para consulta e sincronização
4. **Resolva conflitos** de sincronização entre dispositivos
5. **Mantenha integridade** dos dados de tempo rastreado

### Objetivos Específicos
- ✅ **Multi-Tenant Architecture:** Isolamento completo de dados por usuário
- ✅ **API REST:** endpoints ativos focados em push; pull tratado como histórico/deprecado
- ✅ **Persistência PostgreSQL:** Schema otimizado com relacionamentos
- ✅ **Sincronização Incremental:** Apenas dados novos/modificados
- ✅ **Identificação Única:** API_KEY (usuário) + device_key (dispositivo)
- ✅ **Resolução de Conflitos:** Por timestamp + device_id
- ✅ **Documentação OpenAPI/Swagger:** Interface interativa
- ✅ **Testes Automatizados:** Cobertura > 70%
- ✅ **Docker/Docker Compose:** Deploy simplificado

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológico Recomendado

```json
{
  "runtime": "Node.js 20.x LTS",
  "linguagem": "TypeScript 5.x",
  "framework": "NestJS 10.x",
  "database": "PostgreSQL 17",
  "orm": "Prisma 6.17.1",
  "validação": "class-validator + class-transformer (built-in NestJS)",
  "testes": "Jest (built-in NestJS) - Apenas Unitários",
  "docs": "Swagger/OpenAPI 3.0 (@nestjs/swagger)",
  "containerização": "Docker + Docker Compose"
}
```

### Arquitetura em Camadas (NestJS)

```
backend/
├── prisma/                    # 📁 Schema Prisma (raiz do projeto)
│   ├── schema.prisma          # Definição de modelos e database
│   ├── migrations/            # Migrações do banco de dados
│   └── seed.ts                # Script de seed (opcional)
├── src/
│   ├── auth/                  # 🔐 Módulo de autenticação/registro
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── signup.dto.ts
│   │   │   └── login.dto.ts
│   │   └── auth.module.ts
│   ├── sync/                  # 🔄 Módulo de sincronização
│   │   ├── sync.controller.ts
│   │   ├── sync.service.ts
│   │   ├── dto/
│   │   │   ├── register-device.dto.ts
│   │   │   ├── push.dto.ts
│   │   │   └── pull.dto.ts
│   │   └── sync.module.ts
│   ├── entries/               # 📝 Módulo de time entries
│   │   ├── entries.controller.ts
│   │   ├── entries.service.ts
│   │   ├── dto/
│   │   │   └── entry-query.dto.ts
│   │   └── entries.module.ts
│   ├── stats/                 # 📊 Módulo de estatísticas
│   │   ├── stats.controller.ts
│   │   ├── stats.service.ts
│   │   └── stats.module.ts
│   ├── prisma/                # 🗄️ Módulo Prisma (wrapper service)
│   │   ├── prisma.service.ts  # Service que estende PrismaClient
│   │   └── prisma.module.ts   # Global module para injeção
│   ├── common/                # 🛠️ Recursos compartilhados
│   │   ├── filters/           # Exception filters
│   │   ├── interceptors/      # Interceptors (logging, transform)
│   │   ├── guards/            # Guards (API key validation)
│   │   ├── decorators/        # Custom decorators (@ApiKey)
│   │   └── middleware/        # Middleware (rate limiting)
│   ├── app.module.ts          # 📦 Módulo raiz
│   └── main.ts                # 🚀 Ponto de entrada
├── test/                      # 🧪 Testes unitários
│   ├── auth.service.spec.ts
│   ├── sync.service.spec.ts
│   └── jest.config.ts
├── docker-compose.yml         # 🐳 Orquestração de containers
├── Dockerfile                 # 🐳 Imagem do backend
├── .env                       # 🔑 Variáveis de ambiente
├── .env.example               # 📋 Template de variáveis
├── nest-cli.json              # ⚙️ Configuração NestJS
├── tsconfig.json              # ⚙️ Configuração TypeScript
└── package.json               # 📦 Dependências
```

**Nota Importante:** 
- 📁 **prisma/** fica na **raiz do projeto** (não dentro de `src/`)
- 🗄️ **src/prisma/** contém apenas o **PrismaModule e PrismaService** (wrapper)
- ✅ Esta é a estrutura padrão recomendada pelo NestJS e Prisma

---

## 💾 Schema do Banco de Dados

### 🔷 Schema Prisma Completo

```prisma
// prisma/schema.prisma

// 🔧 Database connection configuration
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 📦 Prisma Client generator configuration
generator client {
  provider = "prisma-client-js"
}

// 👤 User model - Usuários globais da plataforma
model User {
  id        String   @id @default(uuid(7)) @db.Uuid
  
  // Autenticação
  email         String   @unique @db.VarChar(255)
  passwordHash  String   @map("password_hash") @db.VarChar(255)
  
  // API Key (gerada na plataforma web)
  apiKey        String   @unique @map("api_key") @db.VarChar(255)
  apiKeyCreatedAt DateTime? @default(now()) @map("api_key_created_at") @db.Timestamptz(6)
  
  // Metadados
  displayName   String?  @map("display_name") @db.VarChar(255)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  lastActive    DateTime @default(now()) @map("last_active") @db.Timestamptz(6)
  
  // Estatísticas
  totalDevices  Int      @default(0) @map("total_devices")
  totalEntries  Int      @default(0) @map("total_entries")
  isActive      Boolean  @default(true) @map("is_active")
  
  // Relações
  devices       Device[]
  timeEntries   TimeEntry[]
  syncLogs      SyncLog[]
  
  @@index([apiKey], name: "idx_users_api_key")
  @@index([email], name: "idx_users_email")
  @@index([lastActive(sort: Desc)], name: "idx_users_last_active")
  @@map("users")
}

// 💻 Device model - Registra dispositivos de cada usuário (relação 1:N)
model Device {
  id        String   @id @default(uuid(7)) @db.Uuid
  
  // Relacionamento com usuário
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Identificação do dispositivo
  deviceKey       String  @map("device_key") @db.VarChar(255)
  deviceName      String  @map("device_name") @db.VarChar(255)
  deviceHostname  String? @map("device_hostname") @db.VarChar(255)
  
  // Informações técnicas
  devicePlatform  String? @map("device_platform") @db.VarChar(50)
  deviceArch      String? @map("device_arch") @db.VarChar(20)
  deviceType      String? @map("device_type") @db.VarChar(50)
  deviceRelease   String? @map("device_release") @db.VarChar(100)
  
  // Metadados
  firstSeen     DateTime @default(now()) @map("first_seen") @db.Timestamptz(6)
  lastSeen      DateTime @default(now()) @map("last_seen") @db.Timestamptz(6)
  totalEntries  Int      @default(0) @map("total_entries")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // Relações
  timeEntries   TimeEntry[]
  syncLogs      SyncLog[]
  
  @@unique([userId, deviceKey], name: "unique_user_device")
  @@index([userId], name: "idx_devices_user")
  @@index([deviceKey], name: "idx_devices_key")
  @@index([userId, isActive], name: "idx_devices_user_active")
  @@index([lastSeen(sort: Desc)], name: "idx_devices_last_seen")
  @@map("devices")
}

// ⏱️ TimeEntry model - Armazena todos os registros de tempo rastreados
model TimeEntry {
  id        String   @id @default(uuid(7)) @db.Uuid
  
  // Identificação (MULTI-TENANT)
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  deviceId  String   @map("device_id") @db.Uuid
  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  
  // Dados do rastreamento
  timestamp       DateTime @db.Timestamptz(6)
  project         String   @db.VarChar(255)
  file            String   @db.Text
  durationSeconds Int      @map("duration_seconds")
  isIdle          Boolean  @default(false) @map("is_idle")
  
  // Metadados de sincronização
  clientId  String?  @map("client_id") @db.VarChar(36)
  syncedAt  DateTime @default(now()) @map("synced_at") @db.Timestamptz(6)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  @@unique([userId, deviceId, timestamp, project, file], name: "unique_entry")
  @@index([userId], name: "idx_time_entries_user")
  @@index([deviceId], name: "idx_time_entries_device")
  @@index([userId, timestamp(sort: Desc)], name: "idx_time_entries_user_timestamp")
  @@index([userId, project], name: "idx_time_entries_user_project")
  @@index([syncedAt], name: "idx_time_entries_synced_at")
  @@map("time_entries")
}

// 📋 SyncLog model - Registra histórico de sincronizações para auditoria
model SyncLog {
  id        String   @id @default(uuid(7)) @db.Uuid
  
  // Relacionamentos
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  deviceId  String   @map("device_id") @db.Uuid
  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  
  // Dados do sync
  syncType      String   @map("sync_type") @db.VarChar(20)
  entriesCount  Int      @default(0) @map("entries_count")
  success       Boolean  @default(true)
  errorMessage  String?  @map("error_message") @db.Text
  syncedAt      DateTime @default(now()) @map("synced_at") @db.Timestamptz(6)
  
  @@index([userId], name: "idx_sync_logs_user")
  @@index([deviceId], name: "idx_sync_logs_device")
  @@index([syncedAt(sort: Desc)], name: "idx_sync_logs_synced_at")
  @@index([userId, deviceId], name: "idx_sync_logs_user_device")
  @@map("sync_logs")
}
```

---

## 🔐 Sistema de Identificação Multi-Usuário

### Conceito de `API_KEY` e `device_key`

**Problema:** Como identificar usuários globalmente de forma segura e simples?

**Solução:** Registro em plataforma web com geração de API Key única.

#### `API_KEY` (Identificador do Usuário)
- **Geração:** Criada **manualmente** pelo usuário na **plataforma web**
- **Formato:** `mtt_{32_caracteres_alfanumericos}` (ex: `mtt_1a2b3c4d5e6f7g8h9i0j`)
- **Armazenamento VS Code:** `context.secrets` (SecretStorage API - criptografado nativamente)
- **Função:** Autenticar e identificar o usuário em TODOS os dispositivos
- **Compartilhamento:** Usuário copia da plataforma web e cola em cada VS Code
- **Segurança:** Criptografada pelo sistema operacional (Electron safeStorage)
- **Regeneração:** Cada nova chave gerada **invalida todas as anteriores** (desconecta todos os dispositivos)

#### `device_key` (Identificador do Dispositivo)
- **Geração:** UUID v4 gerado **automaticamente pela extensão VS Code** quando usuário ativa sincronização pela primeira vez
- **Local de Geração:** Cliente (extensão VS Code), não no servidor
- **Armazenamento:** `context.secrets` (SecretStorage API - criptografado nativamente)
- **Função:** Distinguir diferentes computadores do mesmo usuário
- **Único:** Cada instalação da extensão = 1 device_key único
- **Transparente:** Usuário não precisa ver ou copiar (gerado e gerenciado automaticamente pela extensão)
- **Segurança:** Criptografado pelo sistema operacional (não sincroniza entre máquinas)
- **Envio para API:** Enviado ao servidor apenas durante registro inicial (POST /sync/register)

### Fluxo de Registro Inicial

```
1. Usuário acessa PLATAFORMA WEB
   → Cria conta (email + senha)
   → Acessa página de configurações/API Keys
   → Clica em "Gerar Nova API Key"
   → Sistema gera API_KEY e exibe UMA ÚNICA VEZ
   → Usuário COPIA a API_KEY (não poderá ver novamente)

2. Usuário instala extensão VS Code no PC-1
   → Extensão funciona normalmente (modo local sem sincronização)
   → Usuário ESCOLHE ativar sincronização via comando ou configuração
   → Extensão solicita API_KEY
   → Usuário COLA a API_KEY
   → Extensão gera device_key automático para PC-1
   → Envia ao servidor: POST /sync/register {api_key, device_key, device_info}

3. Usuário instala extensão VS Code no PC-2
   → Extensão funciona normalmente (modo local sem sincronização)
   → Usuário ESCOLHE ativar sincronização
   → Extensão solicita API_KEY
   → Usuário COLA a MESMA API_KEY
   → Extensão gera device_key NOVO para PC-2
   → Envia ao servidor: POST /sync/register {api_key, device_key, device_info}

Resultado: 1 usuário (1 API_KEY), 2 dispositivos diferentes

⚠️ IMPORTANTE: Se usuário gerar NOVA API_KEY na plataforma:
   → Todas as chaves antigas são invalidadas imediatamente
   → Todos os dispositivos perdem sincronização
   → Usuário precisa reconfigurar TODOS os VS Code com a nova chave
```

### Gerenciamento de API_KEY (Extensão VS Code)

**Comando VS Code:** `my-time-trace-vscode.setApiKey`
- Abre input box para colar API_KEY
- Valida formato `mtt_*` (32 caracteres)
- Armazena criptografado via `context.secrets.store('apiKey', value)`
- Testa conexão com servidor

**Comando VS Code:** `my-time-trace-vscode.viewApiKey`
- Mostra API_KEY atual mascarada (ex: `mtt_1a2b...0j`)
- Permite copiar para clipboard
- Exibe status de conexão com servidor

**Comando VS Code:** `my-time-trace-vscode.revokeApiKey`
- Remove API_KEY via `context.secrets.delete('apiKey')`
- Remove device_key via `context.secrets.delete('deviceKey')`
- Para sincronização automática
- Mantém dados locais no SQLite (não deleta time entries)

---

## 🔌 Especificação da API REST

### Base URL
```
http://localhost:8989/api/v1
```

### Endpoints Principais

#### 0. **POST /sync/register** - Registrar Dispositivo

**Descrição:** Primeiro contato da extensão VS Code com o servidor. Vincula dispositivo à conta do usuário usando API_KEY.

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Request Body:**
```json
{
  "device_key": "uuid-auto-gerado-dispositivo",
  "device_info": {
    "device_name": "Notebook Trabalho",
    "hostname": "notebook-dev",
    "platform": "linux",
    "arch": "x64",
    "type": "Linux",
    "release": "6.5.0-35-generic"
  }
}
```

**Response (201 Created) - Novo Dispositivo:**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "user": {
    "id": "uuid-server-user",
    "email": "joao@example.com",
    "display_name": "João Silva",
    "total_devices": 1
  },
  "device": {
    "id": "uuid-server-device",
    "device_key": "uuid-auto-gerado-dispositivo",
    "device_name": "Notebook Trabalho",
    "created_at": "2025-11-18T14:00:00.000Z"
  }
}
```

**Response (200 OK) - Dispositivo Já Registrado:**
```json
{
  "success": true,
  "message": "Device already registered",
  "device": {
    "id": "uuid-server-device",
    "device_key": "uuid-auto-gerado-dispositivo",
    "device_name": "Notebook Trabalho",
    "last_seen": "2025-11-18T14:00:00.000Z"
  }
}
```

**Response (401 Unauthorized) - API_KEY Inválida:**
```json
{
  "success": false,
  "error": "Invalid or expired API key",
  "statusCode": 401
}
```

---

#### 2. **POST /sync/push** - Enviar Dados para o Servidor

**Descrição:** Cliente envia registros locais não sincronizados para o servidor.

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Request Body:**
```json
{
  "device_key": "uuid-auto-gerado-dispositivo",
  "device_info": {
    "device_name": "Notebook Trabalho",
    "hostname": "notebook-dev",
    "platform": "linux",
    "arch": "x64",
    "type": "Linux",
    "release": "6.5.0-35-generic"
  },
  "entries": [
    {
      "timestamp": "2025-11-18T14:30:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "/home/user/project/src/extension.ts",
      "duration_seconds": 120,
      "is_idle": false,
      "client_id": "uuid-gerado-no-cliente"
    },
    {
      "timestamp": "2025-11-18T14:32:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "/home/user/project/src/modules/database.ts",
      "duration_seconds": 180,
      "is_idle": false,
      "client_id": "uuid-gerado-no-cliente-2"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "2 entries synchronized successfully",
  "synced_count": 2,
  "skipped_count": 0,
  "conflicts": [],
  "sync_id": "sync-uuid-123",
  "synced_at": "2025-11-18T14:35:00.000Z"
}
```

**Response (207 Multi-Status) - Com Conflitos:**
```json
{
  "success": true,
  "message": "Partial synchronization completed",
  "synced_count": 1,
  "skipped_count": 1,
  "conflicts": [
    {
      "client_id": "uuid-gerado-no-cliente",
      "timestamp": "2025-11-18T14:30:00.000Z",
      "reason": "duplicate_entry",
      "server_entry_id": "server-uuid-456"
    }
  ],
  "sync_id": "sync-uuid-124",
  "synced_at": "2025-11-18T14:35:00.000Z"
}
```

---

#### 3. **GET /sync/pull** - Obter Dados do Servidor (LEGADO / DEPRECIADO)

**Descrição:** Cliente baixa registros do servidor (outros dispositivos do mesmo usuário).

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Query Parameters:**
- `device_key` (required): Chave única do dispositivo solicitante
- `since` (optional): ISO timestamp - apenas registros após essa data
- `limit` (optional): Número máximo de registros (padrão: 1000)
- `offset` (optional): Para paginação (padrão: 0)

**Request:**
```
GET /sync/pull?device_key=uuid-dispositivo&since=2025-11-17T00:00:00.000Z&limit=100
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Response (200 OK):**
```json
{
  "success": true,
  "device_key": "uuid-dispositivo",
  "entries": [
    {
      "id": "server-uuid-789",
      "timestamp": "2025-11-18T10:00:00.000Z",
      "project": "MyTimeTraceVSCode",
      "file": "/home/user/project/README.md",
      "duration_seconds": 300,
      "is_idle": false,
      "device_name": "Desktop Casa",
      "device_key": "uuid-outro-dispositivo",
      "synced_at": "2025-11-18T10:05:00.000Z"
    }
  ],
  "total_count": 1,
  "has_more": false,
  "next_offset": null
}
```

---

#### 4. **GET /sync/status** - Status de Sincronização

**Descrição:** Verificar último sync e estatísticas do usuário e dispositivos.

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Query Parameters:**
- `device_key` (optional): Chave do dispositivo específico (se omitido, retorna todos)

**Request:**
```
GET /sync/status?device_key=uuid-dispositivo
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "email": "joao@example.com",
    "display_name": "João Silva"
  },
  "current_device_key": "uuid-dispositivo",
  "last_sync_at": "2025-11-18T14:35:00.000Z",
  "total_entries": 1523,
  "last_7_days_entries": 245,
  "devices": [
    {
      "device_key": "uuid-dispositivo",
      "device_name": "Notebook Trabalho",
      "entries_count": 823,
      "last_seen": "2025-11-18T14:35:00.000Z",
      "is_active": true
    },
    {
      "device_key": "uuid-outro-dispositivo",
      "device_name": "Desktop Casa",
      "entries_count": 700,
      "last_seen": "2025-11-18T09:20:00.000Z",
      "is_active": true
    }
  ]
}
```

---

#### 5. **GET /entries** - Consultar Registros

**Descrição:** Buscar registros com filtros avançados (isolamento automático por API_KEY).

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Query Parameters:**
- `device_key` (optional): Filtrar por dispositivo específico
- `project` (optional): Filtrar por projeto
- `start_date` (optional): Data inicial (ISO)
- `end_date` (optional): Data final (ISO)
- `limit` (optional): Limite de resultados (padrão: 100, max: 1000)
- `offset` (optional): Para paginação

**Request:**
```
GET /entries?device_key=uuid-dispositivo&project=MyTimeTraceVSCode&start_date=2025-11-01&limit=50
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Response (200 OK):**
```json
{
  "success": true,
  "entries": [ /* array de registros */ ],
  "total_count": 245,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

---

#### 6. **GET /stats/summary** - Estatísticas Agregadas

**Descrição:** Obter estatísticas consolidadas (isolamento automático por API_KEY).

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Query Parameters:**
- `device_key` (optional): Filtrar por dispositivo específico
- `start_date` (optional): Data inicial
- `end_date` (optional): Data final
- `group_by` (optional): `project`, `device`, `day`, `week`, `month`

**Request:**
```
GET /stats/summary?start_date=2025-11-01&group_by=project
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Response (200 OK):**
```json
{
  "success": true,
  "period": {
    "start": "2025-11-01T00:00:00.000Z",
    "end": "2025-11-18T23:59:59.999Z"
  },
  "total_duration_seconds": 86400,
  "total_entries": 450,
  "grouped_data": [
    {
      "group": "MyTimeTraceVSCode",
      "duration_seconds": 43200,
      "entries_count": 200,
      "percentage": 50.0
    },
    {
      "group": "OtherProject",
      "duration_seconds": 43200,
      "entries_count": 250,
      "percentage": 50.0
    }
  ]
}
```

---

#### 7. **DELETE /entries/:id** - Deletar Registro (Opcional)

**Descrição:** Remover registro específico (soft delete).

**Headers:**
```
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Request:**
```
DELETE /entries/server-uuid-789
X-API-Key: mtt_1a2b3c4d5e6f7g8h9i0j
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Entry deleted successfully",
  "deleted_id": "server-uuid-789"
}
```

---

## 🔄 Lógica de Sincronização

### Estratégia de Resolução de Conflitos

**Cenários de Conflito:**

1. **Duplicata Exata**: Mesmo `device_name`, `timestamp`, `project`, `file`
   - **Ação:** Ignorar (já existe)
   - **Log:** `skipped_count++`

2. **Timestamp Muito Próximo** (< 1s diferença) + mesmo arquivo
   - **Ação:** Mesclar (somar durações)
   - **Log:** Registrar mesclagem

3. **Dispositivos Diferentes, Mesmo Timestamp**
   - **Ação:** Permitir (usuário pode usar múltiplos PCs)
   - **Log:** Aceitar normalmente

### Algoritmo de Push (Servidor)

```typescript
async function processPush(apiKey: string, data: PushRequest): Promise<PushResponse> {
  const results = {
    synced: [],
    skipped: [],
    conflicts: []
  };

  // 0. Autenticar e buscar usuário pela API_KEY
  const user = await findUserByApiKey(apiKey);
  if (!user) {
    throw new UnauthorizedException('Invalid or expired API key');
  }

  // 1. Buscar ou criar dispositivo
  const device = await findOrCreateDevice(user.id, data.device_key, data.device_info);

  for (const entry of data.entries) {
    // 1. Validar dados
    if (!isValidEntry(entry)) {
      results.skipped.push({ entry, reason: 'invalid_data' });
      continue;
    }

    // 2. Verificar duplicata (POR USUÁRIO + DISPOSITIVO)
    const existing = await findExistingEntry(
      user.id,
      device.id,
      entry.timestamp,
      entry.project,
      entry.file
    );

    if (existing) {
      results.conflicts.push({
        client_id: entry.client_id,
        reason: 'duplicate_entry',
        server_entry_id: existing.id
      });
      continue;
    }

    // 3. Inserir no banco (isolado por usuário)
    const created = await createEntry({
      ...entry,
      user_id: user.id,
      device_id: device.id,
      synced_at: new Date()
    });

    results.synced.push(created);
  }

  // 4. Atualizar last_seen do dispositivo
  await updateDeviceLastSeen(device.id);

  // 5. Atualizar estatísticas do usuário
  await updateUserStats(user.id);

  // 6. Registrar log de sincronização
  await createSyncLog({
    user_id: user.id,
    device_id: device.id,
    sync_type: 'push',
    entries_count: results.synced.length
  });

  return {
    success: true,
    synced_count: results.synced.length,
    skipped_count: results.skipped.length,
    conflicts: results.conflicts
  };
}
```

### Algoritmo de Pull (Servidor)

```typescript
async function processPull(apiKey: string, params: PullParams): Promise<PullResponse> {
  // 0. Autenticar e buscar usuário pela API_KEY
  const user = await findUserByApiKey(apiKey);
  if (!user) {
    throw new UnauthorizedException('Invalid or expired API key');
  }

  // 1. Buscar dispositivo
  const device = await findDeviceByKey(user.id, params.device_key);
  if (!device) {
    throw new Error('Device not found');
  }

  // 1. Buscar registros de OUTROS dispositivos do MESMO USUÁRIO
  const entries = await findEntries({
    user_id: user.id,                     // ISOLAMENTO: apenas dados do usuário
    device_id_not: device.id,             // IMPORTANTE: excluir próprio dispositivo
    synced_at_gte: params.since,
    limit: params.limit,
    offset: params.offset
  });

  // 2. Ordenar por timestamp
  const sorted = entries.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 3. Calcular paginação (isolado por usuário)
  const total = await countEntries({
    user_id: user.id,
    device_id_not: device.id,
    synced_at_gte: params.since
  });

  // 4. Atualizar last_seen do dispositivo
  await updateDeviceLastSeen(device.id);

  return {
    success: true,
    entries: sorted,
    total_count: total,
    has_more: total > (params.offset + params.limit),
    next_offset: total > (params.offset + params.limit) 
      ? params.offset + params.limit 
      : null
  };
}
```

---

## 🧪 Requisitos de Testes

### Testes Unitários (70%+ cobertura)

**Services:**
- ✅ Validação de entrada de dados
- ✅ Lógica de detecção de conflitos
- ✅ Mesclagem de registros
- ✅ Cálculo de estatísticas

**Repositories:**
- ✅ CRUD de `time_entries`
- ✅ CRUD de `devices`
- ✅ Queries complexas (filtros, agrupamentos)

### Testes de Serviços (Unitários)

**Cenários Críticos:**
```typescript
// src/sync/sync.service.spec.ts
describe('SyncService', () => {
  let service: SyncService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            device: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
            timeEntry: { findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn() },
            syncLog: { create: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('processPush', () => {
    it('deve sincronizar registros novos com sucesso', async () => {
      const mockUser = { id: 'user-1', user_key: 'uuid-user' };
      const mockDevice = { id: 'device-1', device_key: 'uuid-device' };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.device, 'findFirst').mockResolvedValue(mockDevice);
      jest.spyOn(prisma.timeEntry, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.timeEntry, 'create').mockResolvedValue({} as any);

      const result = await service.processPush({
        user_key: 'uuid-user',
        device_key: 'uuid-device',
        device_info: { device_name: 'test-device' } as any,
        entries: [{ timestamp: new Date().toISOString() } as any],
      });

      expect(result.synced_count).toBe(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('deve detectar duplicatas e retornar conflitos', async () => {
      const mockUser = { id: 'user-1', user_key: 'uuid-user' };
      const mockDevice = { id: 'device-1', device_key: 'uuid-device' };
      const existingEntry = { id: 'entry-1' };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.device, 'findFirst').mockResolvedValue(mockDevice);
      jest.spyOn(prisma.timeEntry, 'findFirst').mockResolvedValue(existingEntry as any);

      const result = await service.processPush({
        user_key: 'uuid-user',
        device_key: 'uuid-device',
        device_info: { device_name: 'test-device' } as any,
        entries: [{ timestamp: new Date().toISOString(), client_id: 'client-1' } as any],
      });

      expect(result.synced_count).toBe(0);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('duplicate_entry');
    });
  });

  describe('processPull', () => {
    it('deve retornar apenas registros de outros dispositivos', async () => {
      const mockUser = { id: 'user-1' };
      const mockDevice = { id: 'device-1' };
      const mockEntries = [
        { id: 'entry-1', device_id: 'device-2', device: { device_name: 'device-B' } },
        { id: 'entry-2', device_id: 'device-2', device: { device_name: 'device-B' } },
      ];

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.device, 'findFirst').mockResolvedValue(mockDevice as any);
      jest.spyOn(prisma.timeEntry, 'findMany').mockResolvedValue(mockEntries as any);
      jest.spyOn(prisma.timeEntry, 'count').mockResolvedValue(2);

      const result = await service.processPull({
        user_key: 'uuid-user',
        device_key: 'uuid-device',
        limit: 100,
        offset: 0,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.total_count).toBe(2);
    });
  });
});

// src/stats/stats.service.spec.ts
describe('StatsService', () => {
  let service: StatsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: PrismaService,
          useValue: {
            timeEntry: { groupBy: jest.fn(), aggregate: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve calcular estatísticas por projeto', async () => {
    const mockGroupedData = [
      { project: 'ProjectX', _sum: { duration_seconds: 3600 }, _count: { id: 10 } },
    ];

    jest.spyOn(prisma.timeEntry, 'groupBy').mockResolvedValue(mockGroupedData as any);

    const result = await service.getSummary({
      user_key: 'uuid-user',
      group_by: 'project',
    });

    expect(result.grouped_data).toHaveLength(1);
    expect(result.grouped_data[0].group).toBe('ProjectX');
    expect(result.grouped_data[0].entries_count).toBe(10);
  });
});
```

---

## 🐳 Containerização (Docker)

### Dockerfile (NestJS Multi-Stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build da aplicação NestJS
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copiar apenas o necessário do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 8989

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:8989/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: mytimetrace
      POSTGRES_PASSWORD: secure_password_here
      POSTGRES_DB: mytimetrace_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mytimetrace"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    ports:
      - "8989:8989"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://mytimetrace:secure_password_here@postgres:5432/mytimetrace_db
      PORT: 8989
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## 📝 Documentação OpenAPI (Swagger)

### Configuração Swagger (NestJS)

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('MyTimeTrace Sync API')
    .setDescription('API para sincronização de dados de rastreamento de tempo')
    .setVersion('1.0')
    .addTag('Auth', 'Endpoints de autenticação e registro')
    .addTag('Sync', 'Endpoints de sincronização')
    .addTag('Entries', 'Endpoints de consulta de registros')
    .addTag('Stats', 'Endpoints de estatísticas')
    .addServer('http://localhost:8989', 'Development')
    .addServer('https://api.mytimetrace.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(8989);
}
bootstrap();
```

### Exemplo de Anotação (NestJS)

```typescript
// src/sync/sync.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PushRequestDto } from './dto/push.dto';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @ApiOperation({ 
    summary: 'Sincronizar registros locais com o servidor',
    description: 'Envia registros de tempo não sincronizados do cliente para o servidor'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Registros sincronizados com sucesso' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Dados inválidos' 
  })
  async pushSync(@Body() pushDto: PushRequestDto) {
    return this.syncService.processPush(pushDto);
  }
}
```

---

## 🔒 Segurança e Validação

### Validação de Dados (NestJS DTOs)

```typescript
// src/sync/dto/push.dto.ts
import { IsString, IsArray, IsBoolean, IsInt, IsOptional, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceInfoDto {
  @ApiProperty()
  @IsString()
  device_name: string;

  @ApiProperty()
  @IsString()
  hostname: string;

  @ApiProperty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  arch: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  release?: string;
}

export class TimeEntryDto {
  @ApiProperty({ example: '2025-11-18T14:30:00.000Z' })
  @IsString()
  timestamp: string;

  @ApiProperty()
  @IsString()
  project: string;

  @ApiProperty()
  @IsString()
  file: string;

  @ApiProperty({ minimum: 1, maximum: 86400 })
  @IsInt()
  @Min(1)
  @Max(86400)
  duration_seconds: number;

  @ApiProperty({ default: false })
  @IsBoolean()
  is_idle: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  client_id?: string;
}

export class PushRequestDto {
  @ApiProperty()
  @IsUUID()
  user_key: string;

  @ApiProperty()
  @IsUUID()
  device_key: string;

  @ApiProperty({ type: DeviceInfoDto })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device_info: DeviceInfoDto;

  @ApiProperty({ type: [TimeEntryDto], maxItems: 500 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeEntryDto)
  entries: TimeEntryDto[];
}
```

### Middleware de Validação

NestJS usa **Pipes** para validação automática de DTOs:

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validação global automática
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Remove propriedades não definidas no DTO
      forbidNonWhitelisted: true, // Retorna erro se houver propriedades extras
      transform: true,            // Transforma payloads em instâncias de DTO
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

### Rate Limiting com @nestjs/throttler (Obrigatório)

**Proteção contra abuso de API e ataques DDoS**

```typescript
// app.module.ts
import { Module } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    // Rate Limiting Global
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,  // 60 segundos (janela de tempo)
        limit: 30,   // 30 requisições por janela
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 5,    // Endpoints sensíveis (signup, registro)
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Aplica globalmente
    },
  ],
})
export class AppModule {}
```

**Aplicar limite específico em endpoints sensíveis:**

```typescript
// auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    // Previne criação em massa de contas
  }
}

// sync.controller.ts
@Controller('sync')
export class SyncController {
  
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 push por minuto
  @Post('push')
  async push(@Body() dto: PushDto) {
    // Previne flood de sincronização
  }
}
```

**Dependência necessária:**
```bash
npm install --save @nestjs/throttler
```

---

## 🚀 Checklist de Implementação

### Fase 1: Setup Inicial (Dia 1)
- [ ] Criar projeto NestJS: `nest new mytimetrace-backend`
- [ ] Configurar Prisma: `npm install @prisma/client && npm install -D prisma`
- [ ] Configurar estrutura de módulos (auth, sync, entries, stats)
- [ ] Setup Docker Compose (PostgreSQL)
- [ ] Configurar ESLint + Prettier (padrão NestJS)
- [ ] Instalar dependências essenciais: `@nestjs/swagger`, `@nestjs/throttler`, `class-validator`

### Fase 2: Database & Models (Dia 2)
- [ ] Definir `prisma/schema.prisma` com 4 tabelas (users, devices, time_entries, sync_logs)
- [ ] Criar migrations: `npx prisma migrate dev --name init`
- [ ] Gerar Prisma Client: `npx prisma generate`
- [ ] Criar `PrismaModule` e `PrismaService` reutilizáveis
- [ ] Criar seed de dados para testes: `prisma/seed.ts`

### Fase 3: API Core (Dia 3-4)
- [ ] Criar módulo `AuthModule` com POST /auth/register
- [ ] Criar módulo `SyncModule` com POST /sync/push e tratar GET /sync/pull como legado
- [ ] Criar módulo `EntriesModule` com GET /entries
- [ ] Criar módulo `StatsModule` com GET /stats/summary
- [ ] Implementar DTOs com `class-validator` para validação automática
- [ ] Configurar Swagger com `@nestjs/swagger` e decorators `@ApiTags`, `@ApiOperation`

### Fase 4: Lógica de Sincronização (Dia 5)
- [ ] Implementar `SyncService.processPush()` com detecção de conflitos
- [ ] Implementar `SyncService.processPull()` com isolamento multi-tenant
- [ ] Lógica de mesclagem de registros duplicados
- [ ] Sistema de logs de sincronização (tabela `sync_logs`)
- [ ] Gestão de dispositivos: atualizar `last_seen` em cada sync

### Fase 5: Testes Unitários (Dia 6)
- [ ] Testes unitários com Jest: `*.service.spec.ts` para cada service (auth, sync, entries, stats)
- [ ] Mock completo do `PrismaService` com `jest.spyOn()`
- [ ] Testes de validação automática de DTOs com pipes
- [ ] Testes de cenários de conflito (duplicatas, mesclagem)
- [ ] Testes de isolamento multi-tenant (verificar queries com `user_id`)
- [ ] Testes de casos de erro (usuário não encontrado, device inválido)
- [ ] Cobertura de testes > 70%: `npm run test:cov`

### Fase 6: Documentação & Deploy (Dia 7)
- [ ] Configurar Swagger UI em `/api-docs` com `SwaggerModule.setup()`
- [ ] Documentar todos os endpoints com decorators `@ApiOperation`, `@ApiResponse`
- [ ] README completo com instruções de setup e uso
- [ ] Dockerfile multi-stage build otimizado para NestJS
- [ ] Docker Compose production-ready com healthchecks
- [ ] Scripts de deploy e CI/CD (opcional)

---

## 📦 Variáveis de Ambiente

### `.env.example`

```env
# Server
NODE_ENV=development
PORT=8989
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mytimetrace_db

# Prisma
DATABASE_PROVIDER=postgresql

# API
API_VERSION=v1
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Sync
MAX_ENTRIES_PER_PUSH=500
MAX_PULL_LIMIT=1000
DEFAULT_PULL_LIMIT=100
```

---

## 🎓 Melhores Práticas

### Código Limpo
- ✅ **Separação de responsabilidades**: Controllers, Services, Repositories
- ✅ **Tipagem forte**: TypeScript strict mode
- ✅ **Validação de entrada**: Zod/Joi em todos os endpoints
- ✅ **Error handling**: Middleware centralizado de erros
- ✅ **Logging estruturado**: Winston ou Pino

### Performance
- ✅ **Índices de banco**: Todos os campos de filtro indexados
- ✅ **Paginação**: Sempre limitar resultados
- ✅ **Connection pooling**: Configurar Prisma adequadamente
- ✅ **Cache**: Considerar Redis para estatísticas (opcional)

### Segurança
- ✅ **Validação rigorosa**: Todos os inputs validados
- ✅ **Rate limiting**: Prevenir abuso
- ✅ **SQL Injection**: Usar ORM/prepared statements
- ✅ **CORS**: Configurar apropriadamente
- ✅ **Helmet.js**: Headers de segurança HTTP

---

## 🔗 Integração com VS Code Extension

### Módulo de Sincronização (Cliente)

**Criar em:** `src/modules/syncManager.ts`

```typescript
import axios from 'axios';
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager, ActivityData } from './database';
import { getDeviceInfo } from './deviceInfo';

export class SyncManager {
  private apiBaseUrl: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private apiKey: string | null = null;
  private deviceKey: string;

  constructor(
    private context: vscode.ExtensionContext,
    private dbManager: DatabaseManager,
    apiUrl: string = 'http://localhost:8989/api/v1'
  ) {
    this.apiBaseUrl = apiUrl;
    this.apiKey = this.getApiKey();
    this.deviceKey = this.getOrCreateDeviceKey();
  }

  /**
   * Obtém API_KEY armazenada (se usuário já configurou)
   */
  private getApiKey(): string | null {
    const apiKey = this.context.globalState.get<string>('mytimetrace.apiKey');
    
    if (!apiKey) {
      console.log('⚠️ API_KEY não configurada. Solicite ao usuário.');
      return null;
    }
    
    console.log('✅ API_KEY encontrada');
    return apiKey;
  }

  /**
   * Configura API_KEY (chamado quando usuário cola a chave)
   */
  async setApiKey(apiKey: string): Promise<void> {
    // Validar formato
    if (!apiKey.startsWith('mtt_') || apiKey.length !== 36) {
      throw new Error('Invalid API key format. Must be: mtt_{32_characters}');
    }
    
    // Testar conexão com servidor
    try {
      await axios.post(
        `${this.apiBaseUrl}/sync/register`,
        {
          device_key: this.deviceKey,
          device_info: getDeviceInfo()
        },
        {
          headers: { 'X-API-Key': apiKey }
        }
      );
      
      // Salvar se bem-sucedido
      await this.context.globalState.update('mytimetrace.apiKey', apiKey);
      this.apiKey = apiKey;
      
      console.log('✅ API_KEY configurada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao validar API_KEY:', error);
      throw new Error('Invalid API key or server unreachable');
    }
  }

  /**
   * Obtém ou cria device_key (único por instalação/dispositivo)
   */
  private getOrCreateDeviceKey(): string {
    let deviceKey = this.context.globalState.get<string>('mytimetrace.deviceKey');
    
    if (!deviceKey) {
      deviceKey = uuidv4();
      this.context.globalState.update('mytimetrace.deviceKey', deviceKey);
      console.log('🆕 Novo device_key gerado:', deviceKey);
    } else {
      console.log('✅ device_key existente carregado:', deviceKey);
    }
    
    return deviceKey;
  }

  /**
   * Registra dispositivo no servidor (primeira execução com API_KEY)
   */
  async registerWithServer(): Promise<void> {
    if (!this.apiKey) {
      console.log('⚠️ API_KEY não configurada. Ignorando registro.');
      return;
    }
    
    try {
      const deviceInfo = getDeviceInfo();
      
      const response = await axios.post(
        `${this.apiBaseUrl}/sync/register`,
        {
          device_key: this.deviceKey,
          device_info: {
            device_name: deviceInfo.hostname,
            hostname: deviceInfo.hostname,
            platform: deviceInfo.platform,
            arch: deviceInfo.arch,
            type: deviceInfo.type,
            release: deviceInfo.release
          }
        },
        {
          headers: { 'X-API-Key': this.apiKey }
        }
      );

      if (response.data.success) {
        console.log('✅ Dispositivo registrado no servidor:', response.data.message);
      }
    } catch (error) {
      console.error('❌ Erro ao registrar no servidor:', error);
      throw error;
    }
  }

  /**
   * Inicia sincronização automática
   */
  startAutoSync(intervalMinutes: number = 15) {
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Para sincronização automática
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Executa sincronização completa (push + pull)
   */
  async performSync(): Promise<void> {
    try {
      // 1. Push: Enviar dados não sincronizados
      await this.pushUnsyncedEntries();

      // 2. Pull: Baixar dados de outros dispositivos
      await this.pullRemoteEntries();

      console.log('✅ Sincronização completa realizada com sucesso');
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      throw error;
    }
  }

  /**
   * Envia registros não sincronizados para o servidor
   */
  private async pushUnsyncedEntries(): Promise<void> {
    if (!this.apiKey) {
      console.log('⚠️ API_KEY não configurada. Sincronização ignorada.');
      return;
    }
    
    // Buscar registros com synced = 0
    const unsyncedEntries = await this.dbManager.query(
      'SELECT * FROM time_entries WHERE synced = 0 ORDER BY timestamp ASC LIMIT 500'
    );

    if (unsyncedEntries.length === 0) {
      console.log('📭 Nenhum registro para sincronizar');
      return;
    }

    const deviceInfo = getDeviceInfo();
    
    const payload = {
      device_key: this.deviceKey,
      device_info: {
        device_name: deviceInfo.hostname,
        hostname: deviceInfo.hostname,
        platform: deviceInfo.platform,
        arch: deviceInfo.arch,
        type: deviceInfo.type,
        release: deviceInfo.release
      },
      entries: unsyncedEntries.map(entry => ({
        timestamp: entry.timestamp,
        project: entry.project,
        file: entry.file,
        duration_seconds: entry.duration_seconds,
        is_idle: entry.is_idle === 1,
        client_id: entry.id // ID local como referência
      }))
    };

    const response = await axios.post(
      `${this.apiBaseUrl}/sync/push`,
      payload,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );

    if (response.data.success) {
      // Marcar registros como sincronizados
      const syncedIds = unsyncedEntries.map(e => e.id);
      await this.dbManager.query(
        `UPDATE time_entries SET synced = 1 WHERE id IN (${syncedIds.join(',')})`
      );

      console.log(`📤 ${response.data.synced_count} registros enviados ao servidor`);
    }
  }

  /**
   * Baixa registros de outros dispositivos do mesmo usuário
   */
  private async pullRemoteEntries(): Promise<void> {
    if (!this.apiKey) {
      console.log('⚠️ API_KEY não configurada. Sincronização ignorada.');
      return;
    }
    
    // Buscar último timestamp sincronizado
    const lastSyncResult = await this.dbManager.query(
      'SELECT MAX(timestamp) as last_sync FROM time_entries WHERE synced = 1'
    );

    const since = lastSyncResult[0]?.last_sync || new Date(0).toISOString();

    const response = await axios.get(
      `${this.apiBaseUrl}/sync/pull`,
      {
        params: {
          device_key: this.deviceKey,
          since: since,
          limit: 500
        },
        headers: { 'X-API-Key': this.apiKey }
      }
    );

    if (response.data.success && response.data.entries.length > 0) {
      // Inserir registros de outros dispositivos
      for (const entry of response.data.entries) {
        await this.dbManager.saveActivityData({
          timestamp: entry.timestamp,
          project: entry.project,
          file: entry.file,
          duration: entry.duration_seconds,
          isIdle: entry.is_idle,
          device_name: entry.device_name
        });

        // Marcar como já sincronizado (veio do servidor)
        await this.dbManager.query(
          'UPDATE time_entries SET synced = 1 WHERE timestamp = ? AND device_name = ?',
          [entry.timestamp, entry.device_name]
        );
      }

      console.log(`📥 ${response.data.entries.length} registros baixados do servidor`);
    }
  }
}
```

### Configuração na Extension

**Adicionar em:** `extension.ts`

```typescript
import { SyncManager } from './modules/syncManager';

export async function activate(context: vscode.ExtensionContext) {
  // ... código existente ...

  // Inicializar SyncManager com context
  const syncManager = new SyncManager(context, dbManager);

  // Comando para configurar API_KEY (primeira vez)
  const setApiKeyCommand = vscode.commands.registerCommand(
    'my-time-trace-vscode.setApiKey',
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Cole sua API Key do MyTimeTrace',
        placeHolder: 'mtt_1a2b3c4d5e6f7g8h9i0j',
        password: true,
        validateInput: (value) => {
          if (!value.startsWith('mtt_') || value.length !== 36) {
            return 'API Key inválida. Formato esperado: mtt_{32_caracteres}';
          }
          return null;
        }
      });

      if (input) {
        try {
          await syncManager.setApiKey(input);
          vscode.window.showInformationMessage('✅ API Key configurada com sucesso!');
          await syncManager.performSync();
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Erro: ${error}`);
        }
      }
    }
  );

  // Registrar dispositivo no servidor (após configurar API_KEY)
  try {
    await syncManager.registerWithServer();
  } catch (error) {
    console.warn('⚠️ Erro ao registrar no servidor (modo offline):', error);
  }

  // Comando manual de sincronização
  const syncCommand = vscode.commands.registerCommand(
    'my-time-trace-vscode.syncNow',
    async () => {
      try {
        await syncManager.performSync();
        vscode.window.showInformationMessage('✅ Sincronização concluída!');
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Erro na sincronização: ${error}`);
      }
    }
  );

  context.subscriptions.push(setApiKeyCommand, syncCommand);

  // Auto-sync a cada 15 minutos
  syncManager.startAutoSync(15);

  // Cleanup ao desativar
  context.subscriptions.push({
    dispose: () => syncManager.stopAutoSync()
  });
}
```

---

## 📚 Recursos Adicionais

### Bibliotecas Recomendadas (NestJS + Prisma)

```json
{
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.1.17",
    "@nestjs/throttler": "^5.1.1",
    "@prisma/client": "^5.7.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "helmet": "^7.1.0",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "prisma": "^5.7.0",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2"
  }
}
```

### Scripts Úteis (NestJS)

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
  }
}
```

---

## ✅ Critérios de Aceite

### Funcionalidades Mínimas (MVP)
- ✅ API REST com 5 endpoints principais funcionando
- ✅ Persistência em PostgreSQL com Prisma
- ✅ Sincronização push-first (pull apenas como legado)
- ✅ Detecção de conflitos por timestamp
- ✅ Validação automática de dados com class-validator
- ✅ Testes unitários cobrindo todos os services
- ✅ Documentação Swagger acessível
- ✅ Docker Compose funcional

### Qualidade
- ✅ Cobertura de testes unitários > 70%
- ✅ Zero erros de linting
- ✅ TypeScript strict mode sem erros
- ✅ Logs estruturados em todos os services
- ✅ README completo com instruções de setup

### Performance
- ✅ Resposta < 200ms para push de 100 registros
- ✅ Resposta < 100ms para pull de 500 registros
- ✅ Suporte a paginação em todos os endpoints de listagem

---

## 🎯 Entregáveis Finais

1. **Código Fonte** no GitHub
2. **README.md** com setup completo
3. **API Documentation** (Swagger UI)
4. **Docker Images** (Dockerfile + docker-compose.yml)
5. **Collection Postman/Insomnia** para testes
6. **Relatório de Testes** (coverage report)
7. **Guia de Deployment** (produção)

---

## 📞 Suporte e Próximos Passos

### Após MVP
- Implementar autenticação JWT
- Adicionar WebSocket para sync em tempo real
- Dashboard web para visualização de estatísticas
- Integração com outras ferramentas (Trello, Jira, etc.)
- Backup automático S3/cloud

---

**Versão:** 1.0.0  
**Data:** 18 de novembro de 2025  
**Autor:** Belicio Cardoso
**Projeto:** MyTimeTrace VSCode Extension - Backend Sync API
