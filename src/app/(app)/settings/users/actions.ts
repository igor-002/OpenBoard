"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isModuleKey } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export type UserActionState = { ok?: boolean; error?: string };

const PALETTE = ["#F2691F", "#2D6FF2", "#7A5AE0", "#16A34A", "#E8910C", "#2DBE9E", "#E5484D", "#0EA5E9", "#DB2777", "#65A30D"];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  jobTitle: z.string().min(2, "Informe o cargo"),
  role: z.enum(["admin", "membro"]),
  password: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
});

// D1 — define o custo/hora do usuário (centavos) p/ cálculo de margem real.
export async function updateUserHourlyCost(id: string, hourlyCostCents: number): Promise<UserActionState> {
  const admin = await requireAdmin();
  const u = await db.user.findFirst({ where: { id, workspaceId: admin.workspaceId }, select: { id: true } });
  if (!u) return { error: "Usuário não encontrado." };
  await db.user.update({ where: { id }, data: { hourlyCostCents: Math.max(0, Math.round(hourlyCostCents)) } });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Cria (convida) um novo usuário no workspace do admin.
export async function createUser(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    jobTitle: formData.get("jobTitle"),
    role: formData.get("role") || "membro",
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "Já existe uma conta com esse e-mail." };

  const count = await db.user.count({ where: { workspaceId: admin.workspaceId } });
  await db.user.create({
    data: {
      workspaceId: admin.workspaceId,
      name: parsed.data.name,
      email: parsed.data.email,
      jobTitle: parsed.data.jobTitle,
      role: parsed.data.role as Role,
      passwordHash: await hashPassword(parsed.data.password),
      initials: initialsOf(parsed.data.name),
      color: PALETTE[count % PALETTE.length],
      mustChangePassword: true, // sugere troca no 1º acesso
    },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Muda o papel de um usuário. Impede deixar o workspace sem admin.
export async function updateUserRole(userId: string, role: Role): Promise<UserActionState> {
  const admin = await requireAdmin();
  if (role !== "admin" && role !== "membro") return { error: "Papel inválido." };

  const target = await db.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId } });
  if (!target) return { error: "Usuário não encontrado." };

  if (target.role === "admin" && role === "membro") {
    const admins = await db.user.count({ where: { workspaceId: admin.workspaceId, role: "admin" } });
    if (admins <= 1) return { error: "O workspace precisa de pelo menos um admin." };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Define os módulos que um usuário (não-admin) pode acessar. Admin ignora a lista
// (vê tudo). Filtra pra chaves válidas — nunca confia no que veio do cliente.
export async function updateUserModules(userId: string, modules: string[]): Promise<UserActionState> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId }, select: { id: true } });
  if (!target) return { error: "Usuário não encontrado." };
  const clean = Array.isArray(modules) ? [...new Set(modules.filter(isModuleKey))] : [];
  await db.user.update({ where: { id: userId }, data: { modules: clean } });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Admin redefine a senha de um usuário (esqueceu). Marca pra trocar no próximo acesso.
export async function resetUserPassword(userId: string, newPassword: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { error: "Senha precisa de ao menos 8 caracteres." };
  }
  const target = await db.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId }, select: { id: true } });
  if (!target) return { error: "Usuário não encontrado." };

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Remove um usuário. Não permite remover a si mesmo nem o último admin.
export async function deleteUser(userId: string): Promise<UserActionState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "Você não pode remover a si mesmo." };

  const target = await db.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId } });
  if (!target) return { error: "Usuário não encontrado." };

  if (target.role === "admin") {
    const admins = await db.user.count({ where: { workspaceId: admin.workspaceId, role: "admin" } });
    if (admins <= 1) return { error: "O workspace precisa de pelo menos um admin." };
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath("/settings/users");
  return { ok: true };
}
