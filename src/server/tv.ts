import "server-only";
import { db } from "@/lib/db";
import { getProjectsList, effectiveProgress } from "@/server/projects";
import { getDashboardData } from "@/server/dashboard";
import { getTimelineData } from "@/server/timeline";
import { KANBAN_COLS } from "@/lib/meta";
import type { ProjectStatus, AvatarUser, Priority, TaskColumn } from "@/lib/types";

// ---------- Acesso por token (painel de TV, sem login) ----------

export type TvWorkspace = { id: string; name: string };

// Resolve o workspace exibido na TV (acesso livre, sem token).
// Workspace: TV_WORKSPACE_ID se setado, senão o único/primeiro.
export async function resolveTvWorkspace(): Promise<TvWorkspace | null> {
  const fixedId = process.env.TV_WORKSPACE_ID;
  const ws = fixedId
    ? await db.workspace.findUnique({ where: { id: fixedId }, select: { id: true, name: true } })
    : await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  return ws ?? null;
}

// ---------- Tipos do painel ----------

export type TvKpis = {
  projetosAtivos: number;
  projetosTotal: number;
  projetosConcluidos: number;
  progressoMedio: number;
  projetosRisco: number;
  tarefasDone: number;
  tarefasTotal: number;
  tarefasAbertas: number;
  tarefasAtrasadas: number;
  membros: number;
};

export type TvProject = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  risk: boolean;
  spentPct: number;
  dueDate: string | null;
  daysLeft: number | null; // negativo = atrasado
  tasksDone: number;
  tasksTotal: number;
  members: AvatarUser[];
};

export type TvRisk = { id: string; name: string; client: string; spentPct: number; daysLeft: number | null };

export type TvTaskDue = {
  id: string;
  title: string;
  project: string;
  priority: Priority;
  assignee: AvatarUser | null;
  dueDate: string;
  daysLeft: number; // negativo = atrasado
};

export type TvMilestone = { id: string; title: string; project: string; date: string; state: "todo" | "doing" | "done" };

export type TvKanbanCol = { column: TaskColumn; label: string; n: number };

export type TvActivity = { id: string; kind: "project" | "task"; text: string; actor: string | null; at: string };

export type TvGanttBar = {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  startCol: number;
  span: number;
  members: AvatarUser[];
};
export type TvGantt = { year: number; today: number | null; bars: TvGanttBar[] };

export type TvAssignee = { id: string; name: string; initials: string; color: string; jobTitle: string; open: number };

export type TvFeatured = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  tasksDone: number;
  tasksTotal: number;
  members: AvatarUser[];
  milestones: { title: string; date: string; state: "todo" | "doing" | "done" }[];
  kanban: { todo: number; doing: number; review: number; done: number };
};

export type TvNote = { id: string; kind: "note" | "comment"; author: AvatarUser; body: string; context: string; at: string };

export type TvData = {
  workspaceName: string;
  generatedAt: string;
  kpis: TvKpis;
  statusCounts: { status: ProjectStatus; n: number }[];
  projects: TvProject[]; // ativos por urgência (painel 01)
  deadlines: TvProject[]; // todos por urgência (painel 02)
  tasksByDue: TvTaskDue[];
  milestones: TvMilestone[];
  kanban: TvKanbanCol[];
  riskProjects: TvRisk[];
  recent: TvActivity[];
  gantt: TvGantt; // cronograma
  assignees: TvAssignee[]; // tarefas abertas por pessoa
  featured: TvFeatured[]; // projetos em destaque (rotativo)
  notesFeed: TvNote[]; // notas + comentários recentes
};

const dayMs = 86400000;
const daysBetween = (a: number, b: number) => Math.floor((a - b) / dayMs);
const dueVal = (d: Date | null) => (d ? +d : Number.MAX_SAFE_INTEGER);
const av = (u: { name: string; initials: string; color: string }): AvatarUser => ({ name: u.name, initials: u.initials, color: u.color });

export async function getTvData(ws: TvWorkspace): Promise<TvData> {
  const now = Date.now();
  const nowDate = new Date();

  const [
    list, dash, timeline, dueRaw, overdueCount, msRaw, kanbanRaw,
    recentProjects, recentTasks, openByUser, usersRaw, featRaw, notesRaw, commentsRaw,
  ] = await Promise.all([
    getProjectsList(ws.id),
    getDashboardData(ws.id),
    getTimelineData(ws.id),
    db.task.findMany({
      where: { project: { workspaceId: ws.id }, column: { not: "done" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { project: { select: { name: true } }, assignee: { select: { name: true, initials: true, color: true } } },
    }),
    db.task.count({ where: { project: { workspaceId: ws.id }, column: { not: "done" }, dueDate: { lt: nowDate } } }),
    db.milestone.findMany({
      where: { project: { workspaceId: ws.id }, state: { not: "done" } },
      orderBy: { date: "asc" },
      take: 6,
      include: { project: { select: { name: true } } },
    }),
    db.task.groupBy({ by: ["column"], where: { project: { workspaceId: ws.id } }, _count: { _all: true } }),
    db.project.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 6, include: { creator: { select: { name: true } } } }),
    db.task.findMany({ where: { project: { workspaceId: ws.id } }, orderBy: { createdAt: "desc" }, take: 6, include: { project: { select: { name: true } } } }),
    db.task.groupBy({ by: ["assigneeId"], where: { project: { workspaceId: ws.id }, column: { not: "done" }, assigneeId: { not: null } }, _count: { _all: true } }),
    db.user.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true, initials: true, color: true, jobTitle: true } }),
    db.project.findMany({
      where: { workspaceId: ws.id, status: { not: "done" } },
      orderBy: { createdAt: "asc" },
      take: 6,
      include: {
        members: { orderBy: { order: "asc" }, include: { user: { select: { name: true, initials: true, color: true } } } },
        milestones: { orderBy: { date: "asc" }, take: 4, select: { title: true, date: true, state: true } },
        tasks: { select: { column: true } },
      },
    }),
    db.projectNote.findMany({
      where: { project: { workspaceId: ws.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { author: { select: { name: true, initials: true, color: true } }, project: { select: { name: true } } },
    }),
    db.taskComment.findMany({
      where: { task: { project: { workspaceId: ws.id } } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { author: { select: { name: true, initials: true, color: true } }, task: { select: { title: true } } },
    }),
  ]);

  const toTvProject = (p: (typeof list)[number]): TvProject => ({
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    progress: p.progress,
    risk: p.risk,
    spentPct: p.spentPct,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    daysLeft: p.dueDate ? daysBetween(+p.dueDate, now) : null,
    tasksDone: p.tasksDone,
    tasksTotal: p.tasksTotal,
    members: p.members,
  });

  const rank = (p: (typeof list)[number]) => (p.risk ? 0 : 1);
  const projects = list
    .filter((p) => p.status !== "done")
    .sort((a, b) => rank(a) - rank(b) || dueVal(a.dueDate) - dueVal(b.dueDate) || a.progress - b.progress)
    .map(toTvProject);

  const deadlines = [...list]
    .sort((a, b) => {
      const va = a.status === "done" ? Number.MAX_SAFE_INTEGER : dueVal(a.dueDate);
      const vb = b.status === "done" ? Number.MAX_SAFE_INTEGER : dueVal(b.dueDate);
      return va - vb;
    })
    .map(toTvProject);

  const tasksByDue: TvTaskDue[] = dueRaw.map((t) => ({
    id: t.id, title: t.title, project: t.project.name, priority: t.priority as Priority,
    assignee: t.assignee, dueDate: t.dueDate!.toISOString(), daysLeft: daysBetween(+t.dueDate!, now),
  }));

  const milestones: TvMilestone[] = msRaw.map((m) => ({
    id: m.id, title: m.title, project: m.project.name, date: m.date.toISOString(), state: m.state as "todo" | "doing" | "done",
  }));

  const kanCount = new Map(kanbanRaw.map((g) => [g.column, g._count._all]));
  const kanban: TvKanbanCol[] = KANBAN_COLS.map((c) => ({ column: c.id, label: c.label, n: kanCount.get(c.id) ?? 0 }));

  const activeForAvg = list.filter((p) => p.status === "progress" || p.status === "review");
  const avgSet = activeForAvg.length ? activeForAvg : list.filter((p) => p.status !== "done");
  const progressoMedio = avgSet.length ? Math.round(avgSet.reduce((s, p) => s + p.progress, 0) / avgSet.length) : 0;

  const kpis: TvKpis = {
    projetosAtivos: list.filter((p) => p.status === "progress").length,
    projetosTotal: list.length,
    projetosConcluidos: list.filter((p) => p.status === "done").length,
    progressoMedio,
    projetosRisco: list.filter((p) => p.risk).length,
    tarefasDone: dash.tasksDone,
    tarefasTotal: dash.tasksTotal,
    tarefasAbertas: Math.max(0, dash.tasksTotal - dash.tasksDone),
    tarefasAtrasadas: overdueCount,
    membros: dash.team.length,
  };

  const recent: TvActivity[] = [
    ...recentProjects.map((p) => ({ id: "p" + p.id, kind: "project" as const, text: `Novo projeto: ${p.name}`, actor: p.creator?.name ?? null, at: p.createdAt.toISOString() })),
    ...recentTasks.map((t) => ({ id: "t" + t.id, kind: "task" as const, text: `Nova tarefa: ${t.title} · ${t.project.name}`, actor: null, at: t.createdAt.toISOString() })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);

  // Cronograma (Gantt) — descarta Datas (não usadas no render).
  const gantt: TvGantt = {
    year: timeline.year,
    today: timeline.today,
    bars: timeline.bars.map((b) => ({ id: b.id, name: b.name, status: b.status, progress: b.progress, startCol: b.startCol, span: b.span, members: b.members })),
  };

  // Responsáveis — tarefas abertas por pessoa (contagem real).
  const openMap = new Map(openByUser.map((g) => [g.assigneeId as string, g._count._all]));
  const assignees: TvAssignee[] = usersRaw
    .map((u) => ({ id: u.id, name: u.name, initials: u.initials, color: u.color, jobTitle: u.jobTitle, open: openMap.get(u.id) ?? 0 }))
    .filter((a) => a.open > 0)
    .sort((a, b) => b.open - a.open);

  // Projetos em destaque (rotativo).
  const featured: TvFeatured[] = featRaw.map((p) => {
    const cols = { todo: 0, doing: 0, review: 0, done: 0 };
    for (const t of p.tasks) cols[t.column] += 1;
    const total = p.tasks.length;
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      progress: effectiveProgress(p.manualProgress, cols.done, total),
      tasksDone: cols.done,
      tasksTotal: total,
      members: p.members.map((m) => av(m.user)),
      milestones: p.milestones.map((m) => ({ title: m.title, date: m.date.toISOString(), state: m.state as "todo" | "doing" | "done" })),
      kanban: cols,
    };
  });

  // Notas + comentários recentes.
  const notesFeed: TvNote[] = [
    ...notesRaw.map((n) => ({ id: "n" + n.id, kind: "note" as const, author: av(n.author), body: n.body, context: n.project.name, at: n.createdAt.toISOString() })),
    ...commentsRaw.map((c) => ({ id: "c" + c.id, kind: "comment" as const, author: av(c.author), body: c.body, context: c.task.title, at: c.createdAt.toISOString() })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);

  return {
    workspaceName: ws.name,
    generatedAt: new Date().toISOString(),
    kpis,
    statusCounts: dash.statusCounts,
    projects,
    deadlines,
    tasksByDue,
    milestones,
    kanban,
    riskProjects: list.filter((p) => p.risk).map((p) => ({ id: p.id, name: p.name, client: p.client, spentPct: p.spentPct, daysLeft: p.dueDate ? daysBetween(+p.dueDate, now) : null })),
    recent,
    gantt,
    assignees,
    featured,
    notesFeed,
  };
}
