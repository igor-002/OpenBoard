import { computeDelta, type Delta } from "@/lib/marketing/metrics";
import type { TaskDTO } from "@/server/marketing/task-source";
import { monthShort } from "@/lib/marketing/format";

// Cálculos de produção da equipe a partir das tarefas. Portado de
// openmarketing/lib/team-math.ts (ver docs/HANDOFF-OPENBOARD.md §3).
//
// Regras:
// - "Concluídas no mês"  → completedAt dentro do mês
// - "Atrasada"           → não concluída e dueDate no passado (derivado,
//                          não é um status gravado)
// - "No prazo"           → concluída com completedAt <= dueDate
// - "Tempo médio"        → média de (completedAt - createdAt) das
//                          tarefas concluídas no mês, em dias

function periodOf(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function endOfPeriod(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999); // último dia do mês
}

export function isOverdue(t: TaskDTO, ref: Date = new Date()): boolean {
  return (
    t.status !== "concluida" && t.dueDate !== null && new Date(t.dueDate) < ref
  );
}

export function completedInPeriod(tasks: TaskDTO[], period: string): TaskDTO[] {
  return tasks.filter(
    (t) => t.completedAt !== null && periodOf(t.completedAt) === period
  );
}

/** Atrasadas "na foto" do fim do período (comparável mês a mês) */
export function overdueAtEndOfPeriod(tasks: TaskDTO[], period: string): TaskDTO[] {
  const ref = new Date(Math.min(endOfPeriod(period).getTime(), Date.now()));
  return tasks.filter((t) => {
    if (t.dueDate === null || new Date(t.dueDate) >= ref) return false;
    if (new Date(t.createdAt) > ref) return false;
    // Ainda não concluída naquele momento
    return t.completedAt === null || new Date(t.completedAt) > ref;
  });
}

export interface TeamKpis {
  completed: Delta;
  inProgress: number;
  overdue: Delta; // menor = melhor
  onTimeRate: Delta; // % das concluídas do mês dentro do prazo
  avgDays: Delta; // menor = melhor
}

export function teamKpis(
  tasks: TaskDTO[],
  period: string,
  prevPeriod: string
): TeamKpis {
  const calc = (p: string) => {
    const done = completedInPeriod(tasks, p);
    const onTime = done.filter(
      (t) => t.dueDate === null || new Date(t.completedAt!) <= new Date(t.dueDate)
    );
    const avgDays =
      done.length === 0
        ? 0
        : done.reduce(
            (acc, t) =>
              acc +
              (new Date(t.completedAt!).getTime() -
                new Date(t.createdAt).getTime()) /
                86400000,
            0
          ) / done.length;
    return {
      completed: done.length,
      onTimeRate: done.length === 0 ? 0 : (onTime.length / done.length) * 100,
      avgDays,
      overdue: overdueAtEndOfPeriod(tasks, p).length,
    };
  };

  const now = calc(period);
  const prev = calc(prevPeriod);

  return {
    completed: computeDelta(now.completed, prev.completed),
    inProgress: tasks.filter((t) => t.status === "em_andamento").length,
    overdue: computeDelta(now.overdue, prev.overdue),
    onTimeRate: computeDelta(
      Math.round(now.onTimeRate),
      prev.completed === 0 ? null : Math.round(prev.onTimeRate)
    ),
    avgDays: computeDelta(
      Number(now.avgDays.toFixed(1)),
      prev.completed === 0 ? null : Number(prev.avgDays.toFixed(1))
    ),
  };
}

/** Concluídas por mês (últimos N meses) para o gráfico de produção */
export function monthlyProduction(
  tasks: TaskDTO[],
  months: string[]
): Array<{ period: string; label: string; concluidas: number }> {
  return months.map((p) => ({
    period: p,
    label: monthShort(p),
    concluidas: completedInPeriod(tasks, p).length,
  }));
}

/** Distribuição atual por status (com "atrasada" derivada) */
export function statusBreakdown(
  tasks: TaskDTO[]
): Array<{ status: string; label: string; count: number }> {
  const buckets = {
    concluida: 0,
    em_andamento: 0,
    pendente: 0,
    atrasada: 0,
  };
  for (const t of tasks) {
    if (isOverdue(t)) buckets.atrasada++;
    else buckets[t.status as keyof typeof buckets]++;
  }
  return [
    { status: "concluida", label: "Concluídas", count: buckets.concluida },
    { status: "em_andamento", label: "Em andamento", count: buckets.em_andamento },
    { status: "pendente", label: "Pendentes", count: buckets.pendente },
    { status: "atrasada", label: "Atrasadas", count: buckets.atrasada },
  ];
}

/** Últimos N períodos "YYYY-MM" terminando no mês atual */
export function lastPeriods(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
