# Roadmap — Comercial (sessão 2026-07-23)

## 🔭 Melhorias & possibilidades (backlog, não urgente)

**Quadro de Demandas (Trello-like) — evoluções:**
- [ ] **Sync quadro ↔ status GLPI** (opção): mover um card GLPI de coluna pode
  mudar o status do chamado no GLPI (ex.: coluna "Concluído" → status Solucionado).
  Hoje os fluxos são separados de propósito (coluna do quadro ≠ status GLPI).
  Seria um mapeamento coluna→status opcional por coluna. Decidir se automático ou botão.
- [ ] Reorder fino dentro da coluna (hoje o drop joga o card no fim da coluna destino).
- [ ] Colunas customizáveis: adicionar / renomear / reordenar / excluir colunas na UI.
- [ ] DnD em **touch/mobile** (hoje é só desktop — HTML5 drag nativo não pega touch;
  precisaria lib de DnD com suporte a toque).
- [ ] Vincular card GLPI por busca (autocomplete do espelho) em vez de digitar o nº.
- [ ] Filtro por etiqueta / responsável no quadro.

**Kanban de status GLPI (/marketing/demandas):**
- [ ] Bloquear/ocultar "Novo" como destino de arraste (não faz sentido voltar pra Novo).
- [ ] DnD touch/mobile.

**Segurança (pendências soltas):**
- [ ] GLPI: trocar o user de serviço de **super admin** por perfil default MÍNIMO
  (só Followup>Add + Ticket>Update + leitura). Super admin é permissão demais.
- [ ] **Rotacionar** `client_secret` do OAuth + senha do `integracaomkt` (vazaram no chat)
  e restringir o Cliente OAuth por IP da VPS.

**Instagram / relatórios:**
- [ ] (opcional) Export PDF do relatório de Demandas GLPI já existe; avaliar PDF/− do social.



## 8. Quadro de Demandas do Marketing (Trello-like)  🔨 FASE 1 + MODAL/ANEXOS FEITOS
Módulo novo `/marketing/quadro`. Base decidida: quadro Kanban próprio (colunas ≠
status GLPI), card interno OU linkado a chamado GLPI (puxa status/atribuído do espelho).
- [x] FASE 1 — base + etiquetas: schema (MktBoard/Column/Card/Label + m2m), migração
  `20260724181942_mkt_quadro`, `server/marketing/board.ts` (ensureDefaultBoard lazy c/
  colunas do Trello + labels), actions, `QuadroBoard.tsx` (DnD nativo, add card, editor
  modal c/ etiquetas/descrição/prazo/link GLPI), nav. tsc+eslint limpos. Falta deploy.
- [x] MODAL DE CRIAR + ANEXOS + UX (2026-07-27): botão "Adicionar cartão" abre modal rico
  (mesmo modal de criar/editar; header, título, etiquetas, descrição, prazo, GLPI). Colunas
  repaginadas (borda, header, scroll interno, empty state, hover no card, badges de anexo/desc).
  Anexos: modelo `MktCardAttachment` (bytea no Postgres, sem infra de storage), migração
  `20260727154208_mkt_card_attachment`, cap 20 MB, upload multi-arquivo via server action
  (FormData), preview de imagem, rota autenticada `/marketing/quadro/anexo/[id]` (guard módulo
  `marketing`). Cria o card → libera anexar. tsc limpo. Falta deploy VPS.
- [x] FASE 2 — notificação de prazo (2026-07-27): `alertQuadroPrazos()` em `server/alerts.ts`
  (reusa o scheduler in-process, tick 6h, dedup 7d). Card com dueAt ≤2d/vencido → sino pro
  criador + admins; ignora colunas de saída (Concluído/Material Pronto). Notificação linka
  `?card=<id>` e a página abre o card no modal. tsc limpo, validado. Falta deploy.
- [ ] FASE 3 — anexo do card → também **espelhar no GLPI** + descrição (API de documentos GLPI).
      (upload local no card já feito; falta o push pro GLPI.)
- [ ] Reorder dentro da coluna (hoje drop só joga no fim); colunas customizáveis (add/rename/reorder).


## 7. Largura 100% + feedback de sync (toast + tempo)  ✅ FEITO (falta deploy)
- [x] `.page` sem `max-width: 1340px` → usa 100% do monitor (fim do vazio lateral).
- [x] `src/lib/toast.ts` (`emitToast`) + ToastHost aceita toast local (info/success/error), além do SSE.
- [x] `src/lib/useSyncRun.ts`: hook padrão de sync — tempo decorrido AO VIVO no botão + toasts iniciado/concluído/erro.
- [x] Fiado em TODOS os syncs: IXC (`SyncButton`), GLPI (`GlpiDemandas`), Instagram (`ContasManager`), Vendedores (`VendedoresManager`).
- [x] tsc + eslint limpos.


## 1. Upgrade no cadastro de produtos  ✅ FEITO (falta teste manual + push)
Toggle "Novo contrato ↔ Upgrade" no form público `/solicitar-cadastro`.
Upgrade envia: CPF/CNPJ, razão social, plano antigo, plano novo, valor a adicionar
(+ solicitante + urgência/prazo). Mesma fila `/comercial/cadastros`.

- [x] Schema: `tipo` ("cadastro"|"upgrade") + `planoAntigo` em `SolicitacaoCadastro`
- [x] Migration prisma (`20260723142124_solicitacao_upgrade`, additiva)
- [x] `lib/cadastros.ts`: consts de tipo + label
- [x] Action pública: schema condicional por tipo (upgrade não pede endereço/telefone)
- [x] `server/comercial/cadastros.ts`: aceitar `tipo` + `planoAntigo` no input/create
- [x] Form: toggle + render condicional dos campos
- [x] Fila `CadastrosQueue`: badge UPGRADE + mostrar plano antigo → novo
- [x] tsc + eslint limpos
- [ ] Teste manual no browser (Igor) + push + deploy VPS

## 2. Escrita GLPI (interação pelo sistema)  ✅ FUNCIONANDO
Fase de escrita codada+pushada (3acbeb8). Bloqueio 403 resolvido: causa era
**perfil DEFAULT** do user de serviço (API usa o default, não o mais alto).
Fix = Perfil padrão = Super-Admin. Escrita OK (followup/criar/status/atribuir).
- [x] Escrita testada no ambiente real — funciona.
- [ ] (futuro/segurança) trocar super admin por perfil default mínimo (Followup>Add + Ticket>Update).
- [ ] (futuro) drag-and-drop no Kanban de Demandas agora é viável (escrita liberada).

## 4. Instagram: verificar coleta ao vivo + saving  ✅ FECHADO — sem bug
Time reportou dados do app ≠ plataforma. Claude da VPS bateu API LIVE × SALVO
na mesma janela (mês julho UTC): **bate tudo** (seguidores, alcance, views,
visitas perfil, engajamento, posts). Não é erro de coleta.
- [x] Fix reach: dedup via `total_value` (era somado por dia → inflava). Commit 145b6ea, EM PROD, batendo exato.
- [x] Verificado LIVE vs SALVO na PROD via Claude na VPS.
- Causa da "diferença": JANELA. Plataforma = mês fechado (UTC); app = últimos-30d móvel, fuso BR. Comparar mesma janela nos 2 lados que bate.

## 6. Demandas: toggle Lista / Kanban  ✅ FEITO (falta deploy)
`/marketing/demandas` (GlpiDemandas.tsx): toggle `.seg` Lista↔Kanban. Kanban =
colunas por status GLPI (Novo / Em atend.[2,3] / Pendente / Solucionado / Fechado),
cards read-only → detalhe. Respeita filtro de status/usuário (pra board cheio, usar "Todos").
- [x] drag-and-drop pra mudar status (escrita GLPI liberada) — override otimista + revert em erro. Falta deploy.

## 5. Relatório Marketing mais dinâmico + gerar PDF  ✅ FEITO (falta deploy)
Base = /reports de Projetos. Em `/marketing/relatorios`:
- [x] KPIs com count-up na entrada (`AnimatedStat`) + fade-up nos cards.
- [x] Barras abertas×solucionadas interativas (hover tooltip + grow) — `GlpiReportCharts.tsx`.
- [x] Botão "Gerar relatório (PDF)" → `/api/marketing/relatorios` (react-pdf, `DemandasGlpiPdf.tsx`).
- [x] tsc + eslint limpos. Commit pendente push.

## 3. Relatório de Demandas GLPI (estilo /reports Projetos)  ✅ FEITO (falta push+deploy)
Nova aba `/marketing/relatorios` no módulo Marketing. Período (PeriodPicker reutilizado)
+ KPIs (abertas/solucionadas/tempo mediano/abertas agora/paradas) + barras abertas×
solucionadas por dia/semana + por categoria + tabela por pessoa + detalhe solucionadas.
- [x] `server/glpi/report.ts`: `getGlpiActivityReport(from,to)` (só lê mirror)
- [x] Página `/marketing/relatorios` (reusa PeriodPicker, resolvePeriodo, StatCard, Card, BarsList)
- [x] Nav + breadcrumb marketing
- [x] tsc + eslint limpos
- [ ] Push + deploy VPS + teste manual
- [ ] (opcional futuro) export PDF estilo /api/relatorios/*
