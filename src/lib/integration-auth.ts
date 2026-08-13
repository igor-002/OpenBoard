import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit, registerFailure, resetRateLimit } from "@/lib/rate-limit";

function tokenMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function isHttps(request: Request): boolean {
  if (new URL(request.url).protocol === "https:") return true;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

// IP do chamador. Igual ao login: x-real-ip do nginx primeiro, senão o ÚLTIMO
// hop do XFF (o que o proxy acrescentou) — o cliente pode forjar os primeiros.
function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const hops = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  return hops[hops.length - 1]?.trim() || "desconhecido";
}

export function integrationAuthError(request: Request): 401 | 403 | 429 | null {
  // Trava força bruta no token: 5 falhas por IP na janela e o IP fica de fora.
  const key = `integration:${clientIp(request)}`;
  if (!checkRateLimit(key).ok) return 429;

  const expected = process.env.INTEGRATION_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  if (!expected || !token || !tokenMatch(token, expected)) {
    registerFailure(key);
    return 401;
  }
  resetRateLimit(key);
  if (process.env.NODE_ENV === "production" && !isHttps(request)) return 403;
  return null;
}

// Mensagem de erro por status, para as rotas responderem igual entre si.
export const INTEGRATION_AUTH_ERROR: Record<401 | 403 | 429, string> = {
  401: "unauthorized",
  403: "https_required",
  429: "too_many_requests",
};

export function integrationWorkspaceId(): string | null {
  const value = process.env.INTEGRATION_WORKSPACE_ID?.trim();
  return value || null;
}
