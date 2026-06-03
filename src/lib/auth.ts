// Sessão do servidor: cookie httpOnly + leitura do usuário atual.
// Usa next/headers, então só roda em Server Components / Server Actions / Route Handlers.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { signToken, verifyToken, SESSION_COOKIE } from "./jwt";

const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export async function setSession(userId: string) {
  const token = await signToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Só marca Secure se explicitamente ligado (COOKIE_SECURE=true). O deploy é HTTP
    // (IP, sem TLS) — com Secure o navegador descarta o cookie e a sessão "some".
    // Ligue COOKIE_SECURE=true quando servir por HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.sub ?? null;
}

// Usuário atual (com workspace). null se não autenticado.
export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    include: { workspace: true },
  });
}

// Igual ao acima mas redireciona para /login se não houver sessão.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Exige papel admin; manda pro dashboard se não for. Use em páginas/actions admin.
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
