"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/server/notifications";
import type { TaskColumn } from "@/lib/types";

const COLUMNS = ["todo", "doing", "review", "done"] as const;

export type TaskActionState = { ok?: boolean; error?: string };

const createSchema = z.object({
  title: z.string().min(2, "Informe um título"),
  projectId: z.string().min(1, "Escolha um projeto"),
  priority: z.enum(["high", "med", "low"]),
  assigneeId: z.string().optional(),
  column: z.enum(COLUMNS).optional(),
  tags: z.string().optional(),
});

// Garante que o projeto pertence ao workspace do usuário.
async function assertProjectInWorkspace(projectId: string, workspaceId: string) {
  const p = await db.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
  return !!p;
}

export async function createTask(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    projectId: formData.get("projectId"),
    priority: formData.get("priority") || "med",
    assigneeId: formData.get("assigneeId") || undefined,
    column: formData.get("column") || "todo",
    tags: formData.get("tags") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!(await assertProjectInWorkspace(parsed.data.projectId, user.workspaceId))) {
    return { error: "Projeto inválido." };
  }

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const count = await db.task.count({ where: { projectId: parsed.data.projectId } });

  await db.task.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      priority: parsed.data.priority,
      column: parsed.data.column ?? "todo",
      assigneeId: parsed.data.assigneeId || null,
      order: count,
      tags: tags.length ? { create: tags.map((label) => ({ label })) } : undefined,
    },
  });

  // Notifica o responsável (se for outra pessoa).
  if (parsed.data.assigneeId && parsed.data.assigneeId !== user.id) {
    await notify([parsed.data.assigneeId], {
      type: "task_assigned",
      title: "Nova tarefa atribuída a você",
      body: parsed.data.title,
      link: "/kanban",
    });
  }

  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

const updateSchema = z.object({
  title: z.string().min(2, "Informe um título"),
  priority: z.enum(["high", "med", "low"]),
  column: z.enum(COLUMNS),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
});

// Edita uma tarefa (workspace-scoped).
export async function updateTask(taskId: string, _prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const user = await requireUser();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: user.workspaceId } },
    select: { id: true, assigneeId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    priority: formData.get("priority") || "med",
    column: formData.get("column") || "todo",
    assigneeId: formData.get("assigneeId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    tags: formData.get("tags") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // valida responsável no workspace
  let assigneeId: string | null = null;
  if (d.assigneeId) {
    const u = await db.user.findFirst({ where: { id: d.assigneeId, workspaceId: user.workspaceId }, select: { id: true } });
    assigneeId = u?.id ?? null;
  }
  const tags = (d.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);

  await db.$transaction([
    db.taskTag.deleteMany({ where: { taskId } }),
    db.task.update({
      where: { id: taskId },
      data: {
        title: d.title,
        priority: d.priority,
        column: d.column,
        assigneeId,
        dueDate: d.dueDate ? new Date(d.dueDate + "T12:00:00") : null,
        tags: tags.length ? { create: tags.map((label) => ({ label })) } : undefined,
      },
    }),
  ]);

  // Notifica novo responsável (se mudou e não for você).
  if (assigneeId && assigneeId !== task.assigneeId && assigneeId !== user.id) {
    await notify([assigneeId], {
      type: "task_assigned",
      title: "Tarefa atribuída a você",
      body: d.title,
      link: "/kanban",
    });
  }

  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Exclui uma tarefa (workspace-scoped).
export async function deleteTask(taskId: string): Promise<TaskActionState> {
  const user = await requireUser();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: user.workspaceId } },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  await db.task.delete({ where: { id: taskId } });
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Move uma tarefa para outra coluna (drag-and-drop).
export async function moveTask(taskId: string, column: TaskColumn): Promise<TaskActionState> {
  const user = await requireUser();
  if (!COLUMNS.includes(column)) return { error: "Coluna inválida." };

  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: user.workspaceId } },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  await db.task.update({ where: { id: taskId }, data: { column } });
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------- Subtarefas (checklist) ----------
async function ownTask(taskId: string, workspaceId: string) {
  return db.task.findFirst({ where: { id: taskId, project: { workspaceId } }, select: { id: true } });
}

export async function addSubtask(taskId: string, title: string): Promise<TaskActionState> {
  const user = await requireUser();
  if (!(await ownTask(taskId, user.workspaceId))) return { error: "Tarefa não encontrada." };
  const t = title.trim();
  if (t.length < 1) return { error: "Vazio." };
  const count = await db.subtask.count({ where: { taskId } });
  await db.subtask.create({ data: { taskId, title: t.slice(0, 200), order: count } });
  revalidatePath("/kanban");
  return { ok: true };
}

export async function toggleSubtask(subtaskId: string): Promise<TaskActionState> {
  const user = await requireUser();
  const s = await db.subtask.findFirst({ where: { id: subtaskId, task: { project: { workspaceId: user.workspaceId } } }, select: { id: true, done: true } });
  if (!s) return { error: "Subtarefa não encontrada." };
  await db.subtask.update({ where: { id: subtaskId }, data: { done: !s.done } });
  revalidatePath("/kanban");
  return { ok: true };
}

export async function deleteSubtask(subtaskId: string): Promise<TaskActionState> {
  const user = await requireUser();
  const s = await db.subtask.findFirst({ where: { id: subtaskId, task: { project: { workspaceId: user.workspaceId } } }, select: { id: true } });
  if (!s) return { error: "Subtarefa não encontrada." };
  await db.subtask.delete({ where: { id: subtaskId } });
  revalidatePath("/kanban");
  return { ok: true };
}

// ---------- Comentários (thread) ----------
export async function addTaskComment(taskId: string, body: string): Promise<TaskActionState> {
  const user = await requireUser();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: user.workspaceId } },
    select: { id: true, title: true, assigneeId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  const b = body.trim();
  if (b.length < 1) return { error: "Vazio." };
  await db.taskComment.create({ data: { taskId, authorId: user.id, body: b.slice(0, 2000) } });
  // avisa o responsável (se houver e não for você)
  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify([task.assigneeId], { type: "note_added", title: `Comentário em: ${task.title}`, body: b.slice(0, 90), link: "/kanban" });
  }
  revalidatePath("/kanban");
  return { ok: true };
}

export async function deleteTaskComment(commentId: string): Promise<TaskActionState> {
  const user = await requireUser();
  const c = await db.taskComment.findFirst({
    where: { id: commentId, task: { project: { workspaceId: user.workspaceId } } },
    select: { id: true, authorId: true },
  });
  if (!c) return { error: "Comentário não encontrado." };
  if (c.authorId !== user.id && user.role !== "admin") return { error: "Sem permissão." };
  await db.taskComment.delete({ where: { id: commentId } });
  revalidatePath("/kanban");
  return { ok: true };
}
