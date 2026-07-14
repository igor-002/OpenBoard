// Geolocalização por IP dos scans do encurtador. Fonte primária: MaxMind
// GeoLite2 local (.mmdb — sem limite, sem chamada externa; baixar/atualizar
// com `npm run geoip:update`). Fallback: ip-api.com (free, ~45 req/min) quando
// o arquivo não existe. Sempre roda DEPOIS do redirect (after()) — falha é
// silenciosa e nunca atrasa o scan.
import { stat } from "node:fs/promises";
import { open, type Reader, type CityResponse } from "maxmind";
import { isPrivateIp } from "./ip";

export type GeoResult = {
  country: string | null;
  region: string | null;
  city: string | null;
  // Centroide da cidade (não é posição exata da pessoa) — usado no mapa de pontos.
  latitude: number | null;
  longitude: number | null;
};

// ── GeoLite2 local ───────────────────────────────────────────────────────────
const DB_PATH = process.env.GEOIP_DB_PATH || "geoip/GeoLite2-City.mmdb";
const RECHECK_MS = 60 * 60 * 1000; // revalida mtime 1x/h (update semanal sem restart)
const MISSING_RETRY_MS = 5 * 60 * 1000; // arquivo ausente: não tenta stat a cada scan

let reader: Reader<CityResponse> | null = null;
let readerMtime = 0;
let lastCheck = 0;
let missingUntil = 0;

async function getReader(): Promise<Reader<CityResponse> | null> {
  const now = Date.now();
  if (now < missingUntil) return null;
  if (reader && now - lastCheck < RECHECK_MS) return reader;
  try {
    const st = await stat(DB_PATH);
    if (!reader || st.mtimeMs !== readerMtime) {
      reader = await open<CityResponse>(DB_PATH);
      readerMtime = st.mtimeMs;
    }
    lastCheck = now;
    return reader;
  } catch {
    reader = null;
    missingUntil = now + MISSING_RETRY_MS;
    return null;
  }
}

type Names = Partial<Record<"pt-BR" | "en", string>> | undefined;
const name = (n: Names) => n?.["pt-BR"] ?? n?.en ?? null;

function lookupLocal(hit: CityResponse): GeoResult {
  return {
    country: name(hit.country?.names),
    region: name(hit.subdivisions?.[0]?.names),
    city: name(hit.city?.names),
    latitude: hit.location?.latitude ?? null,
    longitude: hit.location?.longitude ?? null,
  };
}

// ── Fallback ip-api.com ──────────────────────────────────────────────────────
// Token bucket ~40 req/min (margem sob o limite de 45) + memo por IP (TTL 1h).
const RATE_LIMIT_PER_MIN = 40;
let windowStart = 0;
let windowCount = 0;

const memo = new Map<string, { geo: GeoResult; at: number }>();
const MEMO_TTL_MS = 60 * 60 * 1000;

function takeToken(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= RATE_LIMIT_PER_MIN) return false;
  windowCount++;
  return true;
}

async function lookupIpApi(ip: string): Promise<GeoResult | null> {
  const cached = memo.get(ip);
  if (cached && Date.now() - cached.at < MEMO_TTL_MS) return cached.geo;

  if (!takeToken()) return null;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon&lang=pt-BR`,
      { signal: AbortSignal.timeout(2000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status !== "success") return null;
    const geo: GeoResult = {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
      latitude: typeof data.lat === "number" ? data.lat : null,
      longitude: typeof data.lon === "number" ? data.lon : null,
    };
    memo.set(ip, { geo, at: Date.now() });
    if (memo.size > 5000) {
      const cutoff = Date.now() - MEMO_TTL_MS;
      for (const [k, v] of memo) if (v.at < cutoff) memo.delete(k);
    }
    return geo;
  } catch {
    return null; // timeout/rede — nunca propaga (não logar o IP)
  }
}

// ── API pública ──────────────────────────────────────────────────────────────
export async function geoLookup(ip: string): Promise<GeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const r = await getReader();
  if (r) {
    try {
      const hit = r.get(ip);
      return hit ? lookupLocal(hit) : null;
    } catch {
      return null;
    }
  }
  return lookupIpApi(ip);
}
