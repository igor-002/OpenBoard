import "server-only";

// ─────────────────────────────────────────────────────────────────
// Cliente HTTP da Instagram Platform (variante "Login do Instagram",
// sem Página do Facebook). Portado de openmarketing/lib/instagram/client.ts
// — ver docs/HANDOFF-OPENBOARD.md §4 pras armadilhas descobertas na prática.
//
// Módulo puro (sem Prisma) — só fala com graph.instagram.com.
// Quem orquestra coleta e persistência é server/marketing/instagram-sync.ts.
// ─────────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.instagram.com";
const API_VERSION = "v25.0";

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly type?: string,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; type?: string };
}

async function igGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(
    path.startsWith("http") ? path : `${GRAPH_BASE}/${API_VERSION}/${path}`,
  );
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & MetaErrorBody;

  if (!res.ok || body.error) {
    const err = body.error;
    throw new InstagramApiError(
      err?.message ?? `Instagram API respondeu HTTP ${res.status}`,
      err?.code,
      err?.type,
    );
  }
  return body;
}

// ── Perfil ───────────────────────────────────────────────────────

export interface IgProfile {
  igUserId: string;
  username: string;
  followersCount: number;
  mediaCount: number;
}

/** Valida o token e retorna dados básicos do perfil (inclui snapshot de seguidores). */
export async function fetchProfile(accessToken: string): Promise<IgProfile> {
  const data = await igGet<{
    user_id?: string;
    id?: string;
    username: string;
    followers_count?: number;
    media_count?: number;
  }>("me", {
    fields: "user_id,username,followers_count,media_count",
    access_token: accessToken,
  });
  return {
    igUserId: String(data.user_id ?? data.id),
    username: data.username,
    followersCount: data.followers_count ?? 0,
    mediaCount: data.media_count ?? 0,
  };
}

// ── Insights de conta ────────────────────────────────────────────

interface InsightsResponse {
  data: {
    name: string;
    period: string;
    values?: { value: number; end_time?: string }[];
    total_value?: { value: number };
  }[];
}

/**
 * Soma de uma métrica de conta na janela [since, until] (unix seconds).
 * Tenta série diária; se a métrica só existir como total agregado
 * (caso de profile_views/views em versões recentes), refaz com
 * metric_type=total_value. Retorna null se a métrica não existir
 * para a conta (ex.: <100 seguidores) — o sync pula sem falhar.
 */
export async function fetchAccountMetricSum(
  igUserId: string,
  accessToken: string,
  metric: string,
  since: number,
  until: number,
): Promise<number | null> {
  const base = {
    metric,
    period: "day",
    since: String(since),
    until: String(until),
    access_token: accessToken,
  };
  let firstAttempt: number | null = null;
  try {
    const res = await igGet<InsightsResponse>(`${igUserId}/insights`, base);
    firstAttempt = sumInsights(res);
  } catch (err) {
    if (!(err instanceof InstagramApiError)) throw err;
  }
  if (firstAttempt !== null) return firstAttempt;

  // Métricas como views/profile_views não têm série diária: a API
  // responde 200 com data vazio (ou erro). Refaz como total agregado.
  try {
    const res = await igGet<InsightsResponse>(`${igUserId}/insights`, {
      ...base,
      metric_type: "total_value",
    });
    return sumInsights(res);
  } catch (err) {
    if (err instanceof InstagramApiError) return null;
    throw err;
  }
}

function sumInsights(res: InsightsResponse): number | null {
  const entry = res.data?.[0];
  if (!entry) return null;
  if (entry.values?.length)
    return entry.values.reduce((acc, v) => acc + (v.value ?? 0), 0);
  if (entry.total_value) return entry.total_value.value ?? 0;
  return null;
}

interface BreakdownResponse {
  data: {
    total_value?: {
      value?: number;
      breakdowns?: {
        results?: { dimension_values: string[]; value: number }[];
      }[];
    };
  }[];
}

/**
 * Total de uma métrica quebrado por dimensão na janela [since, until].
 * Ex.: metric "views" com breakdown "follow_type" (FOLLOWER /
 * NON_FOLLOWER / UNKNOWN) ou "media_product_type" (REEL / STORY /
 * POST / CAROUSEL_CONTAINER...). Retorna mapa dimensão → valor;
 * vazio se a conta não expõe o breakdown.
 */
export async function fetchMetricBreakdown(
  igUserId: string,
  accessToken: string,
  metric: string,
  breakdown: string,
  since: number,
  until: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const res = await igGet<BreakdownResponse>(`${igUserId}/insights`, {
      metric,
      period: "day",
      metric_type: "total_value",
      breakdown,
      since: String(since),
      until: String(until),
      access_token: accessToken,
    });
    const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of results) {
      const key = r.dimension_values?.[0];
      if (key) out.set(key, (out.get(key) ?? 0) + (r.value ?? 0));
    }
  } catch (err) {
    if (!(err instanceof InstagramApiError)) throw err;
  }
  return out;
}

// ── Mídias ───────────────────────────────────────────────────────

export interface IgMedia {
  id: string;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  likeCount: number;
  commentsCount: number;
  timestamp: string; // ISO 8601
}

/**
 * Lista mídias da conta publicadas a partir de `sinceIso`, paginando
 * até esgotar ou cruzar a data-limite (a API retorna do mais recente
 * ao mais antigo).
 */
export async function fetchMediaSince(
  igUserId: string,
  accessToken: string,
  sinceIso: string,
): Promise<IgMedia[]> {
  const collected: IgMedia[] = [];
  let url: string | null = `${GRAPH_BASE}/${API_VERSION}/${igUserId}/media`;
  let params: Record<string, string> | null = {
    fields: "id,media_type,like_count,comments_count,timestamp",
    limit: "100",
    access_token: accessToken,
  };

  while (url) {
    const page: {
      data?: {
        id: string;
        media_type: string;
        like_count?: number;
        comments_count?: number;
        timestamp: string;
      }[];
      paging?: { next?: string };
    } = await igGet(url, params ?? {});

    let crossedLimit = false;
    for (const m of page.data ?? []) {
      if (m.timestamp < sinceIso) {
        crossedLimit = true;
        break;
      }
      collected.push({
        id: m.id,
        mediaType: m.media_type,
        likeCount: m.like_count ?? 0,
        commentsCount: m.comments_count ?? 0,
        timestamp: m.timestamp,
      });
    }
    if (crossedLimit) break;
    url = page.paging?.next ?? null;
    params = null; // next já vem com query string completa
  }
  return collected;
}

// ── Renovação de token ───────────────────────────────────────────

export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Renova um token de longa duração (válido se tiver >24h de vida e
 * <60 dias). Não requer app secret na variante Login do Instagram.
 */
export async function refreshLongLivedToken(
  accessToken: string,
): Promise<RefreshedToken> {
  const data = await igGet<{ access_token: string; expires_in: number }>(
    `${GRAPH_BASE}/refresh_access_token`,
    { grant_type: "ig_refresh_token", access_token: accessToken },
  );
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
