import "server-only";
import { db } from "@/lib/db";
import { getProjectsList, type ProjectListItem } from "./projects";

export type ProdutividadeMes = { label: string; criadas: number; concluidas: number };

export type CargaPessoa = {
  id: string; name: string; initials: string; color: string; jobTitle: string;
  abertas: number; // tarefas não-done atribuídas
  vencidas: number; // abertas com dueDate estourado
  horas30d: number; // horas logadas nos últimos 30 dias
  projetos: number; // projetos distintos com tarefa aberta
};

export type TarefaVencida = {
  id: string; title: string; projectId: string; projectName: string;
  assigneeName: string | null; dueDate: Date; diasAtraso: number; column: string;
};

export type PrevisaoProjeto = {
  id: string; name: string; dueDate: Date | null;
  restantes: number; // tarefas não-done
  velocidadeSemana: number; // concluídas/semana (últimas 4 semanas)
  previsao: Date | null; // now + restantes/velocidade (null = sem ritmo)
  atrasoPrevistoDias: number | null; // previsao − dueDate (positivo = vai atrasar)
};

export type ReportsData = {
  tasksDone: number;
  budgetUsedPct: number;
  effortByArea: { label: string; pct: number }[];
  projects: ProjectListItem[];
  // Métricas reais de entrega (dependem de doneAt; null = sem histórico ainda).
  tempoMedioDias: number | null; // média createdAt→doneAt das concluídas
  noPrazoPct: number | null; // % concluídas até o dueDate (só tarefas com prazo)
  produtividade: ProdutividadeMes[]; // criadas × concluídas, últimos 6 meses
  carga: CargaPessoa[]; // capacidade do time (quem está sobrecarregado)
  vencidas: TarefaVencida[]; // tarefas com prazo estourado, mais antigas primeiro
  previsoes: PrevisaoProjeto[]; // ritmo × restantes × prazo (risco de atraso)
};

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getReportsData(workspaceId: string): Promise<ReportsData> {
  const projects = await getProjectsList(workspaceId);

  const DAY = 86400000;
  const now = new Date();
  const d30 = new Date(Date.now() - 30 * DAY);
  const d28 = new Date(Date.now() - 28 * DAY);

  const [tasksDone, rows, tags, concluidas, criadasRaw, users, abertas, logs30, projAtivos] = await Promise.all([
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
    db.user.findMany({ where: { workspaceId }, select: { id: true, name: true, initials: true, color: true, jobTitle: true } }),
    db.task.findMany({
      where: { project: { workspaceId }, column: { not: "done" } },
      select: { id: true, title: true, column: true, dueDate: true, assigneeId: true, projectId: true, assignee: { select: { name: true } }, project: { select: { name: true } } },
    }),
    db.timeLog.findMany({ where: { project: { workspaceId }, startedAt: { gte: d30 } }, select: { userId: true, durationSec: true } }),
    db.project.findMany({
      where: { workspaceId, status: { notIn: ["done"] } },
      select: { id: true, name: true, dueDate: true, tasks: { select: { column: true, doneAt: true } } },
    }),
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

  // ── Capacidade do time: tarefas abertas + vencidas + horas 30d por pessoa ──
  const horasMap = new Map<string, number>();
  for (const l of logs30) horasMap.set(l.userId, (horasMap.get(l.userId) ?? 0) + l.durationSec / 3600);
  const carga: CargaPessoa[] = users
    .map((u) => {
      const minhas = abertas.filter((t) => t.assigneeId === u.id);
      return {
        id: u.id, name: u.name, initials: u.initials, color: u.color, jobTitle: u.jobTitle,
        abertas: minhas.length,
        vencidas: minhas.filter((t) => t.dueDate && t.dueDate < now).length,
        horas30d: Math.round((horasMap.get(u.id) ?? 0) * 10) / 10,
        projetos: new Set(minhas.map((t) => t.projectId)).size,
      };
    })
    .sort((a, b) => b.abertas - a.abertas || b.horas30d - a.horas30d);

  // ── Tarefas vencidas (aging): prazo estourado, mais antigas primeiro ────────
  const vencidas: TarefaVencida[] = abertas
    .filter((t) => t.dueDate && t.dueDate < now)
    .map((t) => ({
      id: t.id, title: t.title, projectId: t.projectId, projectName: t.project.name,
      assigneeName: t.assignee?.name ?? null, dueDate: t.dueDate!, column: t.column,
      diasAtraso: Math.floor((+now - +t.dueDate!) / DAY),
    }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 20);

  // ── Previsão de entrega: ritmo (concluídas/semana, 4 semanas) × restantes ───
  const previsoes: PrevisaoProjeto[] = projAtivos
    .map((p) => {
      const restantes = p.tasks.filter((t) => t.column !== "done").length;
      const concluidas28 = p.tasks.filter((t) => t.doneAt && t.doneAt >= d28).length;
      const velocidadeSemana = Math.round((concluidas28 / 4) * 10) / 10;
      const previsao = restantes > 0 && velocidadeSemana > 0
        ? new Date(Date.now() + (restantes / velocidadeSemana) * 7 * DAY)
        : restantes === 0 ? now : null;
      const atrasoPrevistoDias = previsao && p.dueDate ? Math.round((+previsao - +p.dueDate) / DAY) : null;
      return { id: p.id, name: p.name, dueDate: p.dueDate, restantes, velocidadeSemana, previsao, atrasoPrevistoDias };
    })
    .filter((p) => p.restantes > 0)
    .sort((a, b) => (b.atrasoPrevistoDias ?? -Infinity) - (a.atrasoPrevistoDias ?? -Infinity));

  return { tasksDone, budgetUsedPct, effortByArea, projects, tempoMedioDias, noPrazoPct, produtividade, carga, vencidas, previsoes };
}
