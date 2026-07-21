// Cliente da API GLPI 11 — V2.1 (High-Level, OAuth2). Server-only (usa segredos:
// client_secret + senha do usuário de serviço). Toda a lógica/armadilhas vêm de
// glpi-api-v2-integracao.md.
//
// Auth: OAuth2 password grant → access_token (1h) + refresh_token. O token é
// cacheado em memória (globalThis, sobrevive HMR) e renovado ~5min antes de expirar
// via refresh_token; se o refresh falhar, cai pro password grant.
//
// NUNCA chamar o GLPI do frontend (expõe segredos + CORS) — só via este módulo.
import "server-only";

// ── Config (env) ─────────────────────────────────────────────────────────────
const URL_BASE = (process.env.GLPI_URL ?? "").replace(/\/$/, "");
const CLIENT_ID = process.env.GLPI_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GLPI_CLIENT_SECRET ?? "";
const USERNAME = process.env.GLPI_USERNAME ?? "";
const PASSWORD = process.env.GLPI_PASSWORD ?? "";

// Fixar a versão no path (doc §1): sem versão o GLPI usa "a mais nova" e um upgrade
// futuro pode quebrar a integração.
const API = `${URL_BASE}/api.php/v2.1`;
const TOKEN_URL = `${URL_BASE}/api.php/token`;

// IDs dos usuários do GLPI cujos chamados (como autor) contam como "demanda do
// marketing". Ex.: "40,41,43,60" (wesley, vinicius, atila, breno).
export const TRACKED_USER_IDS = (process.env.GLPI_TRACKED_USER_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

export function glpiConfigured(): boolean {
  return Boolean(URL_BASE && CLIENT_ID && CLIENT_SECRET && USERNAME && PASSWORD && TRACKED_USER_IDS.length);
}

// ── Erros ────────────────────────────────────────────────────────────────────
export class GlpiError extends Error {
  constructor(public status: number, public where: string, detail?: string) {
    super(`GLPI ${where} → ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "GlpiError";
  }
}

// ── Token cache (OAuth2) ─────────────────────────────────────────────────────
type TokenCache = { accessToken: string; refreshToken: string; expiresAt: number };
const TKEY = Symbol.for("openboard.glpiToken");

function getCache(): TokenCache | null {
  return (globalThis as Record<symbol, unknown>)[TKEY] as TokenCache | null;
}
function setCache(c: TokenCache | null): void {
  (globalThis as Record<symbol, unknown>)[TKEY] = c;
}

type TokenResp = { access_token: string; refresh_token: string; expires_in: number };

async function requestToken(body: Record<string, string>): Promise<TokenCache> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new GlpiError(504, "token", (e as Error).message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new GlpiError(res.status, "token", txt.slice(0, 200));
  }
  const j = (await res.json()) as TokenResp;
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.now() + (j.expires_in || 3600) * 1000,
  };
}

async function getToken(): Promise<string> {
  const cache = getCache();
  // Válido com folga de 5min (doc §8).
  if (cache && Date.now() < cache.expiresAt - 300_000) return cache.accessToken;

  // Tenta renovar via refresh_token; se falhar, volta pro password grant.
  if (cache?.refreshToken) {
    try {
      const c = await requestToken({
        grant_type: "refresh_token",
        refresh_token: cache.refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "api",
      });
      setCache(c);
      return c.accessToken;
    } catch {
      // cai pro password grant abaixo
    }
  }
  const c = await requestToken({
    grant_type: "password",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "api",
    username: USERNAME,
    password: PASSWORD,
  });
  setCache(c);
  return c.accessToken;
}

// ── fetch bruto autenticado ──────────────────────────────────────────────────
async function glpiFetch(path: string, qs: URLSearchParams): Promise<Response> {
  if (!glpiConfigured()) throw new GlpiError(401, path, "GLPI não configurado (env GLPI_* ausentes)");
  const token = await getToken();
  const url = qs.toString() ? `${API}${path}?${qs.toString()}` : `${API}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Accept-Language": "pt_BR" },
      cache: "no-store",
    });
  } catch (e) {
    throw new GlpiError(504, path, (e as Error).message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new GlpiError(res.status, path, txt.slice(0, 200));
  }
  return res;
}

// ── GET coleção (uma página) ─────────────────────────────────────────────────
// ATENÇÃO: esta instância IGNORA `range` (query e header) — sempre devolve os
// primeiros 100 e Content-Range "0-99/total". A paginação real é via `start`/
// `limit` (query), documentados no OpenAPI. O `range` do doc §3 é legado/errado.
export type GlpiListOpts = { filter?: string; fields?: string; start?: number; limit?: number };

export async function glpiGet<T = unknown>(
  path: string,
  opts: GlpiListOpts = {},
): Promise<{ data: T[]; total: number }> {
  const qs = new URLSearchParams();
  if (opts.filter) qs.set("filter", opts.filter);
  if (opts.fields) qs.set("fields", opts.fields);
  qs.set("start", String(opts.start ?? 0));
  qs.set("limit", String(opts.limit ?? 100));

  const res = await glpiFetch(path, qs);
  const cr = res.headers.get("content-range") || "";
  const total = Number(cr.split("/")[1] ?? NaN);
  const data = (await res.json()) as T[];
  return {
    data: Array.isArray(data) ? data : [],
    total: Number.isFinite(total) ? total : (Array.isArray(data) ? data.length : 0),
  };
}

// ── GET recurso único (/Tipo/{id}) — devolve objeto, não coleção ─────────────
export async function glpiGetOne<T = unknown>(path: string, fields?: string): Promise<T | null> {
  const qs = new URLSearchParams();
  if (fields) qs.set("fields", fields);
  const res = await glpiFetch(path, qs);
  const json = await res.json();
  if (json == null) return null;
  if (Array.isArray(json)) return (json[0] as T) ?? null;
  return json as T;
}

// ── GET todas as páginas (start/limit) ───────────────────────────────────────
export async function glpiGetAll<T = unknown>(
  path: string,
  opts: Omit<GlpiListOpts, "start" | "limit"> = {},
  pageSize = 100,
): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  let total = Infinity;
  do {
    const { data, total: t } = await glpiGet<T>(path, { ...opts, start, limit: pageSize });
    out.push(...data);
    total = t;
    if (data.length < pageSize) break; // última página (protege contra total mentiroso)
    start += pageSize;
  } while (start < total);
  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// GLPI manda datas ISO8601 com fuso (ex.: "2026-04-14T14:00:02-03:00"). Parse direto.
export function glpiDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}
