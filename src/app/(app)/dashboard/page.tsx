import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/server/dashboard";
import { getUsers } from "@/server/users";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { Donut } from "@/components/charts/Charts";
import { ProjectRow } from "@/components/project/ProjectRow";
import { NewProjectButton } from "@/components/project/NewProjectButton";
import { STATUS_META } from "@/lib/meta";
import { dayLabel, deadlineInfo, deadlineColor } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, users] = await Promise.all([
    getDashboardData(user.workspaceId),
    getUsers(user.workspaceId),
  ]);
  const memberOpts = users.map((u) => ({ id: u.id, name: u.name }));

  const firstName = user.name.split(" ")[0];
  const donedPct = data.tasksTotal ? Math.round((data.tasksDone / data.tasksTotal) * 100) : 0;
  const inProgress = data.projects.filter((p) => p.status !== "done");
  const deadlines = inProgress
    .filter((p): p is typeof p & { dueDate: Date } => p.dueDate !== null)
    .sort((a, b) => +a.dueDate - +b.dueDate)
    .slice(0, 4);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-sub">Bem-vindo de volta, {firstName} — resumo do workspace.</p>
        </div>
        <div className="row gap12">
          <NewProjectButton users={memberOpts} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatCard icon="briefcase" label="Projetos ativos" value={data.projectsActive} foot={`de ${data.projectsTotal} no total`} accent="var(--primary)" />
        <StatCard icon="checkCircle" label="Tarefas concluídas" value={donedPct} suffix="%" foot={`de ${data.tasksTotal} tarefas`} accent="var(--st-done)" />
        <StatCard icon="users" label="Utilização do time" value={data.utilization} suffix="%" foot="carga média" accent="var(--st-progress)" />
        <StatCard icon="clock" label="Horas apontadas" value={data.hoursWeek} suffix="h" foot={`em ${data.hoursProjects} projetos`} accent="var(--st-review)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr", marginTop: "var(--gap)" }}>
        <Card
          title="Projetos em andamento"
          sub="Acompanhe o progresso de cada frente"
          action={<Link className="btn btn-ghost" href="/projects">Ver todos <Icon name="chevRight" size={15} /></Link>}
          pad={false}
        >
          <div style={{ padding: "4px 0 8px" }}>
            {inProgress.slice(0, 5).map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </div>
        </Card>

        <Card title="Status dos projetos" sub="Distribuição atual">
          <div className="row gap16" style={{ alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Donut size={134} stroke={20} segments={data.statusCounts.map((x) => ({ value: x.n, color: STATUS_META[x.status].c }))} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-display)" }}>{data.projectsTotal}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>projetos</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
              {data.statusCounts.map((x) => (
                <div key={x.status} className="row between">
                  <div className="row gap8">
                    <span className="bdot" style={{ width: 9, height: 9, background: STATUS_META[x.status].c }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{STATUS_META[x.status].label}</span>
                  </div>
                  <b style={{ fontSize: 13.5 }}>{x.n}</b>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "var(--gap)" }}>
        <Card title="Prazos próximos">
          {deadlines.length === 0 ? (
            <div className="muted" style={{ fontSize: 13.5 }}>Nenhum prazo definido.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {deadlines.map((p) => {
                const dl = deadlineInfo(p.dueDate);
                return (
                  <div key={p.id} className="row between">
                    <div className="row gap12">
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--ink-2)", flex: "none" }}>
                        <Icon name="calendar" size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{p.name.split("—")[0].trim()}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.client}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: deadlineColor(dl.tone) }}>{dl.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{dayLabel(p.dueDate)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Carga do time">
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {data.team.slice(0, 4).map((u) => (
              <div key={u.id} className="row gap12">
                <Avatar user={u} size={34} />
                <div style={{ flex: 1 }}>
                  <div className="row between" style={{ marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: u.loadPct > 85 ? "var(--st-risk)" : "var(--muted)" }}>{u.loadPct}%</span>
                  </div>
                  <ProgressBar value={u.loadPct} color={u.loadPct > 85 ? "var(--st-risk)" : "var(--primary)"} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
