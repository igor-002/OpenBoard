# GLPI 11 — API V2.1 · Referência de Integração

> Documento de referência para construir uma integração (aba no CRM) que consome
> dados do GLPI. Escrito para ser consumido por uma IA de código (ex.: Claude Code).
> Instância alvo: **https://chamados.openitcorp.com.br** · Versão da API: **v2.1** (High-Level API).

---

## 1. Contexto e princípios

- O GLPI 11 tem **duas APIs**:
  - **V1 (Low-Level / legacy)** em `/apirest.php` — amarrada ao banco, usa `Session-Token` + `App-Token`. **Não usar** para integração nova.
  - **V2 (High-Level)** em `/api.php` — schemas estáveis, filtros RSQL, OpenAPI, auth OAuth2. **É esta que usamos.**
- **Sempre fixar a versão no path**: `/api.php/v2.1/...`. Sem versão, o GLPI usa "a mais nova", o que pode quebrar a integração num upgrade futuro.
- **Nunca chamar o GLPI direto do frontend (React).** Motivos: exporia `client_secret`/senha no navegador, o token Bearer ficaria acessível no DevTools, e há bloqueio de CORS. Toda chamada passa por um **proxy no backend** (ver seção 8).

### URLs base

| Item | Valor |
|---|---|
| Host | `https://chamados.openitcorp.com.br` |
| Token endpoint | `https://chamados.openitcorp.com.br/api.php/token` |
| API base (versão fixa) | `https://chamados.openitcorp.com.br/api.php/v2.1` |
| Swagger UI (browser, autenticado) | `https://chamados.openitcorp.com.br/api.php/doc` |
| OpenAPI JSON (schema completo) | `https://chamados.openitcorp.com.br/api.php/doc.json` |

---

## 2. Autenticação (OAuth2 · Password Grant)

A API V2 usa **OAuth2**. Para script/servidor-a-servidor, o grant é **`password`**.

### Pré-requisitos no GLPI (Configurar → Clientes OAuth)

- O Cliente OAuth precisa ter, **salvos como tag/chip**:
  - **Concessões (Grants)**: `Senha` (password). *(Se só o "Código de autorização" estiver marcado, o token dá `unauthorized_client`.)*
  - **Escopos**: `api` — **obrigatório**. Se o client não tiver `api` na lista, a lib OAuth descarta o scope silenciosamente e o token sai com `scopes:[]`, resultando em `ERROR_RIGHT_MISSING` em todos os endpoints.
- O **usuário de serviço** (ex.: `integracaomkt`) precisa de um **perfil com direito de leitura** numa **entidade válida**. O que a API enxerga é limitado pelo perfil desse usuário.

### Obter o token

```bash
curl -s -X POST 'https://chamados.openitcorp.com.br/api.php/token' \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "password",
    "client_id": "<CLIENT_ID>",
    "client_secret": "<CLIENT_SECRET>",
    "scope": "api",
    "username": "<USUARIO_SERVICO>",
    "password": "<SENHA_SERVICO>"
  }'
```

Resposta:

```json
{
  "token_type": "Bearer",
  "expires_in": 3600,
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "refresh_token": "def5020025..."
}
```

- `access_token`: validade padrão **3600s (1h)**. Vai no header `Authorization: Bearer <access_token>`.
- `refresh_token`: use para renovar sem reenviar usuário/senha.

### Validar o scope sem bater endpoint

O payload do JWT (parte do meio) deve conter `"scopes":["api"]`:

```bash
echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null; echo
# esperado: {..., "sub":"<user_id>", "scopes":["api"]}
```

### Renovar via refresh_token

```bash
curl -s -X POST 'https://chamados.openitcorp.com.br/api.php/token' \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "<REFRESH_TOKEN>",
    "client_id": "<CLIENT_ID>",
    "client_secret": "<CLIENT_SECRET>",
    "scope": "api"
  }'
```

---

## 3. Convenções de requisição

Todas as chamadas de dados usam o header de auth e, idealmente, idioma:

```
Authorization: Bearer <access_token>
Content-Type: application/json
Accept-Language: pt_BR
```

### Paginação — `range`

- Parâmetro: `?range=inicio-fim` (ex.: `range=0-49` = 50 primeiros).
- O total vem no header de resposta **`Content-Range: inicio-fim/total`**. Use `curl -i` para vê-lo.

```bash
# descobrir o total de chamados
curl -si 'https://chamados.openitcorp.com.br/api.php/v2.1/Assistance/Ticket?range=0-0' \
  -H "Authorization: Bearer $TOKEN" | grep -i content-range
# ex.: Content-Range: 0-0/347
```

### Seleção de campos — `fields`

Evita despejar o objeto inteiro. Lista separada por vírgula:

```
?fields=id,name,status,date_creation,priority,entity
```

### Filtro — RSQL (`filter`)

A V2 **não** usa o `searchText` da V1. Usa **RSQL**.

| Operador | Significado | Exemplo |
|---|---|---|
| `==` | igual | `status==6` |
| `!=` | diferente | `status!=6` |
| `=gt=` / `=ge=` | maior / maior ou igual | `date_creation=ge=2026-02-01` |
| `=lt=` / `=le=` | menor / menor ou igual | `priority=le=3` |
| `=in=` / `=out=` | dentro / fora de lista | `status=in=(1,2,4)` |
| `and` / `or` | composição | `status!=6 and priority=ge=3` |
| `*` | wildcard (texto) | `name=="*servidor*"` |

Campos aninhados usam ponto: `entity.id==5`.

```bash
# chamados NÃO fechados (status 6 = Fechado), criados a partir de fevereiro/2026
curl -s 'https://chamados.openitcorp.com.br/api.php/v2.1/Assistance/Ticket?filter=status!=6 and date_creation=ge=2026-02-01&fields=id,name,status,date_creation&range=0-49' \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 4. Padrão CRUD (por recurso)

| Verbo | Rota | Ação |
|---|---|---|
| `GET` | `/v2.1/<Namespace>/<Tipo>` | listar (coleção) |
| `GET` | `/v2.1/<Namespace>/<Tipo>/{id}` | obter um item |
| `POST` | `/v2.1/<Namespace>/<Tipo>` | criar |
| `PATCH` | `/v2.1/<Namespace>/<Tipo>/{id}` | atualizar |
| `DELETE` | `/v2.1/<Namespace>/<Tipo>/{id}` | remover |

Para a aba do CRM (somente leitura) só interessam os `GET`.

---

## 5. Endpoints (namespaces principais)

> A lista exata da instância vem do `doc.json` (seção 7). Abaixo, os namespaces padrão do GLPI 11.

- **Assistência (chamados):**
  - `/v2.1/Assistance/Ticket`
  - `/v2.1/Assistance/Ticket/{id}/Timeline` (acompanhamentos, tarefas, soluções)
  - `/v2.1/Assistance/Change`
  - `/v2.1/Assistance/Problem`
- **Ativos:**
  - `/v2.1/Assets/Computer`
  - `/v2.1/Assets/NetworkEquipment`
  - `/v2.1/Assets/Printer`
  - `/v2.1/Assets/Phone`
  - `/v2.1/Assets/Monitor`
  - **Tipos custom (DVR/NVR):** provavelmente sob `Assets/<NomeDefinido>` — **confirmar no `doc.json`**.
- **Administração:**
  - `/v2.1/Administration/User`
  - `/v2.1/Administration/Entity`
  - `/v2.1/Administration/Group`
  - `/v2.1/Administration/Profile`

---

## 6. Schema do Ticket (campos reais observados)

Campos retornados por `GET /v2.1/Assistance/Ticket` nesta instância (subconjunto útil):

| Campo | Tipo | Observação |
|---|---|---|
| `id` | int | ID do chamado |
| `name` | string | Título |
| `content` | string (HTML) | Descrição |
| `is_deleted` | bool | Excluído (lixeira) |
| `status` | objeto `{id,name}` | 1=Novo, 2=Em atendimento (atribuído), 4=Pendente, 5=Solucionado, 6=Fechado |
| `urgency` / `impact` / `priority` | int | 1..5 |
| `type` | int | 1=Incidente, 2=Requisição |
| `date_creation` | datetime ISO8601 | Abertura |
| `date_mod` | datetime | Última modificação |
| `date_solve` / `date_close` | datetime\|null | Solução / fechamento |
| `resolution_duration` / `close_duration` | int (s) | Durações |
| `waiting_duration` | int (s) | Tempo em espera |
| `request_type` | objeto `{id,name}` | Origem (ex.: "NOC OpenIT Corporate") |
| `category` | objeto\|null | Categoria ITIL |
| `location` | objeto\|null | Localização |
| `entity` | objeto `{id,name,completename}` | **Entidade** — chave provável para "cliente" |
| `user_recipient` / `user_editor` | objeto `{id,name}` | Autor / editor |
| `team` | array | Atores: `{role, name, firstname, id, ...}`. `role` = `requester`, `assign`, `observer` |
| `sla_ttr` / `sla_tto` / `ola_*` | objeto\|null | SLAs/OLAs |

> **Nota de modelagem importante:** nos dados observados, todos os chamados caíram em
> `entity: {id:0, "Entidade raiz"}` e eram alertas automáticos do NOC (Zabbix/Proxmox).
> Definir **o que identifica "o cliente"** é pré-requisito para a aba:
> (a) uma **entidade por cliente**, (b) o campo custom **Patrimônio** do plugin Fields,
> ou (c) vínculo por **ativo/localização**. Isso determina o `filter` das queries.

---

## 7. Como extrair o schema COMPLETO da instância (com DVR/NVR e Patrimônio)

O OpenAPI/Swagger da instância é a fonte de verdade — inclui tipos custom e campos de plugin.

```bash
# 1) baixar o OpenAPI completo
curl -s 'https://chamados.openitcorp.com.br/api.php/doc.json' \
  -H "Authorization: Bearer $TOKEN" -o glpi-openapi.json

# 2) listar todos os paths disponíveis
jq '.paths | keys' glpi-openapi.json

# 3) inspecionar o schema de um tipo específico (ex.: Ticket)
jq '.components.schemas.Ticket' glpi-openapi.json

# 4) achar os tipos de ativo custom (procurar por DVR/NVR)
jq '.paths | keys[] | select(test("DVR|NVR|Asset"; "i"))' glpi-openapi.json
```

Alternativa visual: abrir `https://chamados.openitcorp.com.br/api.php/doc` no navegador,
autenticar pelo botão do Swagger (usa o Client OAuth) e navegar pelos endpoints/campos.

---

## 8. Arquitetura recomendada (proxy backend)

```
React CRM (frontend)  →  Proxy (backend, VPS)  →  GLPI /api.php/v2.1
   auth do CRM             guarda credenciais         Bearer token
                           cacheia o token            RSQL/paginação
```

Responsabilidades do proxy:

1. **Guardar credenciais** (`client_id`, `client_secret`, usuário/senha de serviço) em **variáveis de ambiente** — nunca no código nem no frontend.
2. **Cachear o `access_token`** e renovar automaticamente ~5 min antes de expirar (não pedir `/token` a cada request — gera lentidão e log gigante no GLPI).
3. **Expor rotas próprias** já filtradas por cliente, que o React consome protegido pela auth do CRM.
4. **Traduzir** os parâmetros do CRM em `filter` RSQL / `fields` / `range`.

Padrão de cache de token (pseudo):

```
tokenCache = { access_token, expires_at }
getToken():
  if tokenCache and now < expires_at - 300s: return tokenCache.access_token
  else: POST /token (password) ; salvar ; retornar
```

Sugestão de deploy: Node + Express, gerenciado por PM2 (mesmo padrão do proxy IXC).
Restringir o Cliente OAuth por **IP da VPS** em "Restrições de IP".

---

## 9. Códigos de erro (diagnóstico rápido)

| Retorno | Causa provável | Correção |
|---|---|---|
| `unauthorized_client` — "not authorized to use this authorization grant type" | Grant `Senha` não habilitado no Client OAuth | Adicionar `Senha` em Concessões |
| `ERROR_RIGHT_MISSING` — "required scope(s)" + JWT com `scopes:[]` | Scope `api` não está no Client (foi descartado) | Salvar `api` como tag em Escopos e **gerar token novo** |
| `ERROR_RIGHT_MISSING` com scope OK | Perfil/entidade do usuário de serviço sem direito | Dar perfil de leitura numa entidade válida |
| `ERROR_ITEM_NOT_FOUND` | Path errado (usou path da V1, ex.: `/Ticket`) | Usar namespace correto: `/Assistance/Ticket` |
| Token válido mas sem dados (`[]`) | Usuário não enxerga itens naquela entidade | Ajustar entidade/perfil ou o `filter` |

---

## 10. Checklist de segurança (pós-implementação)

- [ ] **Rotacionar o `client_secret`** (gerar novo no Cliente OAuth).
- [ ] **Trocar a senha** do usuário de serviço (`integracaomkt`).
- [ ] Credenciais **apenas em env vars** no backend.
- [ ] Cliente OAuth com **Restrição de IP** para a VPS.
- [ ] Usuário de serviço com **perfil somente-leitura** e escopo mínimo de entidades.
- [ ] Frontend **nunca** fala direto com o GLPI (sempre via proxy).

---

## 11. Referências

- API V2 (RESTful) — help.glpi-project.org → Configuration → General → API → RESTful API (V2)
- Tutorial API V2 — help.glpi-project.org/tutorials → API v2
- OAuth Clients — help.glpi-project.org → Configuration → OAuth Clients
- Versionamento: `/api.php/v1` (legacy), `/api.php/v2.0`, `/api.php/v2.1` (fixar a maior estável)
