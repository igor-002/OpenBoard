import "server-only";
import { db } from "@/lib/db";
import { getProjectsList, type ProjectListItem } from "./projects";

export type ProdutividadeMes = { label: string; criadas: number; concluidas: number };

export type ReportsData = {
  tasksDone: number;
  budgetUsedPct: number;
  effortByArea: { label: string; pct: number }[];
  projects: ProjectListItem[];
  // Métricas reais de entrega (dependem de doneAt; null = sem histórico ainda).
  tempoMedioDias: number | null; // média createdAt→doneAt das concluídas
  noPrazoPct: number | null; // % concluídas até o dueDate (só tarefas com prazo)
  produtividade: ProdutividadeMes[]; // criadas × concluídas, últimos 6 meses
};

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getReportsData(workspaceId: string): Promise<ReportsData> {
  const projects = await getProjectsList(workspaceId);

  const [tasksDone, rows, tags, concluidas, criadasRaw] = await Promise.all([
    db.task.count({ where: { project: { workspaceId }, column: "done" } }),
    db.project.findMany({ where: { workspaceId }, select: { budgetCents: true, spentPct: true } }),
    db.taskTag.groupBy({
      by: ["label"],
      where: { task: { project: { workspaceId } } },
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 5,
    }),
    db.task.findMany({
      where: { project: { workspaceId }, column: "done", doneAt: { not: null } },
      select: { createdAt: true, doneAt: true, dueDate: true },
    }),
    db.task.findMany({ where: { project: { workspaceId } }, select: { createdAt: true } }),
  ]);

  // Orçamento consumido: gasto ponderado pelo budget de cada projeto.
  const totalBudget = rows.reduce((s, r) => s + r.budgetCents, 0);
  const totalSpent = rows.reduce((s, r) => s + (r.budgetCents * r.spentPct) / 100, 0);
  const budgetUsedPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // Esforço por área: top tags de tarefas.
  const totalTags = tags.reduce((s, t) => s + t._count._all, 0) || 1;
  const effortByArea = tags.map((t) => ({
    label: t.label,
    pct: Math.round((t._count._all / totalTags) * 100),
  }));

  // Tempo médio de entrega (createdAt → doneAt) e % no prazo — só dado real.
  const duracoes = concluidas.map((t) => (+t.doneAt! - +t.createdAt) / 86400000).filter((d) => d >= 0);
  const tempoMedioDias = duracoes.length
    ? Math.round((duracoes.reduce((a, d) => a + d, 0) / duracoes.length) * 10) / 10
    : null;
  const comPrazo = concluidas.filter((t) => t.dueDate);
  const noPrazoPct = comPrazo.length
    ? Math.round((comPrazo.filter((t) => +t.doneAt! <= +t.dueDate! + 86400000).length / comPrazo.length) * 100)
    : null;

  // Produtividade: criadas × concluídas por mês (últimos 6, incluindo o atual).
  const now = new Date();
  const produtividade: ProdutividadeMes[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prox = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    produtividade.push({
      label: `${MES_CURTO[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`,
      criadas: criadasRaw.filter((t) => t.createdAt >= ref && t.createdAt < prox).length,
      concluidas: concluidas.filter((t) => t.doneAt! >= ref && t.doneAt! < prox).length,
    });
  }

  return { tasksDone, budgetUsedPct, effortByArea, projects, tempoMedioDias, noPrazoPct, produtividade };
}
