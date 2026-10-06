"use server";

// Checklist e acompanhamentos de uma demanda. Criar, mudar status e trocar
// responsável ficam em ../demandas/actions.ts (regra única).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAnyToolUser, TOOLS_DEMANDA } from "@/lib/permissions";
import { notify } from "@/server/notifications";
import { linkDemanda } from "@/server/demandas";

export type TaskActionState = { ok?: boolean; error?: string };

// ---------- Subtarefas (checklist) ----------
async function ownTask(taskId: string, workspaceId: string) {
  return db.task.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } });
}

export async function addSubtask(taskId: string, title: string): Promise<TaskActionState> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  if (!(await ownTask(taskId, user.workspaceId))) return { error: "Tarefa não encontrada." };
  const t = title.trim();
  if (t.length < 1) return { error: "Vazio." };
  const count = await db.subtask.count({ where: { taskId } });
  await db.subtask.create({ data: { taskId, title: t.slice(0, 200), order: count } });
  revalida();
  return { ok: true };
}

export async function toggleSubtask(subtaskId: string): Promise<TaskActionState> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const s = await db.subtask.findFirst({ where: { id: subtaskId, task: { workspaceId: user.workspaceId } }, select: { id: true, done: true } });
  if (!s) return { error: "Subtarefa não encontrada." };
  await db.subtask.update({ where: { id: subtaskId }, data: { done: !s.done } });
  revalida();
  return { ok: true };
}

export async function deleteSubtask(subtaskId: string): Promise<TaskActionState> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const s = await db.subtask.findFirst({ where: { id: subtaskId, task: { workspaceId: user.workspaceId } }, select: { id: true } });
  if (!s) return { error: "Subtarefa não encontrada." };
  await db.subtask.delete({ where: { id: subtaskId } });
  revalida();
  return { ok: true };
}

// ---------- Comentários (thread) ----------
export async function addTaskComment(taskId: string, body: string): Promise<TaskActionState> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: user.workspaceId },
    select: { id: true, numero: true, title: true, assigneeId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  const b = body.trim();
  if (b.length < 1) return { error: "Vazio." };
  await db.taskComment.create({ data: { taskId, authorId: user.id, body: b.slice(0, 2000) } });
  // avisa o responsável (se houver e não for você)
  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify([task.assigneeId], { type: "note_added", title: `Acompanhamento na demanda #${task.numero}`, body: b.slice(0, 90), link: linkDemanda(task.numero) });
  }
  revalida();
  return { ok: true };
}

export async function deleteTaskComment(commentId: string): Promise<TaskActionState> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const c = await db.taskComment.findFirst({
    where: { id: commentId, task: { workspaceId: user.workspaceId } },
    select: { id: true, authorId: true },
  });
  if (!c) return { error: "Comentário não encontrado." };
  if (c.authorId !== user.id && user.role !== "admin") return { error: "Sem permissão." };
  await db.taskComment.delete({ where: { id: commentId } });
  revalida();
  return { ok: true };
}

function revalida() {
  revalidatePath("/kanban");
  revalidatePath("/atividades");
  revalidatePath("/dashboard");
}
