import "server-only";
import { db } from "@/lib/db";
import type { AvatarUser } from "@/lib/types";

export type TeamMemberCard = AvatarUser & {
  id: string;
  jobTitle: string;
  projects: number;
  tasks: number;
  completed: number;
  loadPct: number;
};

export type TeamData = {
  members: TeamMemberCard[];
  total: number;
  avgLoad: number;
  overloaded: number;
};

export async function getTeamData(workspaceId: string): Promise<TeamData> {
  const users = await db.user.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      initials: true,
      color: true,
      jobTitle: true,
      _count: { select: { memberships: true } },
    },
  });

  // tarefas atribuídas (totais e concluídas) e abertas por pessoa — inclui avulsas.
  const [assigned, completed, open] = await Promise.all([
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { not: null } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { not: null }, column: "done" }, _count: { _all: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { not: null }, column: { not: "done" } }, _count: { _all: true } }),
  ]);
  const map = (rows: { assigneeId: string | null; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.assigneeId as string, r._count._all]));
  const assignedMap = map(assigned);
  const completedMap = map(completed);
  const openMap = map(open);

  const members: TeamMemberCard[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    initials: u.initials,
    color: u.color,
    jobTitle: u.jobTitle,
    projects: u._count.memberships,
    tasks: assignedMap.get(u.id) ?? 0,
    completed: completedMap.get(u.id) ?? 0,
    loadPct: Math.min(100, (openMap.get(u.id) ?? 0) * 28),
  }));

  const avgLoad = members.length ? Math.round(members.reduce((s, m) => s + m.loadPct, 0) / members.length) : 0;
  const overloaded = members.filter((m) => m.loadPct > 85).length;

  return { members, total: members.length, avgLoad, overloaded };
}
