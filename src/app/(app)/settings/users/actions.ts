"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isModuleKey, isToolKey, isModuleManager, type ModuleKey } from "@/lib/permissions";
import { moduleOfTool } from "@/lib/modules";
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

// Define as FERRAMENTAS (telas) que um usuário pode acessar.
//
// Admin mexe em tudo. Gerente de módulo mexe só nas ferramentas dos módulos que
// ele administra: as demais permissões do alvo são preservadas, senão salvar a
// aba "Marketing" apagaria silenciosamente o acesso ao Comercial. Ninguém edita
// admin — quem é admin já vê tudo, e permitir isso viraria caminho de escalada.
export async function updateUserTools(userId: string, tools: string[]): Promise<UserActionState> {
  const eu = await requireUser();
  if (!isModuleManager(eu)) return { error: "Sem permissão para alterar acessos." };

  const target = await db.user.findFirst({
    where: { id: userId, workspaceId: eu.workspaceId },
    select: { id: true, role: true, tools: true },
  });
  if (!target) return { error: "Usuário não encontrado." };
  if (target.role === "admin") return { error: "Admin já tem acesso a tudo." };

  const pedido = Array.isArray(tools) ? [...new Set(tools.filter(isToolKey))] : [];

  let final: string[];
  if (eu.role === "admin") {
    final = pedido;
  } else {
    const meus = new Set((eu.manages ?? []).filter(isModuleKey));
    if (meus.size === 0) return { error: "Você não administra nenhum módulo." };
    // Mantém o que está fora do meu alcance; troca só o que é meu.
    const forcaDeFora = target.tools.filter((t) => {
      const m = moduleOfTool(t);
      return !m || !meus.has(m);
    });
    const meusPedidos = pedido.filter((t) => {
      const m = moduleOfTool(t);
      return m && meus.has(m);
    });
    final = [...new Set([...forcaDeFora, ...meusPedidos])];
  }

  // `modules` acompanha por compatibilidade: é derivado das ferramentas.
  const modules = [...new Set(final.map(moduleOfTool).filter((m): m is ModuleKey => !!m))];
  await db.user.update({ where: { id: userId }, data: { tools: final, modules } });
  revalidatePath("/settings/users");
  return { ok: true };
}

// Define quem administra quais módulos. Só admin — deixar gerente nomear gerente
// é o caminho mais curto pra alguém ampliar o próprio alcance.
export async function updateUserManages(userId: string, manages: string[]): Promise<UserActionState> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId }, select: { id: true } });
  if (!target) return { error: "Usuário não encontrado." };
  const clean = Array.isArray(manages) ? [...new Set(manages.filter(isModuleKey))] : [];
  await db.user.update({ where: { id: userId }, data: { manages: clean } });
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
