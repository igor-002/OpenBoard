import "server-only";
import { db } from "@/lib/db";
import type { TimeLogStatus, AvatarUser } from "@/lib/types";

export type TimeLogRow = {
  id: string;
  userId: string;
  user: AvatarUser & { jobTitle: string };
  projectName: string;
  taskTitle: string;
  startedMs: number; // epoch do início do segmento atual (para cronômetro ao vivo)
  durationSec: number; // tempo já acumulado (committed)
  status: TimeLogStatus;
};

export type TimeData = {
  logs: TimeLogRow[];
  totalSec: number;
  members: number;
  projects: number;
  tasks: number;
  running: number;
  byProject: { name: string; pct: number }[];
  projectOpts: { id: string; name: string }[];
  currentUserId: string;
};

const liveElapsed = (l: { durationSec: number; status: TimeLogStatus; startedAt: Date }) =>
  l.durationSec + (l.status === "running" ? Math.max(0, Math.floor((Date.now() - l.startedAt.getTime()) / 1000)) : 0);

export type ActiveTimer = {
  id: string;
  taskTitle: string;
  projectName: string;
  durationSec: number;
  startedMs: number;
  status: TimeLogStatus;
};

// Timer em andamento do usuário, para o widget flutuante.
// Prioriza o que está RODANDO; se nenhum, o pausado mais recente.
export async function getActiveTimer(userId: string): Promise<ActiveTimer | null> {
  const l =
    (await db.timeLog.findFirst({
      where: { userId, status: "running" },
      orderBy: { startedAt: "desc" },
      include: { project: { select: { name: true } } },
    })) ??
    (await db.timeLog.findFirst({
      where: { userId, status: "paused" },
      orderBy: { startedAt: "desc" },
      include: { project: { select: { name: true } } },
    }));
  if (!l) return null;
  return {
    id: l.id,
    taskTitle: l.taskTitle,
    projectName: l.project.name,
    durationSec: l.durationSec,
    startedMs: l.startedAt.getTime(),
    status: l.status,
  };
}

export async function getTimeData(workspaceId: string, currentUserId: string): Promise<TimeData> {
  const [logs, projectOpts] = await Promise.all([
    db.timeLog.findMany({
      where: { project: { workspaceId } },
      orderBy: { startedAt: "asc" },
      include: {
        user: { select: { initials: true, color: true, name: true, jobTitle: true } },
        project: { select: { name: true } },
      },
    }),
    db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  // Tempo efetivo (inclui o segmento em andamento dos timers rodando).
  const totalSec = logs.reduce((s, l) => s + liveElapsed(l), 0);
  const members = new Set(logs.map((l) => l.userId)).size;
  const projects = new Set(logs.map((l) => l.projectId)).size;
  const tasks = new Set(logs.map((l) => l.taskTitle)).size;
  const running = logs.filter((l) => l.status === "running").length;

  const byProjMap = new Map<string, number>();
  for (const l of logs) byProjMap.set(l.project.name, (byProjMap.get(l.project.name) ?? 0) + liveElapsed(l));
  const byProject = [...byProjMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, sec]) => ({ name, pct: totalSec ? Math.round((sec / totalSec) * 100) : 0 }));

  return {
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      user: l.user,
      projectName: l.project.name,
      taskTitle: l.taskTitle,
      startedMs: l.startedAt.getTime(),
      durationSec: l.durationSec,
      status: l.status,
    })),
    totalSec,
    members,
    projects,
    tasks,
    running,
    byProject,
    projectOpts,
    currentUserId,
  };
}
