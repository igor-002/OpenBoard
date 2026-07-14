// Geolocalização por IP via ip-api.com (free tier: HTTP, ~45 req/min).
// Sempre chamada DEPOIS do redirect (dentro de after()) — falha é silenciosa.
import { isPrivateIp } from "./ip";

export type GeoResult = { country: string | null; region: string | null; city: string | null };

// Token bucket ~40 req/min (margem sob o limite de 45) + memo por IP (TTL 1h):
// o mesmo panfleto escaneado repetidas vezes pelo mesmo IP não gasta cota.
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

export async function geoLookup(ip: string): Promise<GeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const cached = memo.get(ip);
  if (cached && Date.now() - cached.at < MEMO_TTL_MS) return cached.geo;

  if (!takeToken()) return null;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city&lang=pt-BR`,
      { signal: AbortSignal.timeout(2000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
    };
    if (data.status !== "success") return null;
    const geo: GeoResult = {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
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
