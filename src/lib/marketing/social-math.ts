import { computeDelta, type Delta } from "@/lib/marketing/metrics";
import type {
  CompanySocialData,
  MetricRow,
  SocialMetricName,
} from "@/server/marketing/social-source";

// Cálculos de agregação dos dashboards de redes sociais. Portado de
// openmarketing/lib/social-math.ts (ver docs/HANDOFF-OPENBOARD.md §3).
// "Agregado" = soma das contas selecionadas no período.

export const SOCIAL_METRIC_LABELS: Record<SocialMetricName, string> = {
  followers: "Seguidores",
  reach: "Alcance",
  impressions: "Visualizações",
  profile_views: "Visitas ao perfil",
  engagement: "Engajamento",
  posts_count: "Posts publicados",
};

export const SOCIAL_METRIC_HINTS: Record<SocialMetricName, string> = {
  followers: "Total de seguidores ao fim do mês",
  reach: "Contas únicas alcançadas no mês",
  impressions: "Vezes que o conteúdo foi reproduzido ou exibido",
  profile_views: "Visitas à página do perfil no mês",
  engagement: "Curtidas e comentários dos posts do mês",
  posts_count: "Publicações feitas no mês",
};

export const SOCIAL_METRICS_ORDER: SocialMetricName[] = [
  "followers",
  "reach",
  "impressions",
  "engagement",
  "profile_views",
  "posts_count",
];

function sumMetric(
  rows: MetricRow[],
  accountIds: string[],
  period: string,
  metric: SocialMetricName
): number {
  return sumMetricOrNull(rows, accountIds, period, metric) ?? 0;
}

/**
 * Soma da métrica, ou null quando NÃO há linha alguma no período —
 * distingue "valor zero" de "métrica não coletada" (ex.: followers em
 * meses de backfill: a API só expõe o valor atual de seguidores).
 */
function sumMetricOrNull(
  rows: MetricRow[],
  accountIds: string[],
  period: string,
  metric: SocialMetricName
): number | null {
  const matching = rows.filter(
    (r) =>
      r.period === period &&
      r.metricName === metric &&
      accountIds.includes(r.accountId)
  );
  if (matching.length === 0) return null;
  return matching.reduce((acc, r) => acc + r.value, 0);
}

export interface SocialKpi {
  metric: SocialMetricName;
  label: string;
  hint: string;
  delta: Delta;
  /** true quando a métrica não foi coletada no período (ex.: followers em backfill) */
  missing: boolean;
}

/** KPIs do período com delta vs mês anterior, para as contas dadas */
export function socialKpis(
  data: CompanySocialData,
  accountIds: string[],
  period: string,
  prevPeriod: string
): SocialKpi[] {
  return SOCIAL_METRICS_ORDER.map((metric) => {
    const current = sumMetricOrNull(data.metrics, accountIds, period, metric);
    const hasPrev = data.months.includes(prevPeriod);
    const previous = hasPrev
      ? sumMetricOrNull(data.metrics, accountIds, prevPeriod, metric)
      : null;
    return {
      metric,
      label: SOCIAL_METRIC_LABELS[metric],
      hint: SOCIAL_METRIC_HINTS[metric],
      delta: computeDelta(current ?? 0, previous),
      missing: current === null,
    };
  });
}

/**
 * Série mensal de uma métrica. Uma coluna por conta (username) +
 * "total" agregado, para o gráfico de evolução.
 */
export function metricSeries(
  data: CompanySocialData,
  accountIds: string[],
  metric: SocialMetricName
): Array<Record<string, number | string | null>> {
  return data.months.map((period) => {
    const row: Record<string, number | string | null> = { period };
    let total: number | null = null;
    for (const acc of data.company.accounts) {
      if (!accountIds.includes(acc.id)) continue;
      // null = não coletado no mês → vira lacuna no gráfico, não zero
      const v = sumMetricOrNull(data.metrics, [acc.id], period, metric);
      row[acc.username] = v;
      if (v !== null) total = (total ?? 0) + v;
    }
    row.total = total;
    return row;
  });
}

/** Engajamento do período por conta (barras horizontais do modo agregado) */
export function engagementByAccount(
  data: CompanySocialData,
  period: string
): Array<{ username: string; displayName: string; engagement: number }> {
  return data.company.accounts
    .map((acc) => ({
      username: acc.username,
      displayName: acc.displayName,
      engagement: sumMetric(data.metrics, [acc.id], period, "engagement"),
    }))
    .sort((a, b) => b.engagement - a.engagement);
}

/** Distribuição de tipos de mídia no período */
export function mediaTypeBreakdown(
  data: CompanySocialData,
  accountIds: string[],
  period: string
): Array<{ mediaType: string; label: string; count: number }> {
  const labels: Record<string, string> = {
    IMAGE: "Imagens",
    VIDEO: "Vídeos",
    CAROUSEL_ALBUM: "Carrosséis",
  };
  const totals = new Map<string, number>();
  for (const s of data.mediaStats) {
    if (s.period !== period || !accountIds.includes(s.accountId)) continue;
    totals.set(s.mediaType, (totals.get(s.mediaType) ?? 0) + s.count);
  }
  return ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].map((t) => ({
    mediaType: t,
    label: labels[t] ?? t,
    count: totals.get(t) ?? 0,
  }));
}

// ── Breakdowns de visualizações (espelham "Insights sobre a conta"
// do app do Instagram). Gravados pelo sync como métricas prefixadas:
// views_follow:FOLLOWER, views_media:REEL, etc.

const VIEWS_FOLLOW_PREFIX = "views_follow:";
const VIEWS_MEDIA_PREFIX = "views_media:";

const FOLLOW_LABELS: Record<string, string> = {
  FOLLOWER: "Seguidores",
  NON_FOLLOWER: "Não seguidores",
  UNKNOWN: "Indefinido",
};

const MEDIA_PRODUCT_LABELS: Record<string, string> = {
  REEL: "Reels",
  STORY: "Stories",
  POST: "Posts",
  CAROUSEL_CONTAINER: "Carrosséis",
  VIDEO: "Vídeos",
  AD: "Anúncios",
};

export interface BreakdownSlice {
  key: string;
  label: string;
  value: number;
  /** Fração do total (0–1) */
  pct: number;
}

function prefixBreakdown(
  data: CompanySocialData,
  accountIds: string[],
  period: string,
  prefix: string,
  labels: Record<string, string>
): BreakdownSlice[] {
  const totals = new Map<string, number>();
  for (const r of data.metrics) {
    if (
      r.period !== period ||
      !r.metricName.startsWith(prefix) ||
      !accountIds.includes(r.accountId)
    )
      continue;
    const key = r.metricName.slice(prefix.length);
    totals.set(key, (totals.get(key) ?? 0) + r.value);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals]
    .map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      value,
      pct: sum > 0 ? value / sum : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Visualizações por origem: seguidores × não seguidores. Vazio se o período não tem dados reais. */
export function viewsByFollowType(
  data: CompanySocialData,
  accountIds: string[],
  period: string
): BreakdownSlice[] {
  return prefixBreakdown(data, accountIds, period, VIEWS_FOLLOW_PREFIX, FOLLOW_LABELS);
}

/** Visualizações por tipo de conteúdo: Reels, Stories, Posts... Vazio se o período não tem dados reais. */
export function viewsByMediaProduct(
  data: CompanySocialData,
  accountIds: string[],
  period: string
): BreakdownSlice[] {
  return prefixBreakdown(data, accountIds, period, VIEWS_MEDIA_PREFIX, MEDIA_PRODUCT_LABELS);
}

/** Linha da tabela de perfis: seguidores + delta + engajamento do período */
export function accountsTable(
  data: CompanySocialData,
  period: string,
  prevPeriod: string
): Array<{
  id: string;
  username: string;
  displayName: string;
  followers: Delta;
  followersMissing: boolean;
  engagement: number;
  posts: number;
}> {
  const hasPrev = data.months.includes(prevPeriod);
  return data.company.accounts.map((acc) => {
    const followersNow = sumMetricOrNull(
      data.metrics,
      [acc.id],
      period,
      "followers"
    );
    const followersPrev = hasPrev
      ? sumMetricOrNull(data.metrics, [acc.id], prevPeriod, "followers")
      : null;
    return {
      id: acc.id,
      username: acc.username,
      displayName: acc.displayName,
      followers: computeDelta(followersNow ?? 0, followersPrev),
      followersMissing: followersNow === null,
      engagement: sumMetric(data.metrics, [acc.id], period, "engagement"),
      posts: sumMetric(data.metrics, [acc.id], period, "posts_count"),
    };
  });
}
