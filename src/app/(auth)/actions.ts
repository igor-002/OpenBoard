"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSession, clearSession } from "@/lib/auth";
import { checkRateLimit, registerFailure, resetRateLimit } from "@/lib/rate-limit";
import { createResetLink, deliverResetLink, findUserByResetToken } from "@/server/password-reset";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim()) || h.get("x-real-ip") || "local";
}

export type AuthState = { error?: string };

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
});

const PALETTE = ["#F2691F", "#2D6FF2", "#7A5AE0", "#16A34A", "#E8910C", "#2DBE9E", "#E5484D", "#0EA5E9", "#DB2777", "#65A30D"];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Limite de tentativas (anti-brute-force) por IP + e-mail.
  const key = `login:${await clientIp()}:${parsed.data.email}`;
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    const min = Math.ceil((limit.retryAfterSec ?? 60) / 60);
    return { error: `Muitas tentativas. Tente novamente em ~${min} min.` };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    registerFailure(key);
    return { error: "E-mail ou senha incorretos." };
  }
  resetRateLimit(key);
  await setSession(user.id);
  redirect("/dashboard");
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Cadastro aberto SÓ para bootstrap: enquanto não existe nenhum usuário.
  // Depois disso, novas contas são criadas por um admin (convite).
  const count = await db.user.count();
  if (count > 0) {
    return { error: "Cadastro fechado. Peça um convite ao administrador." };
  }

  // Primeiro usuário do sistema: cria o workspace e vira admin.
  const workspace = await db.workspace.create({ data: { name: "Meu Workspace", slug: "workspace" } });
  const user = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "admin",
      jobTitle: "Administrador",
      initials: initialsOf(parsed.data.name),
      color: PALETTE[0],
    },
  });
  await setSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

// ── Esqueci minha senha ──────────────────────────────────────────────────────
export type ForgotState = { ok?: boolean; error?: string };

const forgotSchema = z.object({ email: z.string().email("E-mail inválido") });

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // mesmo rate limit do login — evita spam de pedidos
  const key = `reset:${await clientIp()}:${parsed.data.email}`;
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    const min = Math.ceil((limit.retryAfterSec ?? 60) / 60);
    return { error: `Muitas tentativas. Tente novamente em ~${min} min.` };
  }
  registerFailure(key); // conta todo pedido, não só falha

  // Base do link: APP_URL (prod, com basePath) > host da request (dev).
  const h = await headers();
  const base = process.env.APP_URL || `http://${h.get("host") ?? "localhost:3000"}`;
  const link = await createResetLink(parsed.data.email, base);
  if (link) await deliverResetLink(parsed.data.email, link);
  // resposta idêntica com ou sem usuário — não revela se o e-mail existe
  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(20, "Link inválido"),
  password: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
  confirm: z.string(),
});

export async function resetPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.password !== parsed.data.confirm) return { error: "As senhas não conferem." };

  const user = await findUserByResetToken(parsed.data.token);
  if (!user) return { error: "Link inválido ou expirado. Peça um novo em Esqueci minha senha." };

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      mustChangePassword: false,
    },
  });
  return { ok: true };
}
