# IXC — Handoff de Integração (lógicas e decisões essenciais)

> Documento de contexto para replicar a integração IXCSoft em um novo projeto.
> Foco em **lógicas, regras de negócio e armadilhas descobertas na prática** — não em código
> de implementação nem em design. Extraído de `docs/ixc-api.md`, `.claude/SYNC.md`,
> `src/lib/ixc.ts`, `src/services/ixcSync.ts`, `api/ixc/[tabela].ts`, `vite.config.ts`.

---

## 1. Acesso e Autenticação

- **Base URL:** `https://{dominio}/webservice/v1`
- **Auth:** Basic Auth — `Authorization: Basic <base64(usuario:senha)>` **ou** o token direto
  gerado no painel (Configurações > Usuários > Usuário > Token de acesso).
- **Toda listagem/GET exige o header `ixcsoft: listar`.** Sem ele → erro **404**.
- **Decisão de segurança (crítica):** o token **nunca** vai para o frontend. Guardar a credencial
  numa env **sem prefixo público** (`IXC_TOKEN`, não `VITE_IXC_TOKEN`) — só o servidor/proxy a
  enxerga. Apenas a URL base (pública) pode ter prefixo de frontend.

---

## 2. Proxy é obrigatório (CORS)

O IXC não aceita chamada direta do browser. **Toda requisição passa por um proxy** que injeta o
`Authorization` e o header `ixcsoft: listar` e repassa ao IXC. O frontend só conhece a tabela alvo;
quem tem a credencial é o proxy.

Padrão de 3 ambientes usado neste projeto:

| Ambiente | Como funciona |
|---|---|
| Dev | Proxy do dev server reescreve `/api/ixc/*` → `/webservice/v1/*` |
| Prod serverless | Função `api/ixc/{tabela}` adiciona `Authorization` + `ixcsoft: listar` |
| Prod VPS | Proxy externo via `IXC_PROXY_URL`; frontend monta `{proxy}/ixc/{tabela}` |

---

## 3. Padrão de query da API (`qtype` / `query` / `oper`)

- Filtro = trio: `qtype` (campo, ex.: `cliente_contrato.id_cliente`), `query` (valor), `oper`
  (`=`, `>=`, `<=`).
- **O campo no `qtype` precisa do prefixo da tabela**, senão → erro **500**.
- Paginação: `page`, `rp` (registros por página), `sortname`, `sortorder`.
- Para varrer tudo: loop `do/while` enquanto `(page-1)*rp < total`, usando o `total` da resposta.
- As listagens são feitas via **POST** (corpo JSON com os filtros) + header `ixcsoft: listar`.

---

## 4. Armadilha #1 — formato de `registros` inconsistente

A API retorna `registros` ora como **array**, ora como **objeto indexado por chave**
(`{ "0": {...}, "1": {...} }`), ora vazio. **Sempre normalizar** antes de usar:

1. Se for array → usar direto.
2. Se for objeto não-vazio → usar os valores (`Object.values`).
3. Senão → lista vazia.

Sem essa normalização, a integração quebra silenciosamente em alguns endpoints.

---

## 5. Armadilha #2 — cálculo de MRR limpo (valor mensal recorrente real)

A parte mais delicada. Para achar o valor mensal real de um contrato **não basta pegar a venda
crua** — é preciso considerar produto, desconto e acréscimo.

**Fonte do produto:** `vd_contratos_produtos`. Valor = `valor_liquido` (preferir) ou `valor_unit`,
vezes `qtde`.

**Produtos têm DOIS tipos de vínculo** — consultar os dois e deduplicar por `id`:

| Vínculo | `id_contrato` | `id_vd_contrato` |
|---|---|---|
| "Contrato" | preenchido | `"0"` |
| "Plano" | `"0"` | preenchido (id do plano) |

**Descontos** (`cliente_contrato_descontos`): **subtraem** do produto. Campo do valor = `valor`.

**Acréscimos** (`cliente_contrato_acrescimos`): **somam** ao produto (ex.: acordo comercial acima
do plano). Campo do valor = **`valor`** — atenção: **NÃO existe `valor_acrescimo`**, é o mesmo
padrão dos descontos.

Tanto desconto quanto acréscimo vinculam ao produto por `id_vd_contrato_produtos`.

**Fórmula por produto:**

```
valorProduto = max(0, valor_unit * qtde - desconto) + acrescimo
MRR = soma de todos os produtos do contrato
```

**Boletos proporcionais:** quando usar `fn_areceber` como fonte de valor, **ignorar parcelas com
`parcela_proporcional = 'S'`** — não representam o valor cheio recorrente.

**Ordem de prioridade adotada:** valor vem dos produtos do plano/contrato; só usar boleto quando
necessário. Contrato que ainda não ativou (AA / Proposta) não tem boleto → valor vem do plano via
`id_vd_contrato`.

---

## 6. Status do contrato

| Código | Significado |
|---|---|
| `A` | Ativo |
| `AA` | Aguardando Assinatura |
| `P` | Proposta |
| `B` / `CM` | Bloqueado (Manual) |
| `C` / `CN` | Cancelado |
| `FA` | Financeiro em Atraso |
| `N` | Negativado |

- Regra de negócio do CRM: `A` = **realidade** (meta real do mês); `AA`/`P` = **pipeline**
  (promessa).
- O nome do campo de status no JSON **varia por versão do IXC** (aqui: `status`; em alguns
  endpoints `status_internet`) → deixar configurável.

---

## 7. Lógica de datas por status

- `A` → data de referência = **`data_ativacao`**.
- `AA` / `P` → data de referência = **`data_cadastro_sistema`** (ainda não ativou).
- **`data_ativacao = '0000-00-00'`** é o "nulo" do IXC → tratar como ausente e cair em
  `data_cadastro_sistema`.
- "Dias aguardando" / "dias em AA" = hoje − `data_cadastro_sistema` (ou campo `data`).

---

## 8. Filtros de negócio aplicados

- **Filiais permitidas:** apenas `1`, `2`, `6`. Resto é descartado. Parametrizar no novo projeto.
- **Período:** janela de meses (mês atual, ou últimos 3) filtrada pela data de referência do status.
- **Vendedores autorizados:** mapear `id_vendedor` / `id_vendedor_ativ` do IXC para o vendedor
  local por um campo `ixc_id`. Contratos de vendedor não autorizado são ignorados (ou viram
  placeholder, conforme a política escolhida).

---

## 9. Concorrência e robustez

- **O browser abre só ~6 conexões por host.** Disparar centenas de promises contra o proxy trava a
  fila e congela o indicador de sync. **Processar em lotes (batch ≈ 10)** com `Promise.allSettled`.
- Falha de um registro **não aborta o lote**: contabilizar o erro e seguir (resiliência individual).
- **Registrar cada execução de sync em log** (início / fim / duração / contadores / erro fatal) para
  observabilidade.
- **Reconciliação:** após o sync, comparar status local vs IXC e corrigir divergências críticas
  (ex.: `AA→A`, `A→B`, `A→C`). Disparo automático e **não-fatal** (falha silenciosa não derruba o
  sync principal).

---

## 10. Endpoints que consumimos

| Endpoint | Uso |
|---|---|
| `cliente` | Dados do cliente (`razao`, `cnpj_cpf`, `uf`) por `cliente.id` |
| `cliente_contrato` | Status, vendedor, datas, filial, `taxa_instalacao`, `id_vd_contrato` |
| `vd_contratos_produtos` | Produtos/valores do contrato (por `id_contrato` **e** por `id_vd_contrato`) |
| `cliente_contrato_descontos` | Descontos por `id_contrato` (campo do valor: `valor`) |
| `cliente_contrato_acrescimos` | Acréscimos por `id_contrato` (campo do valor: `valor`) |
| `fn_areceber` | Boletos/parcelas (por `id_contrato`, `id_venda` ou `id`) |
| `vd_saida` | Vendas avulsas (avulsa = `id_contrato` 0/vazio/nulo) |
| `vendedor` | Lista de vendedores ativos (`status = 'A'`) |

---

## 11. Códigos de erro (referência rápida)

| Código | Causa |
|---|---|
| 400 | Erro SSL ou auth diferente de Basic |
| 401 | Token inválido ou usuário inativo |
| 403 | Token gerado em servidor antigo (pós-migração) |
| 404 | Falta header `ixcsoft: listar` no GET |
| 500 | Endpoint errado ou `qtype` sem prefixo de tabela |
| 504 | Timeout do servidor IXC (alta demanda/limite) |

---

## 12. Variáveis de ambiente necessárias

- **Token (server-side, sem prefixo público)** — Basic Auth.
- **URL base do IXC** (pública).
- **URL do proxy** — quando usar proxy externo/VPS.
- **Nome do campo de status** (opcional; default conforme a versão do IXC).
