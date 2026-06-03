import "server-only";
import { db } from "@/lib/db";
import { getProjectsList, type ProjectListItem } from "./projects";

export type ReportsData = {
  tasksDone: number;
  budgetUsedPct: number;
  effortByArea: { label: string; pct: number }[];
  projects: ProjectListItem[];
};

export async function getReportsData(workspaceId: string): Promise<ReportsData> {
  const projects = await getProjectsList(workspaceId);

  const tasksDone = await db.task.count({
    where: { project: { workspaceId }, column: "done" },
  });

  // Orçamento consumido: gasto ponderado pelo budget de cada projeto.
  const rows = await db.project.findMany({
    where: { workspaceId },
    select: { budgetCents: true, spentPct: true },
  });
  const totalBudget = rows.reduce((s, r) => s + r.budgetCents, 0);
  const totalSpent = rows.reduce((s, r) => s + (r.budgetCents * r.spentPct) / 100, 0);
  const budgetUsedPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // Esforço por área: top tags de tarefas.
  const tags = await db.taskTag.groupBy({
    by: ["label"],
    where: { task: { project: { workspaceId } } },
    _count: { _all: true },
    orderBy: { _count: { label: "desc" } },
    take: 5,
  });
  const totalTags = tags.reduce((s, t) => s + t._count._all, 0) || 1;
  const effortByArea = tags.map((t) => ({
    label: t.label,
    pct: Math.round((t._count._all / totalTags) * 100),
  }));

  return { tasksDone, budgetUsedPct, effortByArea, projects };
}
