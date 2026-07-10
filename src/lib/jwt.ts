// Assinatura/verificação de JWT de sessão (jose, compatível com edge/middleware).
import { SignJWT, jwtVerify } from "jose";

// Falha-fechado: sem AUTH_SECRET forte, assinar/verificar sessão falha. Nunca use
// fallback hardcoded — um segredo conhecido no código deixa qualquer um forjar admin.
// A checagem é LAZY (dentro da função) de propósito: `next build` avalia os módulos
// das rotas em build-time, quando AUTH_SECRET (env de runtime) ainda não existe —
// checar no topo do módulo quebraria o build.
let cachedSecret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou muito curto. Gere um com `openssl rand -base64 48` " +
        "e defina AUTH_SECRET no ambiente (mínimo 32 caracteres).",
    );
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export type SessionPayload = { sub: string }; // sub = userId

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "ob_session";
