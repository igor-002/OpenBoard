// Assinatura/verificação de JWT de sessão (jose, compatível com edge/middleware).
import { SignJWT, jwtVerify } from "jose";

// Falha-fechado: sem AUTH_SECRET forte, a aplicação não sobe. Nunca use fallback
// hardcoded — um segredo conhecido no código deixa qualquer um forjar sessão de admin.
const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error(
    "AUTH_SECRET ausente ou muito curto. Gere um com `openssl rand -base64 48` " +
      "e defina AUTH_SECRET no ambiente (mínimo 32 caracteres).",
  );
}
const secret = new TextEncoder().encode(rawSecret);

export type SessionPayload = { sub: string }; // sub = userId

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "ob_session";
