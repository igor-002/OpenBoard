# Handoff — Verificar coleta Instagram (LIVE vs SALVO) na PRODUÇÃO

## Contexto
OpenBoard (Next.js). Módulo Marketing tem integração Instagram: um job sincroniza
métricas da conta pra tabelas locais que os dashboards leem. Time reportou que os
números do **app do Instagram divergem da plataforma**. Preciso confirmar se a API
está puxando certo AO VIVO e se está SALVANDO certo. Os tokens/dados reais só
existem no banco de PRODUÇÃO (o banco de dev está vazio).

## Pipeline (arquivos-chave)
- `src/lib/marketing/instagram-client.ts` — cliente puro da Graph API (graph.instagram.com v25.0).
- `src/server/marketing/instagram-sync.ts` — orquestra coleta e grava. `syncAccount()` é o núcleo.
- `src/server/marketing/social-source.ts` — o que os dashboards LEEM (tabelas `AccountMetricsHistory` + `MediaTypeStats`).
- `src/server/marketing/scheduler.ts` — cron in-process, sync a cada `MARKETING_SYNC_INTERVAL_MIN` (default 360min/6h).
- Tabelas: `InstagramAccount` (token AES-GCM em repouso, chave `TOKEN_ENC_KEY`), `AccountMetricsHistory` (accountId, metricName, value, period "YYYY-MM"), `MediaTypeStats`.
- Sync manual existe: `runManualMarketingSyncAction()` em `src/app/(marketing)/marketing/social/contas/actions.ts`.

## Como a coleta funciona (semântica — importante)
- Janela = **mês-calendário em UTC** (`periodWindow` em instagram-sync.ts). Decisão do Igor: MANTER mês-calendário.
- O **app do Instagram** não tem "mês"; mostra janelas móveis (últimos 7/30/90 dias) no fuso da conta (UTC−3). Então diferença app×plataforma por causa da JANELA é ESPERADA. Não é bug.
- Métricas gravadas por período: `followers` (só mês corrente, snapshot atual), `reach`, `impressions` (=API "views"), `profile_views`, `engagement` (likes+comentários das mídias do mês), `posts_count`, e breakdowns `views_follow:*` / `views_media:*`.

## Fix já aplicado (commit 145b6ea — garantir que a PROD tem esse código)
- **reach** agora é pego com `metric_type=total_value` (total deduplicado do período), NÃO mais soma da série `period=day`. Somar diário contava a mesma pessoa em cada dia e INFLAVA o reach vs o app. `views`/`impressions`/`profile_views` seguem somando (são aditivas). Confirme que a prod foi deployada com esse commit antes de comparar reach.

## Tarefa
1. Garantir que a prod está no commit ≥ `145b6ea` (senão o reach ainda vem inflado).
2. Escrever um diagnóstico (rota admin OU script tsx no repo — `server-only` funciona no contexto do app) que, por conta ATIVA com token:
   - Descriptografa o token (`decryptToken` de `src/lib/marketing/token-crypto.ts`).
   - Chama a API AO VIVO pra janela do MÊS CORRENTE (mesma `periodWindow`): `fetchProfile` (followers, media_count), `fetchAccountMetricSum` reach(aggregate=true)/views/profile_views, `fetchMediaSince` → engagement + posts.
   - Lê o SALVO: `AccountMetricsHistory` do período corrente + `MediaTypeStats`.
   - Imprime lado a lado **LIVE vs SALVO** por métrica, + idade do `lastSyncAt`, validade do `tokenExpiresAt`, e qualquer `InstagramApiError`.
3. Rodar um `syncInstagramAccounts()` manual e reconferir que o SALVO passou a bater com o LIVE (idempotência: `replacePeriodSnapshot` apaga+regrava o período).
4. Reportar: quais métricas batem, quais divergem, e se a divergência restante é só JANELA (mês vs últimos-30d do app) ou algo real.

## Checagens de sanidade
- Token expirado/perto de vencer? (renova sozinho <10 dias via `refreshLongLivedToken`, mas confirmar.)
- `lastSyncAt` muito velho? cron pode não estar rodando na prod (verificar log `[marketing-sync-cron]` no container; standalone precisa do `instrumentation.ts` no boot).
- Conta com <100 seguidores: insights podem vir null (esperado, sync pula).
- Comparar sempre a MESMA janela: pra bater com o app, olhe "últimos 30 dias" no app OU calcule o mês fechado nos dois lados. Não comparar "mês" (plataforma) com "últimos 30d" (app) e achar que é bug.

## Regras do projeto
- Sem dado inventado (só real do banco/API). Nunca commitar segredos. Responder em PT-BR.
