# Roadmap — Comercial (sessão 2026-07-23)

## 🔭 Melhorias & possibilidades (backlog, não urgente)

**Quadro de Demandas (Trello-like) — evoluções:**
- [x] Reorder fino dentro da coluna — 2026-07-28.
- [x] Colunas customizáveis (add/renomear/mover/excluir + DnD) — 2026-07-28.
- [x] Vincular card GLPI por autocomplete do espelho — 2026-07-28.
- [x] Filtro por etiqueta / responsável — 2026-07-28.
- [x] Unificação via toggle "Status GLPI" (substitui a ideia de sync coluna→status;
  na visão Status GLPI arrastar já muda o status no GLPI) — 2026-07-28.
- [ ] DnD touch/mobile (hoje só desktop — HTML5 drag nativo não pega touch).
- [ ] (opção) mapear coluna→status GLPI também na visão Fluxo do time.

**Kanban de status GLPI (/marketing/demandas):**
- [x] Bloquear "Novo" como destino de arraste — 2026-07-28.
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
- [x] Reorder dentro da coluna (drop na posição do cursor) — 2026-07-28.
- [x] Colunas customizáveis: add/renomear/mover(botões)/excluir(só vazia) + DnD de coluna — 2026-07-28.
- [x] Filtro por etiqueta + responsável no quadro — 2026-07-28.
- [x] Vincular card GLPI por autocomplete no espelho — 2026-07-28.
- [x] Marcação visual de card GLPI (faixa colorida por status) — 2026-07-28.
- [x] Toast ao mover card — 2026-07-28.
- [x] UNIFICAÇÃO: toggle "Status GLPI" no quadro (reagrupa cards GLPI por status, DnD escreve no GLPI) — 2026-07-28.
- [ ] **FASE 3 — DEFERIDA** anexo do card → espelhar no GLPI. Contrato de upload da API v2.1
      não está documentado no repo + testar escreve em ticket de produção. Precisa endpoint + ticket de teste.
- [ ] DnD touch/mobile (hoje só desktop). Mapeamento opcional coluna→status GLPI na visão Fluxo.


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

## 9. Pedidos do marketing (2026-07-28)  🔨 FEITO (falta migrar + testar + deploy)
Vieram de `demandas/marketing/` (3 prints + descricao.md).
- [x] **Solicitante correto no chamado criado pelo app.** Era bug: o GLPI ignora
  `user_recipient` no POST e grava o usuário AUTENTICADO (integracaomkt). Certo é
  `POST /Assistance/Ticket/{id}/TeamMember {type:"User", id, role:"requester"}`.
  Efeito colateral do bug: sem requerente rastreado no team, `attributedTrackedId`
  devolve null e o chamado SOME do espelho no próximo full sync.
- [x] Escolher o **responsável já na abertura** (mesmo endpoint, role `assigned`).
- [x] **Prioridade** na escala cheia do GLPI (1..5; faltava "Muito baixa"). Manda
  `urgency` + `priority` (o GLPI normalmente recalcula por urgency × impact).
- [x] **Prazo de conclusão** (`GlpiTicket.dueAt` + `dueSetById`, migração
  `20260728143000_glpi_ticket_due`): definir na criação e no detalhe, badge na
  lista/kanban/detalhe, alerta no scheduler de 6h (`alertGlpiPrazos`, vencido ou ≤2d).
  Vive SÓ no espelho: o schema Ticket da v2.1 **não tem** `time_to_resolve`/`due_date`
  (só SLA, que esta instância não usa — `sla_ttr` nulo). Definir prazo posta um
  acompanhamento no chamado pra quem acompanha pelo GLPI ver.
- [x] "Quem abriu / quem recebeu" no topo do chamado — já existia; passa a ficar
  correto agora que o create grava requester + assigned.
- [ ] **Categoria de serviço — BLOQUEADA.** A v2.1 não expõe ITILCategory
  (`/Dropdowns/` só tem Location, State, Manufacturer, Calendar; todas as rotas
  ITILCategory dão 404). GraphQL existe mas responde 403 (`ERROR_RIGHT_MISSING` —
  falta scope no Cliente OAuth). `apirest.php` v1 está ligado mas exige `app_token`.
  Destravar = liberar o scope de GraphQL no cliente OAuth **ou** gerar um App-Token.
- [ ] Rodar a migração (Docker local estava parado — SQL escrito à mão, aditivo),
  testar no browser, push e deploy.
- [ ] Chamados JÁ criados pelo app estão órfãos (sem requester rastreado) e somem
  no próximo full sync. Ex.: #36758. Precisa backfill do TeamMember requester.

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
