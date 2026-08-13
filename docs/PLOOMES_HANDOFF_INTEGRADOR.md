# Integração Ploomes → OpenBoard: guia de consumo

Quando um negócio é ganho no Ploomes, um POST cria no OpenBoard o cliente, o
projeto, a equipe e as notificações — de uma vez, sem duplicar em reenvio.

Base: `https://crm.opensuite.com.br`

## O que você recebe fora deste documento

| Item | Como chega |
|---|---|
| `INTEGRATION_TOKEN` | Por canal seguro, separado. Nunca em e-mail, ticket ou repositório. |

## Autenticação

Toda requisição:

```http
Authorization: Bearer <INTEGRATION_TOKEN>
```

Só HTTPS. Cinco tokens inválidos vindos do mesmo IP em 15 minutos bloqueiam
esse IP por 15 minutos (`429`) — não faça retry em cima de erro `401`.

## Passo 1: descubra os IDs

Categoria e responsáveis são escolhidos por **ID do OpenBoard**, não por nome.
Consulte antes de enviar; a lista muda quando administramos o cadastro.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://crm.opensuite.com.br/api/v1/integrations/options/project-categories
```

```json
{ "categories": [{ "id": "legacy-category-1f5b…", "name": "OpenSuite" }] }
```

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://crm.opensuite.com.br/api/v1/integrations/options/users
```

```json
{ "users": [{ "id": "cmpx…", "name": "Fulano", "email": "…", "jobTitle": "Dev" }] }
```

Só vêm registros ativos. Usuário desativado no OpenBoard some da lista e passa a
ser recusado no POST — vale reconsultar de tempos em tempos, não cachear pra
sempre.

## Passo 2: crie o projeto

```http
POST /api/v1/integrations/ploomes/projects
Authorization: Bearer <INTEGRATION_TOKEN>
Content-Type: application/json
Idempotency-Key: <chave única por evento>
```

```json
{
  "eventId": "ploomes-deal-503604730-won",
  "source": "ploomes",
  "ploomes": {
    "dealId": 503604730,
    "contactId": 503992654,
    "pipelineId": 50008796,
    "dealTitle": "Lead WhatsApp — Empresa Exemplo"
  },
  "client": {
    "externalId": "ploomes-contact-503992654",
    "name": "Empresa Exemplo",
    "email": "contato@empresa.com",
    "phone": "5511999999999",
    "document": "12345678000199"
  },
  "project": {
    "name": "Implantação — Empresa Exemplo",
    "categoryId": "<id vindo do passo 1>",
    "status": "planejado",
    "startDate": null,
    "dueDate": null,
    "teamUserIds": ["<id de usuário>"]
  },
  "notifications": {
    "userIds": ["<id de usuário>"],
    "title": "Novo projeto vendido",
    "message": "O projeto foi criado a partir do negócio ganho no Ploomes."
  }
}
```

### Campos que exigem atenção

| Campo | Regra |
|---|---|
| `eventId` | Único por evento de negócio. É a identidade do envio. |
| `Idempotency-Key` | Única por evento. Repetir a mesma chave = reenvio; usar a mesma chave para outro `eventId` = `409`. |
| `ploomes.dealId` | Único por negócio. Um segundo evento para o mesmo negócio é recusado com `409`. |
| `project.status` | Só aceita `"planejado"`. |
| `startDate` / `dueDate` | `"AAAA-MM-DD"` ou `null`. Sem data é normal — o projeto entra sem prazo. |
| `client.document` | CPF ou CNPJ, com ou sem máscara. Usado para reconhecer cliente já cadastrado. |
| `teamUserIds` / `notifications.userIds` | IDs vindos do passo 1. Um id desconhecido ou inativo derruba o envio inteiro com `404`. |

## Respostas

Criado — `201`:

```json
{
  "created": true,
  "client": { "id": "…", "name": "Empresa Exemplo" },
  "project": { "id": "…", "name": "Implantação — Empresa Exemplo", "status": "planejado" },
  "notificationsCreated": 2
}
```

Reenvio da mesma chave — `200`:

```json
{
  "created": false,
  "idempotent": true,
  "client": { "id": "…", "name": "Empresa Exemplo" },
  "project": { "id": "…", "name": "Implantação — Empresa Exemplo", "status": "planejado" },
  "notificationsCreated": 0
}
```

`notificationsCreated` conta o que **aquela** chamada criou; por isso reenvio
devolve `0`. O `status` reflete o estado atual do projeto: um reenvio feito dias
depois pode devolver `"em andamento"` ou `"concluído"`.

## Erros

| Código | `error` | O que fazer |
|---|---|---|
| `400` | `invalid_payload`, `invalid_json`, `invalid_content_type`, `idempotency_key_required` | Corrigir o envio. Retry não resolve. |
| `401` | `unauthorized` | Token errado ou ausente. **Não** faça retry — conta pro bloqueio por IP. |
| `403` | `https_required` | Chamada saiu sem HTTPS. |
| `404` | `category_not_found`, `user_not_found` | ID inexistente ou desativado. Reconsulte o passo 1. |
| `409` | `external_deal_conflict` | Esse `dealId` já virou projeto. Não reenvie. |
| `409` | `idempotency_conflict` | A mesma `Idempotency-Key` foi usada para outro `eventId`. Erro de geração de chave. |
| `409` | `client_match_conflict`, `client_external_conflict` | O cliente casa com mais de um cadastro, ou já está ligado a outro `externalId`. Fale com a gente. |
| `429` | `too_many_requests` | IP bloqueado por falhas de token. Espere 15 min. |
| `500` | — | Falha nossa. Retry com espera crescente é seguro: mande a **mesma** `Idempotency-Key`. |

## Como reenviar com segurança

Guarde a `Idempotency-Key` junto do negócio. Em timeout ou `500`, reenvie **a
mesma chave** — se o projeto já tiver sido criado, a resposta é `200` com os
mesmos IDs e nenhuma notificação repetida. Gerar chave nova para o mesmo negócio
resulta em `409`, não em duplicata: nos dois caminhos o projeto nunca duplica.

Não faça retry em `400`, `401`, `403`, `404` ou `409` — nenhum deles muda de
resultado com repetição.

## Teste antes de ligar em produção

1. `GET` das duas listas de opções — confirma token e conectividade.
2. `POST` de um negócio de teste; guarde o `project.id` da resposta.
3. Repita o mesmo `POST`, mesma chave — tem que vir `200`, `created: false`.
4. Avise pra gente conferir e apagar o projeto de teste.

## Como identificar o cliente

Reconhecemos cliente já cadastrado por `externalId`, depois por documento e
e-mail normalizados. Mande `document` sempre que tiver: é o que evita o mesmo
cliente entrar duas vezes.

## Contato

Dúvida ou erro `409` de cliente: fale com a equipe do OpenBoard antes de tentar
contornar pelo payload.
