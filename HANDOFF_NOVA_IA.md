# Handoff para nova IA — Replicar integração IXC + features do SalesTracker

> Documento único. Entregue isto inteiro para a outra IA. Cobre: integração IXC, cálculo de MRR,
> filiais, autenticação/proxy, e o que cada área do sistema faz. Sem design/cores.

---

# PARTE 1 — INTEGRAÇÃO IXC

## Acesso e autenticação
- Base URL: `https://{dominio}/webservice/v1` (atual: `https://central.openitgroup.com.br`).
- Auth = **Basic Auth**: `Authorization: Basic <base64("id:token_webservice")>` (UM `:`, ex.: `329:hash`).
- **Toda listagem/GET exige header `ixcsoft: listar`** (sem ele → 404).
- **Token nunca no frontend.** Guardar em env server-side (`IXC_TOKEN`, sem prefixo público).

## Proxy obrigatório (CORS)
IXC não aceita chamada direta do browser. Tudo passa por proxy que injeta `Authorization` +
`ixcsoft: listar` e repassa. Rota: `{proxy}/ixc/{tabela}`. Proxy atual (VPS): `http://104.234.186.129:3001`.

## Padrão de query
POST com corpo JSON. Filtro = `qtype` (campo COM prefixo da tabela, ex.: `cliente_contrato.id_cliente`),
`query` (valor), `oper` (`=`, `>=`, `<=`). Paginação: `page`, `rp`, `sortname`, `sortorder`.
Varrer tudo: loop `do/while ((page-1)*rp < total)`.

## Armadilhas descobertas (CRÍTICO)
1. **`registros` vem como array OU objeto indexado** (`{"0":{...}}`) OU vazio → sempre normalizar.
2. **MRR limpo** (valor mensal real do contrato):
   - Produto base: `vd_contratos_produtos`, valor = `valor_liquido` (ou `valor_unit`) × `qtde`.
   - **Produtos têm 2 vínculos** — consultar os dois e deduplicar por `id`:
     - "Contrato": `id_contrato` preenchido, `id_vd_contrato` = "0".
     - "Plano": `id_vd_contrato` preenchido, `id_contrato` = "0".
   - **Descontos** (`cliente_contrato_descontos`) subtraem. Campo do valor = `valor`.
   - **Acréscimos** (`cliente_contrato_acrescimos`) somam. Campo = **`valor`** (NÃO existe `valor_acrescimo`).
   - Ambos ligam ao produto por `id_vd_contrato_produtos`.
   - **Fórmula por produto:** `max(0, valor_unit*qtde − desconto) + acrescimo`. Somar todos.
   - Ao usar boletos (`fn_areceber`): **ignorar parcelas com `parcela_proporcional = 'S'`**.
   - **NÃO usar `taxa_instalacao` como MRR** (é taxa de instalação, não recorrente).
3. **Concorrência:** browser abre só ~6 conexões/host. Processar em **lotes de ~10** com
   `Promise.allSettled`; falha individual não aborta o lote.
4. **Campo de status:** usar `cliente_contrato.status_internet` (negócio), NÃO `status` (cru).
   Vocabulários diferentes (`status="P"` ↔ `status_internet="AA"`). Ler `status` quebra todos os
   relatórios. Ver tabela em "Status do contrato". Há um código `D` (Desativado) que domina a
   base e fica FORA das métricas de venda.

## Filiais — só puxamos destas
**`id_filial` ∈ {`1`, `2`, `6`}.** Resto é descartado (filtro em JS após o fetch). Nomes não estão no
código — consultar endpoint de filial no IXC se precisar. Recomendado externalizar em env
(`IXC_FILIAIS=1,2,6`) no novo projeto.

## Status do contrato — campo `status_internet` (NÃO `status`)
⚠️ **Ler `cliente_contrato.status_internet`** (status de negócio), nunca o campo cru
`cliente_contrato.status`. São vocabulários DIFERENTES: o mesmo contrato pode ter
`status="P"` e `status_internet="AA"`. Usar `status` corrompe todo relatório.

Códigos de `status_internet`:

| Código | Significado | Uso no dashboard |
|---|---|---|
| `A`  | Ativo | **Realidade** (meta real do mês) |
| `AA` | Aguardando Assinatura | **Pipeline** (promessa) |
| `P`  | Proposta | Pipeline (tratar junto de AA) |
| `CA` | Cancelado (encerramento contratual formal) | bucket Cancelado (evento do período) |
| `CN`/`C` | Cancelado | bucket Cancelado |
| `CM` | Bloqueado (Manual) | bucket Bloqueado |
| `B`  | Bloqueado | bucket Bloqueado |
| `FA` | Financeiro em Atraso | bucket próprio |
| `N`  | Negativado | bucket próprio |
| `D`  | **Desativado** (serviço desligado — base inativa/churn acumulado) | **FORA das métricas** |

Regra de negócio: `A` = realidade; `AA`/`P` = pipeline.

**`D` (Desativado) ≠ `CA` (Cancelado).** `D` é base inativa de anos (desligados/suspensos,
muitos sem `data_ativacao` nem `data_cancelamento`) — pode ser >50% da base. **Nunca somar
`D` em "Cancelado" nem nas vendas do mês** (explode o número e mente). O SalesTracker nunca
viu `D` porque só puxa `A`/`AA` filtrado por mês+filial+vendedor — esse filtro já exclui `D`.
Para visão de carteira/churn, usar um bucket separado "Inativos/Desativados".

## Datas por status
- `A` → data de referência = `data_ativacao`.
- `AA`/`P` → `data_cadastro_sistema`.
- `data_ativacao = '0000-00-00'` é nulo do IXC → cair em `data_cadastro_sistema`.

## Vendedores autorizados
Mapear `id_vendedor` / `id_vendedor_ativ` (IXC) → vendedor local via campo `ixc_id`.
**Só sincronizar vendedores marcados `incluir_historico = true`.** Resto ignorado.

## Endpoints consumidos
`cliente` · `cliente_contrato` · `vd_contratos_produtos` · `cliente_contrato_descontos` ·
`cliente_contrato_acrescimos` · `fn_areceber` · `vd_saida` (vendas avulsas: `id_contrato` 0/vazio) ·
`vendedor` (`status='A'`).

## Códigos de erro
400 SSL/auth não-Basic · 401 token inválido/usuário inativo · 403 token de servidor antigo ·
404 falta header `ixcsoft: listar` · 500 endpoint errado ou `qtype` sem prefixo · 504 timeout IXC.

## Variáveis de ambiente
```
VITE_IXC_BASE_URL=https://central.openitgroup.com.br
VITE_IXC_PROXY_URL=http://104.234.186.129:3001
IXC_TOKEN=Basic <token>        # server-side, SEM prefixo VITE_. Nunca no bundle.
# IXC_FILIAIS=1,2,6            # recomendado externalizar
```

---

# PARTE 2 — O QUE O SISTEMA FAZ (features)

Stack: React 19 + Vite + Supabase (Postgres) + React Query + Zustand. Multi-tenant por `empresa_id`.

## Papéis
- **Gestor** (`permissoes.relatorios=true`, sem `vendedorDbId`): vê todo o time, todos os filtros.
- **Vendedor** (`vendedorDbId`): vê só os próprios dados; ações de gestor ocultas.
- Permissões por módulo (JSONB): dashboard, nova_venda, clientes, vendedores, metas, produtos,
  tv_dashboard, relatorios, admin.

## Dashboard
5 KPI (Faturamento, Total Vendas, Comissões, **MRR**, Vendas Únicas) · Status dos Contratos ·
Contratos Aguardando >7 dias (`dias_em_aa`) · card de Sync IXC (histórico + "Sincronizar"/"Reconciliar")
· Últimas Vendas · Projetos & Serviços.

## Clientes / Vendas — filtros essenciais
Busca (nome/UF) · Tipo (Todos/MRR/Único, campo `mrr`) · Vendedor · Status · Mês · Ano ·
Mês-referência (atalho 3 meses, por `mes_referencia`+`ano_referencia`) · Limpar filtros.
Lista com joins, editar/excluir, badges de `status_ixc`.

## Vendedores — onde se controla quem aparece
**Dois toggles por vendedor:**
- **Ativo no CRM** (`vendedores.ativo`) — liga/desliga no sistema.
- **Histórico** (`vendedores.incluir_historico`) — **define quem entra nos syncs de relatórios/IXC.**
Ações: "Sincronizar Vendedores" (puxa do IXC, traz `ixc_id`) · "Sync Histórico" (3 meses) · busca.

## Metas (3 níveis)
- Time: `metas.meta_mensal` / `meta_semanal`.
- Por vendedor/mês: `metas_vendedor.meta_contratos` (editável inline no Ranking).
- Individual fixa: `vendedores.meta_mensal`.

## Relatórios Gerenciais (`/relatorios`) — dados do IXC
- **Visão Geral:** KPIs (cadastrados, aguardando, ativos, ticket, conversão), Meta do Time,
  **Forecast** = `(valorAtivos / diasÚteisPassados) × diasÚteisTotais`, Tempo médio de ativação
  (`status_atualizado_em − created_at`), ARPU por segmento, gráfico 6 meses.
- **Ranking** (gestor): tabela por ativos, meta editável, % atingimento.
- **Por Vendedor:** KPIs + perfil (conversão, ativação, cancelamentos, meta) + badges + gráfico 4 meses.

## Relatório Diário (`/relatorio-diario`) — dados MANUAIS
Card por vendedor: Leads, Contatos, Calls/Reuniões, Vendas, Produtos Vendidos (`{nome,valor}`),
Observações. Consolidado do dia · Gerar PDF (inclui contratos fechados hoje) · Histórico 30 dias ·
contador "X de Y preencheram".

## Relatório de Equipe (`/relatorio-equipe`) — agrega o diário num range de datas
Totais (leads/contatos/calls/vendas/valor, ticket médio, **conversão = vendas/contatos**) · Ranking
por vendedor · Evolução por dia · Produtos agregados.

## Conceitos transversais
- **3 tabelas de venda:** `vendas` (recorrentes do mês, substituída a cada sync completo) ·
  `vendas_historico` (meses fechados) · `vendas_unicas` (avulsas + parcelas).
- `mes_referencia`/`ano_referencia` = competência (base dos filtros). `mrr` = recorrente vs único.
- **Diário/Equipe = esforço manual; Gerenciais = resultado real do IXC.**
