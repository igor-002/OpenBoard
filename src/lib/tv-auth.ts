// Gate de token do painel de TV (kiosk). As rotas /tv e /api/tv são liberadas no
// proxy (sem sessão), então a proteção real do dado é ESTE token.
//
// Dois formatos aceitos:
//  1) JWT assinado (novo) — gerado pelo botão "Abrir TV", com escopo + validade 90d.
//     Sem segredo fixo pra vazar; expira sozinho.
//  2) TV_TOKEN fixo do env (legado) — compat com links antigos; qualquer escopo.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export type TvScope = "projetos" | "comercial";

// Mesmo segredo da sessão (já obrigatório e forte — ver jwt.ts). Falha-fechado.
const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error("AUTH_SECRET ausente ou muito curto (necessário p/ assinar token de TV).");
}
const secret = new TextEncoder().encode(rawSecret);

const TV_TOKEN_TTL = "90d"; // aparelho fixo: link de longa duração

// Compara em tempo constante (hash de tamanho fixo evita vazar o comprimento).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Assina um token de TV com escopo (projetos|comercial) e validade de 90 dias.
export async function signTvToken(scope: TvScope): Promise<string> {
  return new SignJWT({ typ: "tv", scope })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TV_TOKEN_TTL)
    .sign(secret);
}

async function verifyTvJwt(token: string, scope: TvScope): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    // typ:"tv" impede reusar cookie de sessão como token de TV e vice-versa.
    return payload.typ === "tv" && payload.scope === scope;
  } catch {
    return false;
  }
}

// Valida acesso à TV para um escopo: aceita JWT assinado (escopo bate) OU o token
// fixo legado do env. Falha-fechado se nada configurado/inválido.
export async function validateTvAccess(provided: string | null | undefined, scope: TvScope): Promise<boolean> {
  if (!provided) return false;
  const legacy = process.env.TV_TOKEN;
  if (legacy && safeEqual(provided, legacy)) return true; // token fixo antigo (qualquer escopo)
  return verifyTvJwt(provided, scope);
}
