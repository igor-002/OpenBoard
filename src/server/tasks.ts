import "server-only";
import { db } from "@/lib/db";
import type { Priority, TaskColumn, ProjectStatus, AvatarUser, TaskOrigin } from "@/lib/types";

export type SubtaskItem = { id: string; title: string; done: boolean };
export type TaskCommentItem = { id: string; body: string; createdAt: Date; authorId: string; author: AvatarUser };

export type TaskCardData = {
  id: string;
  title: string;
  column: TaskColumn;
  priority: Priority;
  projectId: string | null; // null = atividade avulsa (sem projeto)
  projectName: string;
  projectStatus: ProjectStatus | null;
  origem: TaskOrigin;
  tags: string[];
  subDone: number; // derivado
  subTotal: number; // derivado
  comments: number; // derivado
  dueDate: Date | null;
  dueIso: string | null; // YYYY-MM-DD para <input type=date>
  assignee: AvatarUser | null;
  assigneeId: string | null;
  subtasks: SubtaskItem[];
  commentList: TaskCommentItem[];
};

export type KanbanData = {
  tasks: TaskCardData[];
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
};

export async function getKanbanData(workspaceId: string): Promise<KanbanData> {
  const [tasks, projects, members] = await Promise.all([
    db.task.findMany({
      where: { workspaceId },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      include: {
        project: { select: { id: true, name: true, status: true } },
        assignee: { select: { initials: true, color: true, name: true } },
        tags: { select: { label: true } },
        subtasks: { orderBy: { order: "asc" }, select: { id: true, title: true, done: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { initials: true, color: true, name: true } } },
        },
      },
    }),
    db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      column: t.column,
      priority: t.priority,
      projectId: t.project?.id ?? null,
      projectName: t.project?.name ?? "Avulsa",
      projectStatus: t.project?.status ?? null,
      origem: t.origem,
      tags: t.tags.map((g) => g.label),
      subDone: t.subtasks.filter((s) => s.done).length,
      subTotal: t.subtasks.length,
      comments: t.comments.length,
      dueDate: t.dueDate,
      dueIso: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      assignee: t.assignee,
      assigneeId: t.assigneeId,
      subtasks: t.subtasks,
      commentList: t.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        authorId: c.authorId,
        author: c.author,
      })),
    })),
    projects: projects,
    members: members,
  };
}
