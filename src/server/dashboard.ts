import "server-only";
import { db } from "@/lib/db";
import type { ProjectStatus, AvatarUser } from "@/lib/types";

export type DashProject = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  risk: boolean;
  dueDate: Date | null;
  members: AvatarUser[];
  tasksTotal: number;
};

export type DashTeamMember = AvatarUser & { id: string; loadPct: number };

export type DashboardData = {
  projects: DashProject[];
  statusCounts: { status: ProjectStatus; n: number }[];
  projectsTotal: number;
  projectsActive: number;
  tasksTotal: number;
  tasksDone: number;
  hoursWeek: number;
  hoursProjects: number;
  team: DashTeamMember[];
  utilization: number;
};

const STATUS_ORDER: ProjectStatus[] = ["progress", "review", "done", "planned"];

export async function getDashboardData(workspaceId: string): Promise<DashboardData> {
  const projectsRaw = await db.project.findMany({
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

  const projects: DashProject[] = projectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    progress: p.progress,
    risk: p.risk,
    dueDate: p.dueDate,
    members: p.members.map((m) => m.user),
    tasksTotal: p._count.tasks,
  }));

  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    n: projects.filter((p) => p.status === status).length,
  }));

  const projectsActive = projects.filter((p) => p.status === "progress").length;

  // Tarefas (totais e concluídas) do workspace.
  const projectIds = projects.map((p) => p.id);
  const tasksTotal = await db.task.count({ where: { projectId: { in: projectIds } } });
  const tasksDone = await db.task.count({ where: { projectId: { in: projectIds }, column: "done" } });

  // Horas: soma dos apontamentos do workspace.
  const timeAgg = await db.timeLog.aggregate({
    where: { projectId: { in: projectIds } },
    _sum: { durationSec: true },
  });
  const distinctTimeProjects = await db.timeLog.findMany({
    where: { projectId: { in: projectIds } },
    distinct: ["projectId"],
    select: { projectId: true },
  });
  const hoursWeek = Math.round((timeAgg._sum.durationSec ?? 0) / 3600);

  // Carga do time: tarefas abertas (≠ done) atribuídas a cada pessoa, normalizado em %.
  const users = await db.user.findMany({
    where: { workspaceId },
    select: { id: true, name: true, initials: true, color: true },
    orderBy: { createdAt: "asc" },
  });
  const openByUser = await db.task.groupBy({
    by: ["assigneeId"],
    where: { projectId: { in: projectIds }, column: { not: "done" }, assigneeId: { not: null } },
    _count: { _all: true },
  });
  const openMap = new Map(openByUser.map((r) => [r.assigneeId as string, r._count._all]));
  const team: DashTeamMember[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    initials: u.initials,
    color: u.color,
    loadPct: Math.min(100, (openMap.get(u.id) ?? 0) * 28),
  }));
  const utilization =
    team.length > 0 ? Math.round(team.reduce((s, m) => s + m.loadPct, 0) / team.length) : 0;

  return {
    projects,
    statusCounts,
    projectsTotal: projects.length,
    projectsActive,
    tasksTotal,
    tasksDone,
    hoursWeek,
    hoursProjects: distinctTimeProjects.length,
    team,
    utilization,
  };
}
