import { db } from "@/lib/db";
import { currentPeriod } from "@/lib/marketing/format";
import { encryptToken, decryptToken } from "@/lib/marketing/token-crypto";
import {
  fetchAccountMetricSum,
  fetchMediaSince,
  fetchMetricBreakdown,
  fetchProfile,
  refreshLongLivedToken,
  type IgMedia,
} from "@/lib/marketing/instagram-client";

// ─────────────────────────────────────────────────────────────────
// Coleta de métricas reais do Instagram → mesmas tabelas que os
// dashboards leem (AccountMetricsHistory / MediaTypeStats). Portado de
// openmarketing/lib/instagram/sync.ts — ver docs/HANDOFF-OPENBOARD.md §4/§5.
// Rodado pelo scheduler in-process (server/marketing/scheduler.ts).
// ─────────────────────────────────────────────────────────────────

/** Renova o token antes de vencer quando faltam menos que isso. */
const REFRESH_WINDOW_DAYS = 10;

export interface AccountSyncResult {
  username: string;
  status: "ok" | "sem_token" | "erro";
  tokenRenovado?: boolean;
  metricas?: Record<string, number>;
  erro?: string;
}

/** Janela [início do mês, agora ou fim do mês] do período "YYYY-MM". */
function periodWindow(period: string): { since: Date; until: Date } {
  const [y, m] = period.split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 1));
  const now = new Date();
  return { since, until: now < endOfMonth ? now : endOfMonth };
}

/**
 * Substitui o snapshot do período: apaga TODAS as linhas da conta no
 * período antes de gravar as reais. Sem isso, categorias que sumiram de
 * uma coleta anterior sobreviveriam ao upsert e se misturariam aos dados
 * novos. Isso é o que dá idempotência ao sync (rodar N vezes dá no mesmo).
 */
async function replacePeriodSnapshot(
  accountId: string,
  period: string,
  metricas: Record<string, number>,
  mediaCounts: Map<string, number>,
) {
  await db.$transaction([
    db.accountMetricsHistory.deleteMany({ where: { accountId, period } }),
    db.mediaTypeStats.deleteMany({ where: { accountId, period } }),
    db.accountMetricsHistory.createMany({
      data: Object.entries(metricas).map(([metricName, value]) => ({
        accountId,
        metricName,
        value,
        period,
      })),
    }),
    db.mediaTypeStats.createMany({
      data: [...mediaCounts].map(([mediaType, count]) => ({
        accountId,
        mediaType,
        count,
        period,
      })),
    }),
  ]);
}

function mediaTypeCounts(media: IgMedia[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of media)
    counts.set(m.mediaType, (counts.get(m.mediaType) ?? 0) + 1);
  return counts;
}

/**
 * Sincroniza todas as contas ativas que já têm token registrado (via
 * tela de admin "Conectar conta do Instagram"). Contas sem token são
 * puladas — a quantidade de perfis é flexível, nunca assumir um número fixo.
 */
export async function syncInstagramAccounts(
  period = currentPeriod(),
): Promise<AccountSyncResult[]> {
  const accounts = await db.instagramAccount.findMany({
    where: { active: true },
    orderBy: { username: "asc" },
  });

  const results: AccountSyncResult[] = [];
  for (const account of accounts) {
    if (!account.accessToken || !account.igUserId) {
      results.push({ username: account.username, status: "sem_token" });
      continue;
    }
    try {
      results.push(await syncAccount(account.id, period));
    } catch (err) {
      results.push({
        username: account.username,
        status: "erro",
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

async function syncAccount(
  accountId: string,
  period: string,
): Promise<AccountSyncResult> {
  const account = await db.instagramAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  let token = decryptToken(account.accessToken!); // em repouso vem criptografado (AES-GCM)
  let tokenRenovado = false;

  // Renovação automática: token de longa duração vale 60 dias.
  const refreshDeadline = new Date(
    Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  if (account.tokenExpiresAt && account.tokenExpiresAt < refreshDeadline) {
    const renewed = await refreshLongLivedToken(token);
    token = renewed.accessToken;
    tokenRenovado = true;
    await db.instagramAccount.update({
      where: { id: account.id },
      data: { accessToken: encryptToken(token), tokenExpiresAt: renewed.expiresAt },
    });
  }

  const { since, until } = periodWindow(period);
  const sinceUnix = Math.floor(since.getTime() / 1000);
  const untilUnix = Math.floor(until.getTime() / 1000);

  // 1. Snapshot de seguidores (valor atual, não série).
  const profile = await fetchProfile(token);

  // 2. Insights de conta somados no mês. A métrica "impressions" foi
  //    removida da API (v22+) — "views" é a sucessora e alimenta a
  //    coluna impressions do painel. Breakdowns de views espelham a
  //    tela "Insights sobre a conta" do app (origem e tipo de conteúdo);
  //    viram métricas prefixadas views_follow:* / views_media:*.
  const [reach, views, profileViews, viewsByFollow, viewsByMedia] =
    await Promise.all([
      // reach = contas ÚNICAS → total agregado deduplicado (aggregate=true),
      // NUNCA soma da série diária (infla, conta a mesma pessoa por dia).
      fetchAccountMetricSum(profile.igUserId, token, "reach", sinceUnix, untilUnix, true),
      fetchAccountMetricSum(profile.igUserId, token, "views", sinceUnix, untilUnix),
      fetchAccountMetricSum(profile.igUserId, token, "profile_views", sinceUnix, untilUnix),
      fetchMetricBreakdown(profile.igUserId, token, "views", "follow_type", sinceUnix, untilUnix),
      fetchMetricBreakdown(profile.igUserId, token, "views", "media_product_type", sinceUnix, untilUnix),
    ]);

  // 3. Mídias do mês → engajamento (likes+comentários), posts e donut.
  const media = await fetchMediaSince(
    profile.igUserId,
    token,
    since.toISOString(),
  );
  const monthMedia = media.filter(
    (m) => m.timestamp >= since.toISOString() && m.timestamp < until.toISOString(),
  );
  const engagement = monthMedia.reduce(
    (acc, m) => acc + m.likeCount + m.commentsCount,
    0,
  );

  // followers_count é sempre o valor ATUAL — só vale como snapshot do
  // mês corrente. Em backfill de meses passados a métrica fica ausente
  // (a API não expõe histórico de seguidores).
  const metricas: Record<string, number> = {
    engagement,
    posts_count: monthMedia.length,
  };
  if (period === currentPeriod()) metricas.followers = profile.followersCount;
  if (reach !== null) metricas.reach = reach;
  if (views !== null) metricas.impressions = views;
  if (profileViews !== null) metricas.profile_views = profileViews;
  for (const [dim, value] of viewsByFollow)
    metricas[`views_follow:${dim}`] = value;
  for (const [dim, value] of viewsByMedia)
    metricas[`views_media:${dim}`] = value;

  await replacePeriodSnapshot(
    account.id,
    period,
    metricas,
    mediaTypeCounts(monthMedia),
  );

  await db.instagramAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  });

  return { username: account.username, status: "ok", tokenRenovado, metricas };
}
