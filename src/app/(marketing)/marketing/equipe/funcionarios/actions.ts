"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type EmployeeActionState = { ok?: boolean; error?: string };

const PALETTE = ["#F2691F", "#2D6FF2", "#7A5AE0", "#16A34A", "#E8910C", "#2DBE9E", "#E5484D", "#0EA5E9", "#DB2777", "#65A30D"];

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createEmployeeAction(
  name: string,
  role: string,
  userId: string | null,
): Promise<EmployeeActionState> {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nome obrigatório." };
  const slug = slugify(trimmed);
  if (!slug) return { ok: false, error: "Nome inválido." };
  const exists = await db.employee.findUnique({ where: { slug } });
  if (exists) return { ok: false, error: "Já existe um funcionário com esse nome." };
  const count = await db.employee.count();
  await db.employee.create({
    data: {
      name: trimmed,
      slug,
      role: role.trim() || "Marketing",
      avatarColor: PALETTE[count % PALETTE.length],
      userId: userId || null,
    },
  });
  revalidatePath("/marketing/equipe/funcionarios");
  revalidatePath("/marketing/equipe");
  return { ok: true };
}

export async function updateEmployeeAction(
  id: string,
  input: { name?: string; role?: string; userId?: string | null },
): Promise<EmployeeActionState> {
  await requireUser();
  await db.employee.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.role !== undefined && { role: input.role.trim() }),
      ...(input.userId !== undefined && { userId: input.userId || null }),
    },
  });
  revalidatePath("/marketing/equipe/funcionarios");
  revalidatePath("/marketing/equipe");
  return { ok: true };
}

export async function deleteEmployeeAction(id: string): Promise<EmployeeActionState> {
  await requireUser();
  await db.employee.delete({ where: { id } });
  revalidatePath("/marketing/equipe/funcionarios");
  revalidatePath("/marketing/equipe");
  return { ok: true };
}
