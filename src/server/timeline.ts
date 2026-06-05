import "server-only";
import { db } from "@/lib/db";
import { STATUS_META } from "@/lib/meta";
import { effectiveProgress } from "@/server/projects";
import type { AvatarUser, ProjectStatus } from "@/lib/types";

export type GanttBar = {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  progress: number;
  startDate: Date;
  dueDate: Date | null;
  startCol: number; // 0..11
  span: number; // 1..12
  members: AvatarUser[];
};

export type TimelineData = {
  year: number;
  bars: GanttBar[];
  today: number | null; // posição 0..12 da linha "Hoje" (null se o ano não for o atual)
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function getTimelineData(
  workspaceId: string,
  year: number = new Date().getFullYear(),
): Promise<TimelineData> {
  const projects = await db.project.findMany({
    where: { workspaceId },
    orderBy: { startDate: "asc" },
    include: {
      members: {
        orderBy: { order: "asc" },
        include: { user: { select: { initials: true, color: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });

  // Tarefas concluídas por projeto (progresso automático).
  const doneGroups = await db.task.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projects.map((p) => p.id) }, column: "done" },
    _count: { _all: true },
  });
  const doneMap = new Map(doneGroups.map((g) => [g.projectId, g._count._all]));

  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31, 23, 59, 59);

  const bars: GanttBar[] = projects
    // cruza o ano: começou até o fim do ano e (sem prazo OU prazo após início do ano)
    .filter((p) => p.startDate <= yEnd && (!p.dueDate || p.dueDate >= yStart))
    .map((p) => {
      const sMonth = p.startDate < yStart ? 0 : p.startDate.getMonth();
      // sem prazo → barra aberta até dezembro
      const eMonth = !p.dueDate || p.dueDate > yEnd ? 11 : p.dueDate.getMonth();
      const startCol = clamp(sMonth, 0, 11);
      const span = clamp(eMonth - startCol + 1, 1, 12 - startCol);
      return {
        id: p.id,
        name: p.name,
        color: STATUS_META[p.status].c,
        status: p.status,
        progress: effectiveProgress(p.manualProgress, doneMap.get(p.id) ?? 0, p._count.tasks),
        startDate: p.startDate,
        dueDate: p.dueDate,
        startCol,
        span,
        members: p.members.map((m) => m.user),
      };
    });

  const now = new Date();
  const today =
    now.getFullYear() === year
      ? now.getMonth() + (now.getDate() - 1) / 30
      : null;

  return { year, bars, today };
}
