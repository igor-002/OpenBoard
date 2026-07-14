// IP do cliente + hash LGPD. Nunca armazenar/logar o IP puro — só o hash
// (deduplicação) e o resultado da geolocalização (país/estado/cidade).
import { createHash } from "node:crypto";

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export function hashIp(ip: string): string {
  const salt = process.env.SHORT_IP_SALT || "";
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

/** IPs privados/locais não vão pra API de geolocalização. */
export function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^fc00:|^fe80:/i.test(ip)
  );
}
