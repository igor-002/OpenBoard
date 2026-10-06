// Quadro de demandas — leitura. Só o que o cartão mostra; o detalhe vem de
// getDemanda (src/server/demandas.ts) quando o painel abre.
import "server-only";
import { db } from "@/lib/db";
import { DIAS_CONCLUIDA_QUADRO } from "@/lib/meta";
import type { Priority, TaskColumn, AvatarUser, TaskOrigin } from "@/lib/types";

export type TaskCardData = {
  id: string;
  numero: number;
  title: string;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  solicitante: string | null;
  projectName: string | null;
  waitingReason: string | null;
  subDone: number;
  subTotal: number;
  comments: number;
  dueDate: Date | null;
  assignee: AvatarUser | null;
  assigneeId: string | null;
};

export type KanbanData = {
  tasks: TaskCardData[];
  antigas: number; // resolvidas fora da janela de DIAS_CONCLUIDA_QUADRO (ficam fora do quadro)
  tipos: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
};

export async function getKanbanData(workspaceId: string): Promise<KanbanData> {
  // Resolvida some do quadro depois da janela: a coluna crescia pra sempre e
  // enterrava as três que importam. Cancelada nem entra.
  const corte = new Date(Date.now() - DIAS_CONCLUIDA_QUADRO * 86400000);

  const [tasks, antigas, tipos, projects, members] = await Promise.all([
    db.task.findMany({
      where: { workspaceId, OR: [{ column: { in: ["todo", "doing", "waiting"] } }, { column: "done", doneAt: { gte: corte } }] },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { name: true } },
        assignee: { select: { initials: true, color: true, name: true } },
        subtasks: { select: { done: true } },
        _count: { select: { comments: true } },
      },
    }),
    db.task.count({ where: { workspaceId, column: "done", OR: [{ doneAt: null }, { doneAt: { lt: corte } }] } }),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { workspaceId, status: { not: "done" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      numero: t.numero,
      title: t.title,
      column: t.column,
      priority: t.priority,
      origem: t.origem,
      solicitante: t.solicitante,
      projectName: t.project?.name ?? null,
      waitingReason: t.waitingReason,
      subDone: t.subtasks.filter((s) => s.done).length,
      subTotal: t.subtasks.length,
      comments: t._count.comments,
      dueDate: t.dueDate,
      assignee: t.assignee,
      assigneeId: t.assigneeId,
    })),
    antigas,
    tipos,
    projects,
    members,
  };
}
