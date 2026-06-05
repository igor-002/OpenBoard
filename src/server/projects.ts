import "server-only";
import { db } from "@/lib/db";
import type {
  ProjectStatus,
  Priority,
  TaskColumn,
  AvatarUser,
} from "@/lib/types";

// Progresso efetivo do projeto: override manual quando definido,
// senão % de tarefas concluídas (0 tarefas = 0%).
export function effectiveProgress(manual: number | null | undefined, done: number, total: number): number {
  if (manual !== null && manual !== undefined) return manual;
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export type ProjectListItem = {
  id: string;
  name: string;
  client: string;
  tag: string;
  status: ProjectStatus;
  progress: number;
  risk: boolean;
  dueDate: Date | null;
  members: AvatarUser[];
  tasksTotal: number;
  tasksDone: number;
  spentPct: number;
};

export async function getProjectsList(workspaceId: string): Promise<ProjectListItem[]> {
  const projects = await db.project.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        orderBy: { order: "asc" },
        include: { user: { select: { initials: true, color: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });

  const doneGroups = await db.task.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projects.map((p) => p.id) }, column: "done" },
    _count: { _all: true },
  });
  const doneMap = new Map(doneGroups.map((g) => [g.projectId, g._count._all]));

  return projects.map((p) => {
    const tasksDone = doneMap.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      tag: p.tag,
      status: p.status,
      progress: effectiveProgress(p.manualProgress, tasksDone, p._count.tasks),
      risk: p.risk,
      dueDate: p.dueDate,
      members: p.members.map((m) => m.user),
      tasksTotal: p._count.tasks,
      tasksDone,
      spentPct: p.spentPct,
    };
  });
}

export type ProjectMemberDetail = AvatarUser & {
  id: string;
  jobTitle: string;
  isLead: boolean;
};
export type ProjectMilestone = {
  id: string;
  title: string;
  state: "done" | "doing" | "todo";
  date: Date;
};
export type ProjectTaskItem = {
  id: string;
  title: string;
  column: TaskColumn;
  priority: Priority;
  assignee: AvatarUser | null;
};
export type ProjectDetail = {
  id: string;
  name: string;
  client: string;
  tag: string;
  status: ProjectStatus;
  progress: number;
  startDate: Date;
  dueDate: Date | null;
  budgetCents: number;
  spentPct: number;
  createdAt: Date;
  creator: AvatarUser | null;
  tasksTotal: number;
  tasksDone: number;
  members: ProjectMemberDetail[];
  milestones: ProjectMilestone[];
  tasks: ProjectTaskItem[];
  notes: ProjectNoteItem[];
};

export type ProjectNoteItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: AvatarUser;
};

export type ProjectEdit = {
  id: string;
  name: string;
  client: string;
  tag: string;
  status: ProjectStatus;
  manualProgress: number | null; // null = automático
  autoProgress: number; // % calculado das tarefas (referência no form)
  startDate: string; // YYYY-MM-DD (para <input type=date>)
  dueDate: string; // "" = sem prazo
  risk: boolean;
  memberIds: string[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Dados de um projeto para preencher o formulário de edição.
export async function getProjectForEdit(
  workspaceId: string,
  projectId: string,
): Promise<ProjectEdit | null> {
  const p = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      members: { orderBy: { order: "asc" } },
      tasks: { select: { column: true } },
    },
  });
  if (!p) return null;
  const done = p.tasks.filter((t) => t.column === "done").length;
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    tag: p.tag,
    status: p.status,
    manualProgress: p.manualProgress,
    autoProgress: effectiveProgress(null, done, p.tasks.length),
    startDate: iso(p.startDate),
    dueDate: p.dueDate ? iso(p.dueDate) : "",
    risk: p.risk,
    memberIds: p.members.map((m) => m.userId),
  };
}

// Detalhe de um projeto, restrito ao workspace do usuário.
export async function getProjectDetail(
  workspaceId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  const p = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      creator: { select: { initials: true, color: true, name: true } },
      members: {
        orderBy: { order: "asc" },
        include: {
          user: { select: { id: true, name: true, initials: true, color: true, jobTitle: true } },
        },
      },
      milestones: { orderBy: { order: "asc" } },
      tasks: {
        orderBy: { order: "asc" },
        include: {
          assignee: { select: { initials: true, color: true, name: true } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { initials: true, color: true, name: true } } },
      },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    name: p.name,
    client: p.client,
    tag: p.tag,
    status: p.status,
    progress: effectiveProgress(
      p.manualProgress,
      p.tasks.filter((t) => t.column === "done").length,
      p.tasks.length,
    ),
    startDate: p.startDate,
    dueDate: p.dueDate,
    budgetCents: p.budgetCents,
    spentPct: p.spentPct,
    createdAt: p.createdAt,
    creator: p.creator,
    tasksTotal: p.tasks.length,
    tasksDone: p.tasks.filter((t) => t.column === "done").length,
    members: p.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      initials: m.user.initials,
      color: m.user.color,
      jobTitle: m.user.jobTitle,
      isLead: m.isLead,
    })),
    milestones: p.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      state: m.state,
      date: m.date,
    })),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      column: t.column,
      priority: t.priority,
      assignee: t.assignee,
    })),
    notes: p.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      authorId: n.authorId,
      author: n.author,
    })),
  };
}
