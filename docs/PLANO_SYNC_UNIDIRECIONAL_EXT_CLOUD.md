# Plano Técnico - Sync Unidirecional (Ext -> Cloud)

Data: 21 de abril de 2026  
Status: Fases 1 a 5 concluídas ✅

## Objetivo

Trocar o modelo de sync de bidirecional para unidirecional:

- A extensão envia dados locais para cloud.
- A extensão não baixa mais dados da cloud.
- O backend passa a tratar push como fluxo oficial único.

---

## Fase 1 - Regra de negócio (remoção definitiva do pull)

### Decisão

O pull será removido de forma definitiva do fluxo da extensão.

### Motivo

- O vínculo por device pode mudar com formatação/troca de máquina.
- O pull atual traz risco de inconsistência e duplicação.
- O caso de uso principal é backup/centralização dos dados locais.

### Como documentar a remoção

Manter no material técnico apenas uma nota histórica:

- pull removido na versão X.Y.Z;
- motivo: simplificação do fluxo e redução de falha;
- novo contrato oficial: somente upload (ext -> cloud).

### Critério de aceite

- Não existe mais chamada de pull em runtime da extensão.
- Não existe dependência funcional de `last_pull_timestamp`.

---

## Fase 2 - Extensão VS Code

### Status

✅ **Completa** - 21 de abril de 2026

### Escopo

- Remover chamada de `pullEntries()` no fluxo principal.
- Manter `pushEntries()` com retry, batch e marcação `synced=1`.
- Ajustar UI/textos para "envio" em vez de "sincronização bidirecional".

### Itens técnicos

1. `SyncManager.performSync()`:
- manter apenas loop de push.
- remover lógica de `since` e pós-pull.

2. Comandos/status:
- manter `syncNow` e status de envio.
- remover qualquer texto que sugira download da cloud.

3. Banco local:
- manter `synced` como controle local de envio.
- remover dependência de metadado de pull no código ativo.

### Critério de aceite

- Sync executa somente envio.
- Nenhum log mostra etapa de pull.

### Entregas já iniciadas

- `SyncManager.performSync()` sem chamada de pull.
- Textos de UI migrados para "envio".
- Testes ajustados para o novo fluxo.

---

## Fase 3 - Backend (detalhado)

### Status

Concluída em paralelo.

> Esta fase será usada no repositório backend.

### 3.1 Contrato de API alvo

Fluxo suportado para extensão:

1. `POST /api/sync/register`
2. `GET /api/sync/config` (opcional)
3. `POST /api/sync/push`
4. `GET /api/sync/status` (opcional)

`GET /api/sync/pull` sai do fluxo oficial.

### 3.2 Regras de segurança

- Validar `x-api-key` (já existe).
- Validar `deviceKey` do payload no escopo do `userId` da chave.
- Rejeitar push se o device não for do usuário (`DEVICE_NOT_REGISTERED`).

### 3.3 Deduplicação simples por chave única de dados

Adotar chave única em `TimeEntry`:

`(deviceId, startedAt, fileName, projectName, duration)`

Racional:

- simples de manter;
- sem adicionar `clientId` em `TimeEntry`;
- bloqueia duplicação por retry/reenvio do mesmo lote do mesmo device.

### 3.4 Mudança na escrita do push

No endpoint push:

- manter parse e validação atuais;
- trocar persistência para operação com skip de duplicadas;
- em Prisma, usar `createMany({ data, skipDuplicates: true })`.

Resultado esperado:

- primeira ingestão grava;
- reenvio idêntico não cria nova linha;
- response retorna `pushedCount` real das novas linhas.

### 3.5 Pull desativado

Opções válidas (escolher uma):

1. manter rota e retornar `410 GONE` com código `PULL_REMOVED`;
2. remover rota e atualizar docs/cliente.

Recomendado: opção 1 por uma versão, depois remoção total.

### 3.6 Observabilidade

Adicionar log estruturado no push:

- `receivedCount`
- `insertedCount`
- `skippedCount` (estimado: received - inserted)
- `deviceId`

### 3.7 Critérios de aceite backend

- Reenvio do mesmo payload não duplica linhas.
- Push com `deviceKey` inválido retorna erro de negócio.
- Pull não é mais usado pela extensão e está marcado como removido.

---

## Fase 4 - Migração de dados

### Status

✅ **Concluída** - 21 de abril de 2026

### Passos

1. Mapear duplicadas antigas por chave alvo.
2. Remover duplicadas mantendo a mais antiga (ou menor `createdAt`).
3. Criar índice único da chave composta.

### Ordem recomendada

1. limpeza de dados;
2. criação do índice;
3. deploy da versão do push com skip de duplicadas.

### Critério de aceite

- Índice único criado com sucesso.
- Nenhuma violação de chave após deploy.

---

## Fase 5 - Testes

### Status

✅ **Concluída** - 21 de abril de 2026

### Extensão

- Sync envia sem chamar pull.
- Retry de push não duplica no destino.
- `synced=1` apenas após sucesso do push.

### Backend

- Push novo grava N linhas.
- Push repetido do mesmo lote grava 0 novas.
- `deviceKey` fora do usuário falha.
- Lote grande respeita limite/config.

### E2E

- Fluxo register -> push -> status.
- Sem qualquer chamada de pull no cliente.

---

## Fase 6 - Documentação

### Status

🟡 **Em andamento** - 21 de abril de 2026 (concluída neste repositório)

### Atualizar

- README da extensão.
- docs de sync da extensão.
- docs de API/backend (`pull` como removido/deprecado).
- changelog dos dois repositórios.

### Nota obrigatória

"A partir da versão X.Y.Z, o sync da extensão é unidirecional (ext -> cloud)."

---

## Riscos e mitigação

1. Colisão rara na chave composta:
- mitigação: monitorar conflitos e revisar chave se necessário.

2. Cliente antigo ainda chamando pull:
- mitigação: retornar `410 PULL_REMOVED` por período de transição.

3. Dados já duplicados no histórico:
- mitigação: executar limpeza antes do índice único.

---

## Check-list de execução

- [x] Fase 1 publicada
- [x] Fase 2 implementada e documentação limpa
- [x] Fase 3 implementada no backend
- [x] Fase 4 migração de dados
- [x] Fase 5 validada em QA
- [x] Fase 6 documentada e versionada (extensão)
