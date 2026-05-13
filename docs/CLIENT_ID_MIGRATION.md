# Migração de `client_id` Legado — Análise e Proposta

## Contexto

Durante o desenvolvimento inicial da extensão, o `client_id` das `time_entries` era gerado pela migration do banco de dados com o padrão numérico:

```sql
UPDATE time_entries SET client_id = ('local-' || id) WHERE client_id IS NULL
```

Resultado: `local-1`, `local-2`, `local-16`, etc.

Com a evolução do projeto, o padrão foi atualizado para usar UUID v4:

```typescript
// database.ts:203
const clientId = `local-${randomUUID()}`;
```

Resultado: `local-bdeb9434-77dc-40e4-b8e3-316c97f48587`

## Problema

O servidor de produção usa o `client_id` como **chave de deduplicação** no endpoint `POST /api/sync/push`. Entradas com o padrão legado (`local-N`) não são reconhecidas corretamente, impedindo a sincronização dessas entradas antigas.

## Solução Proposta

Criar uma rotina de migração automática que é executada no **startup da extensão**, detectando entradas com `client_id` no padrão legado e atualizando para o padrão UUID.

### Critério de detecção do padrão legado

O padrão UUID tem exatamente 4 hífens no segmento após `local-`:

- **Legado:** `local-16` → apenas dígitos
- **Atual:** `local-bdeb9434-77dc-40e4-b8e3-316c97f48587` → UUID com 4 hífens

Condição SQL para identificar entradas legadas:

```sql
WHERE client_id LIKE 'local-%'
  AND client_id NOT LIKE 'local-________-____-____-____-____________'
```

### Fluxo da migração

```
Startup da Extensão
  └─ Executar rotina de migração de client_id
       └─ Buscar entradas com client_id no padrão legado
            └─ Para cada entrada:
                 └─ Gerar novo UUID: `local-<randomUUID()>`
                 └─ UPDATE time_entries SET client_id = 'local-<uuid>'
                      WHERE id = <entry.id>
  └─ Sincronização normal
```

### Restrições de segurança

| Restrição | Motivo |
|-----------|--------|
| Rodar apenas em entradas com `synced = 0` | Evitar duplicação no servidor para entradas já sincronizadas |
| Idempotência | A condição de detecção garante que a rotina não afeta entradas já migradas |
| Unicidade | A coluna `client_id` tem `UNIQUE constraint` — cada novo UUID gerado é verificado antes do insert |

> **Ponto em aberto:** Se alguma entrada com padrão legado já foi sincronizada com sucesso (`synced = 1`), alterar o `client_id` local fará o servidor interpretá-la como uma entrada nova na próxima sincronização, **duplicando o dado**. É necessário confirmar se entradas `local-N` chegaram a ser sincronizadas antes de decidir se a migração deve incluir `synced = 1`.

## Localização sugerida para implementação

| Arquivo | Responsabilidade |
|---------|-----------------|
| [src/modules/database.ts](../src/modules/database.ts) | Adicionar método `migrateLegacyClientIds()` |
| [src/extension.ts](../src/extension.ts) | Chamar a migração no bloco de inicialização, antes do `SyncManager` |

### Assinatura sugerida

```typescript
// database.ts
public async migrateLegacyClientIds(): Promise<number> {
  // Retorna a quantidade de entradas migradas
}
```

## Padrão de detecção — referência rápida

| Padrão | Exemplo | Legado? |
|--------|---------|---------|
| `local-<número>` | `local-16` | ✅ Sim |
| `local-<uuid>` | `local-bdeb9434-77dc-40e4-b8e3-316c97f48587` | ❌ Não |

## Status

- [ ] Confirmar se entradas `local-N` com `synced = 1` existem no servidor
- [ ] Definir escopo da migração (`synced = 0` apenas ou todos)
- [ ] Implementar `migrateLegacyClientIds()` em `database.ts`
- [ ] Integrar chamada no startup em `extension.ts`
- [ ] Testar idempotência (executar duas vezes sem efeito colateral)
