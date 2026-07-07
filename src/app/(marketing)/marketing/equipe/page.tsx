import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEmployees, listTasks } from "@/server/marketing/task-source";
import { teamKpis, monthlyProduction, statusBreakdown, lastPeriods, completedInPeriod } from "@/lib/marketing/team-math";
import { currentPeriod, previousPeriod, monthLong } from "@/lib/marketing/format";
import { StatCard } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { VerticalBars, SocialDonutCard, BarsList } from "@/components/marketing/SocialCharts";
import { TaskBoard } from "@/components/marketing/TaskBoard";

export default async function EquipePage() {
  await requireUser();
  const [employees, tasks] = await Promise.all([listEmployees(), listTasks()]);

  const period = currentPeriod();
  const prevPeriod = previousPeriod(period);
  const kpis = teamKpis(tasks, period, prevPeriod);
  const months = lastPeriods(6);
  const production = monthlyProduction(tasks, months);
  const status = statusBreakdown(tasks);

  const doneThisMonth = completedInPeriod(tasks, period);
  const ranking = employees
    .map((e) => ({ label: e.name, value: doneThisMonth.filter((t) => t.employeeId === e.id).length }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-sub">Produção da equipe de marketing — {monthLong(period)}</p>
        </div>
        <Link className="btn btn-ghost" href="/marketing/equipe/funcionarios">
          <Icon name="folder" size={15} /> Funcionários
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="card card-pad muted">
          Nenhum funcionário cadastrado. Cadastre em{" "}
          <Link href="/marketing/equipe/funcionarios">Funcionários</Link>.
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: "var(--gap)" }}>
            <StatCard
              icon="checkCircle"
              label="Concluídas no mês"
              value={kpis.completed.current}
              trend={kpis.completed.deltaPct != null ? Math.round(kpis.completed.deltaPct) : undefined}
              accent="var(--st-done)"
            />
            <StatCard icon="clock" label="Em andamento" value={kpis.inProgress} accent="var(--st-progress)" />
            <StatCard
              icon="alert"
              label="Atrasadas"
              value={kpis.overdue.current}
              trend={kpis.overdue.deltaPct != null ? Math.round(-kpis.overdue.deltaPct) : undefined}
              accent="var(--st-risk)"
            />
            <StatCard
              icon="target"
              label="No prazo"
              value={kpis.onTimeRate.current}
              suffix="%"
              trend={kpis.onTimeRate.deltaPct != null ? Math.round(kpis.onTimeRate.deltaPct) : undefined}
              accent="var(--primary)"
            />
            <StatCard
              icon="trendUp"
              label="Tempo médio"
              value={kpis.avgDays.current}
              suffix="dias"
              trend={kpis.avgDays.deltaPct != null ? Math.round(-kpis.avgDays.deltaPct) : undefined}
              accent="var(--pr-med)"
            />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
            <Card title="Produção mensal" sub="Tarefas concluídas por mês" pad>
              <VerticalBars data={production.map((p) => ({ label: p.label, value: p.concluidas }))} />
            </Card>
            <SocialDonutCard
              title="Distribuição atual"
              sub="Por status"
              items={status.map((s) => ({ label: s.label, value: s.count }))}
            />
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            <Card title="Ranking de produção" sub={`Concluídas em ${monthLong(period)}, por funcionário`} pad>
              <BarsList items={ranking} />
            </Card>
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            <TaskBoard tasks={tasks} employees={employees} />
          </div>
        </>
      )}
    </div>
  );
}
