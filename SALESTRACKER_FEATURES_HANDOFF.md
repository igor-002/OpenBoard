# SalesTracker — O que o sistema faz hoje (handoff de features)

> Mapa funcional para a próxima IA entender os pontos essenciais antes de replicar.
> Foco em **o que cada área faz, filtros, regras e métricas** — sem design/cores.
> Stack: React 19 + Vite + Supabase (Postgres) + React Query + Zustand. Multi-tenant por `empresa_id`.

---

## 0. Papéis e controle de acesso (atravessa tudo)

Dois perfis, derivados do login (Supabase Auth → `profiles.role` + `usuarios.permissoes` +
`vendedorDbId`):

- **Gestor** — `permissoes.relatorios = true` e **sem** `vendedorDbId`. Vê dados de todo o time,
  todos os filtros, abas completas, ações de edição/limpeza.
- **Vendedor** — tem `vendedorDbId`. Vê **só os próprios dados** (queries já filtram pelo id dele).
  Abas/ações de gestor ficam ocultas.

Permissões por módulo (JSONB em `usuarios.permissoes`): `dashboard`, `nova_venda`, `clientes`,
`vendedores`, `metas`, `produtos`, `tv_dashboard`, `relatorios`, `admin`. Roteamento protege cada
página por flag.

---

## 1. Dashboard (`/dashboard`)

Visão geral do mês corrente. Seções:

- **5 KPI cards:** Faturamento do Mês · Total de Vendas (com sub "X únicas") · Comissões · **MRR**
  (receita recorrente) · Vendas Únicas.
- **Status dos Contratos** — distribuição por `status_ixc` (Ativo / Aguardando / etc).
- **Contratos Aguardando há mais de 7 dias** — lista de pendências de assinatura (usa `dias_em_aa`).
- **Sincronização IXC** (card colapsável, só se IXC configurado) — histórico dos últimos syncs +
  botão "Sincronizar agora" / "Reconciliar agora".
- **Últimas Vendas** — feed recente.
- **Projetos & Serviços** — vendas únicas/avulsas.
- Botão no header: **sincronizar status IXC agora**.

---

## 2. Área de Clientes / Vendas (`/clientes`)

Lista mestre de contratos+vendas com joins (vendedor, status, segmento). Editar e excluir inline
(modal). Badges traduzem `status_ixc` (A→Ativo, AA→Aguardando, etc). Botão de sync IXC.

### Filtros essenciais (modelo a replicar)
- **Busca** textual — nome do cliente ou UF.
- **Tipo:** Todos · MRR (recorrente) · Único (`mrr` boolean).
- **Vendedor** (dropdown).
- **Status** (dropdown, status de venda).
- **Mês** + **Ano** (por `data_venda`).
- **Mês de referência** — atalho de 3 meses (atual / anterior / 2 atrás), filtra por
  `mes_referencia` + `ano_referencia`.
- **Limpar filtros** + flag "tem filtro ativo".
- Rodapé: total faturamento das linhas filtradas + total MRR.

> Vendedor logado: a lista já entra pré-filtrada no próprio `vendedorDbId`.

---

## 3. Área de Vendedores (`/vendedores`) — onde se controla quem aparece

Página central de governança dos vendedores. **Dois toggles independentes por vendedor:**

| Toggle | Campo no DB | Efeito |
|---|---|---|
| **Ativo no CRM** | `vendedores.ativo` | Liga/desliga o vendedor no sistema (aparece em listas, relatório diário, etc). |
| **Histórico** | `vendedores.incluir_historico` | **Marca quem entra nos syncs de relatórios/histórico do IXC.** Só aparece se "Ativo" estiver ligado. Badge "HIST". |

> Este é o ponto que define **"ativar apenas os que devem aparecer em relatórios"**: o sync de
> contratos e o sync de histórico só processam vendedores com `incluir_historico = true` (mapeados
> por `ixc_id`). Vendedor sem isso é ignorado no pull do IXC.

Ações da página:
- **Sincronizar Vendedores** — puxa a lista de vendedores do IXC (insere novos / atualiza), traz
  `ixc_id`.
- **Sync Histórico** — roda `syncHistoricoVendedores()` (últimos 3 meses) com barra de progresso.
- **Busca** por nome ou ID IXC. Rodapé: "X de Y ativos".

---

## 4. Metas

Três níveis de meta:

- **Meta do time** (`metas`: `meta_mensal`, `meta_semanal` por mês/ano) — usada no Dashboard e na
  Visão Geral de relatórios (barra de progresso + forecast).
- **Meta por vendedor / mês** (`metas_vendedor`: `meta_contratos` por mês/ano) — **editável inline**
  na aba Ranking dos relatórios (lápis → input → salvar). Dirige a coluna "% Atingimento".
- **Meta mensal individual fixa** (`vendedores.meta_mensal`) — usada no perfil "Por Vendedor".

---

## 5. Relatórios Gerenciais (`/relatorios`) — 3 abas

Protegido por `permissao: relatorios`. Gestor vê as 3 abas; vendedor vê só Visão Geral e
Por Vendedor (fixo nele), Ranking oculto.

### Aba 1 — Visão Geral
Filtros: mês/ano + vendedor (só gestor). Conteúdo:
- **5 KPI cards:** Total Cadastrados, Aguardando, Ativos, Ticket Médio, Taxa de Conversão
  (`ativos/total`).
- **Meta do Time** (barra `ativos/meta_mensal`) + **Forecast** (projeção de fechamento por dias
  úteis): `forecast = (valorAtivos / diasÚteisPassados) × diasÚteisTotais`; null no 1º dia útil.
  Semáforo de ritmo (≥100% / 50-99% / <50%).
- **Tempo médio de ativação:** `status_atualizado_em − created_at` para `status_ixc='A'` (média,
  melhor, pior caso) — aproximação da data de ativação.
- **ARPU por segmento:** `receita/qtd` por `segmento.nome`, ordenado desc, badge "mais rentável".
- **Gráfico de evolução** dos últimos 6 meses (Total/Ativos/Aguardando).

### Aba 2 — Ranking de Vendedores (só gestor)
Tabela ordenada por ativos: Posição, Vendedor, Ativos, Aguardando, **Meta editável inline**,
% Atingimento (barra; label "Mês iniciando" quando zerado).

### Aba 3 — Por Vendedor
Filtros: vendedor (gestor escolhe) + mês/ano. Conteúdo:
- **4 KPI cards:** Ativos, Aguardando, % da Meta, Ticket Médio.
- **Perfil:** conversão individual, tempo médio de ativação, cancelamentos (`status_ixc='C'`), meta
  individual com barra.
- **Badges comparativos vs time:** "★ Melhor conversão", "⚠ Mais cancelamentos".
- **Gráfico de evolução** dos últimos 4 meses (Ativos/Aguardando).

> Dados vêm de `useRelatoriosIxc.ts` (React Query, `staleTime 30min`). Funções utilitárias:
> `calcKpis`, `calcForecast`, `calcArpuPorSegmento`, `calcTempoAtivacao`, `agruparPorMes`.

---

## 6. Relatório Diário Comercial (`/relatorio-diario`)

**Preenchimento manual** de atividade por vendedor (não vem do IXC). Um card por vendedor **ativo**;
vendedor logado vê só o próprio card.

Campos por vendedor (tabela `relatorio_diario`, chave vendedor+`data_relatorio`):
- Numéricos: **Leads, Contatos, Calls/Reuniões, Vendas fechadas**.
- **Produtos Vendidos:** lista de `{nome, valor}` (tags adicionáveis/removíveis); o "Valor total" é a
  soma automática dos produtos.
- **Observações** (texto livre).

Recursos:
- Seletor de data + contador **"X de Y vendedores preencheram"** (badge Preenchido/Pendente).
- **Consolidado do Dia** (tabela métrica × vendedor + total).
- **Gerar PDF** (jsPDF/autoTable): KPIs, tabela de atividade, produtos do dia, e **contratos
  fechados hoje** (puxa `vendas` por `data_venda`).
- **Histórico** (últimos 30 dias) com status Completo/Incompleto e "Ver".
- Gestor pode **limpar** os dados de um vendedor no dia.

---

## 7. Relatório Consolidado da Equipe (`/relatorio-equipe`) — visão do gestor

Agrega `relatorio_diario` num **intervalo de datas** (`inicio`–`fim`). Hook
`useRelatorioEquipe.ts`. Saídas:

- **Totais do período:** leads, contatos, calls, vendas, valor, nº de registros, dias com registro,
  vendedores ativos, **ticket médio** (`valor/vendas`), **taxa de conversão** (`vendas/contatos × 100`).
- **Ranking por vendedor** — mesmos agregados por pessoa, ordenado por valor desc (inclui nº de dias
  e nº de produtos).
- **Evolução por dia** — série diária (dd/mm) de leads/contatos/calls/vendas/valor.
- **Produtos agregados** — consolida todos os `produtos_vendidos` por nome (qtd + valor), ordenado
  por valor.

> Diferença-chave dos relatórios gerenciais (seção 5): **Equipe/Diário usam dados MANUAIS**
> (`relatorio_diario`, esforço comercial); **Gerenciais usam dados do IXC** (`vendas`, resultado real).

---

## 8. Conceitos transversais que a nova IA precisa entender

- **3 tabelas de venda:** `vendas` (contratos recorrentes do mês, MRR — substituída a cada sync
  completo) · `vendas_historico` (meses anteriores, congelado por vendedor+mês+ano) ·
  `vendas_unicas` (vendas avulsas/`vd_saida`, com parcelas).
- **`mes_referencia` / `ano_referencia`** — competência da venda; base de quase todo filtro/relatório.
- **`mrr` (boolean)** — separa recorrente de venda única.
- **`status_ixc`** — fonte de verdade do estado do contrato (A/AA/P/B/C/...); ver
  `IXC_INTEGRATION_HANDOFF.md`.
- **`dias_em_aa`** — quanto tempo o contrato está aguardando assinatura (alerta no Dashboard).
- **Sync é o motor:** quase nada é digitado à mão (exceto relatório diário). Dados de cliente/contrato
  vêm do IXC; ver doc de integração para MRR, filiais, vendedores autorizados.

---

## Arquivos-fonte (auditoria)
- `src/pages/Dashboard.tsx`, `Clientes.tsx`, `Vendedores.tsx`, `Relatorios.tsx`,
  `RelatorioDiario.tsx`, `RelatorioEquipe.tsx`
- `src/hooks/useRelatoriosIxc.ts`, `useRelatorioEquipe.ts`, `useVendedores.ts`
- `.claude/RELATORIOS.md`, `.claude/HISTORICO.md`, `.claude/DOCUMENTACAO_SISTEMA.md`,
  `.claude/SYNC.md`
- Integração IXC: `docs/IXC_INTEGRATION_HANDOFF.md`
