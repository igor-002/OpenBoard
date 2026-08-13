# Integração Ploomes: criação de projetos

## Objetivo

Receber negócio ganho do Ploomes, criar/localizar cliente, criar projeto,
incluir equipe e notificar usuários sem duplicação em reenvios.

## Status

| Item | Estado |
|---|---|
| Alertas de demandas | Concluído |
| Modelos e migration | Concluído |
| POST Ploomes | Concluído |
| GET categorias/usuários | Concluído |
| Autenticação, HTTPS e rate limit | Concluído |
| Administração de usuários e categorias | Concluído |
| Testes (11) | Concluídos |
| Documentação de consumo | Concluída |
| Deploy na VPS | **Pendente** |

Revisão de 2026-08-12 fechou 11 correções sobre a primeira entrega; o que mudou
está em "Mudanças no modelo que afetam o resto do app".

## Feito

- Modal de demanda abre na hora pelo evento SSE `demanda_atribuida`; o fetch
  em `/api/acknowledgements/pending` ficou só como rede de segurança (60s).
- Novas pendências entram na fila, uma por vez, até cada confirmação.
- Migration `20260812163000_ploomes_projects_api` preserva `Project.client` e `tag`.
- Tags existentes viraram `ProjectCategory`; projetos antigos foram vinculados.
- Novo `ProjectClient` deduplica `externalId`, documento normalizado e e-mail
  normalizado — **por workspace**, nunca entre workspaces.
- Novo `IntegrationEvent` protege `eventId` e `Idempotency-Key`.
- Projeto guarda `source = ploomes` e `externalDealId` único por origem.
- POST e notificações executam em transação serializável; o toast em tempo real
  sai depois do commit.
- Token é Bearer server-only, comparado em tempo constante; produção exige HTTPS;
  5 falhas de token por IP bloqueiam o IP por 15 min (`429`).

## Mudanças no modelo que afetam o resto do app

- **`Project.startDate` virou opcional.** Projeto criado pela API nasce sem data
  de início. O cronograma (`/timeline`) e o detalhe do projeto caem em
  `createdAt` quando ela falta, e o formulário de projeto não exige mais o campo.
  Qualquer consulta nova sobre `Project` precisa tolerar `startDate` nulo.
- **`User.active` é novo.** Admin liga/desliga em `/settings/users`. Usuário
  desativado não faz login, perde a sessão na requisição seguinte e some dos
  seletores de responsável e equipe — o histórico fica intacto.
- **`ProjectCategory` é a fonte única de categorias.** Administre em
  `/settings/categorias` (criar, renomear, ativar/desativar). `Project.tag`
  segue preenchido, mas só como texto histórico do projeto.

## Rotas criadas

- `POST /api/v1/integrations/ploomes/projects`
- `GET /api/v1/integrations/options/project-categories`
- `GET /api/v1/integrations/options/users`
- `GET /api/acknowledgements/pending`

Todas elas precisam estar em `PUBLIC_PAGES` no `src/proxy.ts`. Chamada de
sistema não tem cookie de sessão: sem o prefixo `/api/v1/integrations` na lista,
o proxy responde `307` para `/login` e o consumidor nunca chega no handler. Os
testes chamam o handler direto e **não** cobrem isso — só um `curl` contra o
servidor pega.

## Configuração

Defina no `.env.production` da VPS:

```bash
INTEGRATION_TOKEN="$(openssl rand -hex 32)"
INTEGRATION_WORKSPACE_ID="id-do-workspace"
```

`INTEGRATION_WORKSPACE_ID` é obrigatório. Não existe fallback para primeiro
workspace. Consulte o ID pelo Prisma Studio ou PostgreSQL antes do deploy.
Após alterar variáveis, recrie o container da aplicação.

## Autenticação e transporte

Todas as rotas exigem:

```http
Authorization: Bearer <INTEGRATION_TOKEN>
```

Em produção, requisições sem HTTPS retornam `403`. O nginx deve continuar
sobrescrevendo `X-Forwarded-Proto`, como já faz no arquivo de deploy.

Cinco tokens inválidos vindos do mesmo IP dentro de 15 min bloqueiam esse IP por
15 min: as rotas passam a responder `429 too_many_requests`. Um token correto
zera a contagem na hora.

## POST `/api/v1/integrations/ploomes/projects`

Headers obrigatórios:

```http
Authorization: Bearer <INTEGRATION_TOKEN>
Content-Type: application/json
Idempotency-Key: <chave-unica-por-evento>
```

Payload:

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
    "categoryId": "ID_DA_CATEGORIA_NO_OPENBOARD",
    "status": "planejado",
    "startDate": null,
    "dueDate": null,
    "teamUserIds": ["user-1", "user-2"]
  },
  "notifications": {
    "userIds": ["user-1", "user-3"],
    "title": "Novo projeto vendido",
    "message": "O projeto foi criado a partir do negócio ganho no Ploomes."
  }
}
```

Resposta nova (`201`):

```json
{
  "created": true,
  "client": { "id": "...", "name": "Empresa Exemplo" },
  "project": { "id": "...", "name": "Implantação — Empresa Exemplo", "status": "planejado" },
  "notificationsCreated": 2
}
```

Reenvio (`200`):

```json
{
  "created": false,
  "idempotent": true,
  "client": { "id": "...", "name": "Empresa Exemplo" },
  "project": { "id": "...", "name": "Implantação — Empresa Exemplo", "status": "planejado" },
  "notificationsCreated": 0
}
```

`status` só aceita o literal `"planejado"` — o projeto nasce como `planned`. Na
resposta, `status` é o estado atual do projeto: um reenvio feito depois de o
projeto ter andado devolve `"em andamento"`, `"em revisão"` ou `"concluído"`.
`notificationsCreated` conta o que **esta** chamada criou, então reenvio devolve
`0`; o total histórico fica em `IntegrationEvent.notificationsCreated`.

Erros: `400` payload/chave inválidos, `401` token inválido, `403` sem HTTPS em
produção, `404` categoria/usuário ausente ou inativo, `409` conflito de evento,
cliente ou negócio externo, `429` IP bloqueado por falhas de token e `500` falha
inesperada sem detalhes internos.

## GETs de opções

- `GET /api/v1/integrations/options/project-categories` retorna `{ "categories": [{ "id", "name" }] }`.
- `GET /api/v1/integrations/options/users` retorna `{ "users": [{ "id", "name", "email", "jobTitle" }] }`.

Ambos usam mesma autenticação, workspace configurado e retornam apenas registros
ativos — categorias ligadas em `/settings/categorias` e usuários ligados em
`/settings/users`. Use os IDs retornados no POST.

## Idempotência

`eventId` e `Idempotency-Key` ficam persistidos. Reenvio retorna projeto já
criado sem repetir cliente, membros ou notificações. `source + externalDealId`
é único: outro evento tentando criar o mesmo negócio retorna `409`. Reaproveitar
uma `Idempotency-Key` para outro `eventId` também é `409` — é sinal de chave
gerada errado, não de reenvio.

## Testes

```bash
npm run test:integration
```

Precisa de `DATABASE_URL` apontando para um Postgres de desenvolvimento: o teste
cria o próprio workspace e o apaga no fim.

Cobertura (11 testes): token inválido, criação, replay idempotente, cliente
existente por documento/e-mail, equipe inválida, usuário inativo na equipe,
negócio duplicado (`external_deal_conflict`), chave reaproveitada
(`idempotency_conflict`), HTTP recusado em produção, HTTPS via
`X-Forwarded-Proto` aceito e filtro de opções ativas.
