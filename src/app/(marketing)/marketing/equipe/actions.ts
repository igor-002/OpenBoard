"use server";

import { revalidatePath } from "next/cache";
import { requireModuleUser } from "@/lib/permissions";
import { createTask, updateTask, deleteTask, type TaskInput } from "@/server/marketing/task-source";

export type TeamActionState = { ok?: boolean; error?: string };

// Sem RBAC no módulo Marketing: qualquer usuário logado pode gerenciar tarefas.

export async function createTaskAction(input: TaskInput): Promise<TeamActionState> {
  await requireModuleUser("marketing");
  if (!input.title.trim()) return { ok: false, error: "Título obrigatório." };
  await createTask(input);
  revalidatePath("/marketing/equipe");
  return { ok: true };
}

export async function updateTaskAction(id: string, input: Partial<TaskInput>): Promise<TeamActionState> {
  await requireModuleUser("marketing");
  await updateTask(id, input);
  revalidatePath("/marketing/equipe");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<TeamActionState> {
  await requireModuleUser("marketing");
  await deleteTask(id);
  revalidatePath("/marketing/equipe");
  return { ok: true };
}
