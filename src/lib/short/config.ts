// Base da URL curta (o que vai impresso no QR). Prioridade:
// 1. SHORT_BASE_URL (prod — DEVE incluir o basePath, ex.: http://IP/openboard)
// 2. APP_URL (mesma env do reset de senha)
// 3. origin da request + basePath (ok em dev/LAN)
import "server-only";
import { headers } from "next/headers";

export async function shortBaseUrl(): Promise<string> {
  const env = process.env.SHORT_BASE_URL || process.env.APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${proto}://${host}${basePath}`;
}

/** URL curta completa de um slug — é isso que o QR codifica. */
export async function shortUrlFor(slug: string): Promise<string> {
  return `${await shortBaseUrl()}/r/${slug}`;
}
