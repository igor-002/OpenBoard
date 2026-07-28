# GLPI REST API **v1** (`apirest.php`) — referência de trabalho

> Instância: `https://chamados.openitcorp.com.br`
> Doc oficial da instância: `https://chamados.openitcorp.com.br/api.php/v1/`
> Complementa `glpi-api-v2-integracao.md` (V2.1 High-Level, OAuth2 — a que o app usa hoje).

## Por que a v1 entrou na conversa

A V2.1 declara `status.id` como **`readOnly: true`** no OpenAPI. Na prática o
`PATCH /Assistance/Ticket/{id}` com `status` responde **`200 OK` e não muda nada**
— verificado em 2026-07-28 com 5 formatos de payload × 5 status de destino.

Não é permissão: no MESMO PATCH o campo `urgency` muda e reverte normalmente, e
pela tela do GLPI o próprio usuário `integracaomkt` consegue trocar o status.
É restrição de campo da V2.1.

O que a V2.1 **consegue** fazer (testado, funcionando):

| Ação | Resultado no status |
|---|---|
| `DELETE /Ticket/{id}/TeamMember` (role `assigned`) | vira **1** Novo |
| `POST /Ticket/{id}/TeamMember` (role `assigned`) | vira **2** Em atendimento |
| `POST /Ticket/{id}/Timeline/Solution` | vira **5** Solucionado |

Faltam **4 Pendente** e **6 Fechado** — sem mecanismo nativo conhecido na V2.1.
É esse buraco que a v1 pode fechar, via `PUT /Ticket/{id}` com `input.status`.

> ⚠️ Hipótese ainda **NÃO validada**: sem o App-Token não dá pra testar. Existe
> chance real de a v1 também recusar 1 e 2, porque no núcleo do GLPI esses dois são
> **derivados da atribuição**, não campo livre. Testar antes de desenhar em cima.

---

## 1. Autenticação — DOIS tokens

Diferente da V2.1 (Bearer OAuth2), aqui são dois headers:

| Token | De onde vem | Obrigatório? |
|---|---|---|
| **App-Token** | `Configurar > Geral > aba API` → cliente de API | **Sim nesta instância** |
| **Session-Token** | resposta do `initSession` | Sim, em toda chamada |

Nesta instância o App-Token é exigido — confirmado: `initSession` sem ele devolve
`400 ERROR_APP_TOKEN_PARAMETERS_MISSING`, em `/api.php/v1/`, `/apirest.php/` e com
ou sem Basic auth.

### Abrir sessão

```http
GET /apirest.php/initSession
Content-Type: application/json
App-Token: <app_token>
Authorization: Basic base64(login:senha)
```

Alternativa ao usuário/senha — **Remote access key** do usuário
(`Preferências > Acesso remoto`):

```http
Authorization: user_token q56hqkniwot8wntb3z1qarka5atf365taaa2uyjrn
```

Resposta: `200 { "session_token": "83af7e..." }`
Query opcional: `?get_full_session=true`.

Se a instância proibir login por credenciais, vem
`ERROR_LOGIN_WITH_CREDENTIALS_DISABLED` → usar `user_token`.

### Fechar sessão

```http
GET /apirest.php/killSession
Session-Token: <session>
App-Token: <app_token>
```

### 🔴 Sessão é READ-ONLY por padrão

**A pegadinha que mais importa pra nós.** Por padrão a sessão da v1 é somente
leitura; só `initSession`, `killSession`, `changeActiveEntities` e
`changeActiveProfile` escrevem. Pra gravar (nosso caso: `status`) é preciso passar:

```
session_write=true
```

Sem isso o update provavelmente falha ou não aplica — e falhar em silêncio é
exatamente o modo de falha que já nos custou tempo na V2.1.

Contrapartida: em modo escrita **a sessão fica travada** — o cliente precisa
esperar uma chamada terminar antes da próxima. Em modo leitura dá pra paralelizar.
Ou seja: abrir sessão de escrita só quando for escrever, e matar logo depois.

---

## 2. Filtros de acesso (Configuração > Geral > API)

- **IPv4 range** — precisa liberar o IP da VPS, senão `ERROR_NOT_ALLOWED_IP`
- **IPv6**
- **App-Token** — se preenchido no cliente, vira obrigatório em todas as chamadas

Session e App tokens também aceitam ir por **query string** em vez de header.

---

## 3. Endpoints que interessam

### Ler um item

```http
GET /apirest.php/Ticket/36220?expand_dropdowns=true
Session-Token: <session>
App-Token: <app_token>
```

`GET precisa ter body VAZIO` — parâmetro tem que ir na URL, senão `400`.

Query úteis: `expand_dropdowns` (nome em vez de id), `get_hateoas`, `with_logs`,
`add_keys_names`.

### Listar

```http
GET /apirest.php/Ticket/?range=0-49&sort=1&order=DESC
```

Paginação por `range=inicio-fim` (default `0-49`) — **note que é diferente da
V2.1**, onde `range` é ignorado e a paginação é `start`/`limit`. Devolve `206` +
header `Content-Range: offset-limit/count`.

### 🎯 Atualizar (o que a gente quer)

```http
PUT /apirest.php/Ticket/36220
Content-Type: application/json
Session-Token: <session>
App-Token: <app_token>

{ "input": { "status": 4 } }
```

Resposta: `200 [{"36220": true, "message": ""}]`

Aceita `PUT` ou `PATCH`. Dá pra atualizar em lote mandando array em `input`, com
`id` dentro de cada objeto → `207 Multi-Status`.

**Conferir o resultado relendo o item.** O `true` na resposta diz que o GLPI
aceitou a operação, não que o campo ficou com o valor pedido — foi assim que a
V2.1 nos enganou.

### Criar

```http
POST /apirest.php/Ticket/
{ "input": { "name": "...", "content": "..." } }
```
→ `201 {"id": 15}` + header `Location`. Lote → `207`.

### Excluir

```http
DELETE /apirest.php/Ticket/16?force_purge=true
```
`204` (single) / `200` (múltiplo) / `207` (parcial). Sem `force_purge` vai pra lixeira.

### Buscar (motor de busca do GLPI)

```http
GET /apirest.php/search/Ticket?criteria[0][field]=12&criteria[0][searchtype]=equals&criteria[0][value]=4
```

`field` = id de **searchOption** — descubra com
`GET /apirest.php/listSearchOptions/Ticket`. `searchtype`:
`contains` (curinga; `^` e `$` ancoram), `equals`/`notequals` (pra dropdown, **não**
é igualdade estrita), `lessthan`, `morethan`, `under`, `notunder`.

Isto **resolveria a busca de categorias** que a V2.1 não expõe: a v1 lê qualquer
itemtype, inclusive `ITILCategory` — ver seção 5.

### Outros úteis

| Endpoint | Serve pra |
|---|---|
| `getMyProfiles` / `getActiveProfile` | conferir com que perfil a API está entrando (causa do 403 antigo) |
| `changeActiveProfile` | trocar de perfil na sessão |
| `getActiveEntities` / `changeActiveEntities` | escopo de entidade (Marketing = 54) |
| `getGlpiConfig` | `$CFG_GLPI` inteiro |
| `listSearchOptions/:itemtype` | ids de campo pro `search` |
| `getMassiveActions/:itemtype/:id` | ações em massa disponíveis pro item |

---

## 4. Erros

| Código | Significado |
|---|---|
| `ERROR_APP_TOKEN_PARAMETERS_MISSING` | falta o App-Token — **é o que dá hoje** |
| `ERROR_WRONG_APP_TOKEN_PARAMETER` | App-Token não existe na config |
| `ERROR_NOT_ALLOWED_IP` | IP fora do range liberado no cliente de API |
| `ERROR_SESSION_TOKEN_INVALID` / `_MISSING` | sessão expirada ou header ausente |
| `ERROR_RIGHT_MISSING` | perfil sem direito (lembrar: vale o perfil **padrão**) |
| `ERROR_LOGIN_WITH_CREDENTIALS_DISABLED` | usar `user_token` em vez de usuário/senha |
| `ERROR_GLPI_UPDATE` / `_PARTIAL_UPDATE` | o core recusou o update |

---

## 5. O que destravar com a v1, em ordem de valor

1. **Status 4 (Pendente) e 6 (Fechado)** — o buraco que sobrou. `PUT` com
   `input.status`, sessão em `session_write=true`, relendo pra confirmar.
2. **Categoria de serviço (ITILCategory)** — a V2.1 não expõe (`/Dropdowns/` só tem
   Location, State, Manufacturer e Calendar; GraphQL dá 403 por falta de scope). A v1
   lê qualquer itemtype: `GET /apirest.php/ITILCategory?range=0-199`. Isso reabre o
   pedido do marketing que ficou de fora.

---

## 6. Configuração pendente (lado GLPI)

1. `Configurar > Geral > API` → habilitar API REST
2. Criar cliente de API (ex.: "OpenBoard") e gerar o **App-Token**
3. Restringir o cliente pelo **IPv4 da VPS**
4. Guardar como `GLPI_APP_TOKEN` no `.env` / `.env.production` — **nunca no código**

Reaproveitar `GLPI_USERNAME` / `GLPI_PASSWORD` que já existem, ou (melhor) gerar um
**user_token** (Remote access key) pro usuário de serviço e usar `GLPI_USER_TOKEN`,
evitando trafegar senha.

> Segurança: `client_secret` do OAuth e a senha do `integracaomkt` já vazaram em
> chat — rotacionar os dois segue pendente no roadmap. Não repetir o padrão com o
> App-Token.
