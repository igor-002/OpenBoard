import { requireUser } from "@/lib/auth";
import { getTeamData } from "@/server/team";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";

export default async function TeamPage() {
  const user = await requireUser();
  const d = await getTeamData(user.workspaceId);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Time</h1>
          <p className="page-sub">{d.total} pessoas · alocação e disponibilidade</p>
        </div>
        <div className="row gap12">
          <button className="btn"><Icon name="filter" size={16} />Filtros</button>
          <button className="btn btn-primary"><Icon name="plus" size={16} />Convidar membro</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <StatCard icon="users" label="Membros ativos" value={d.total} foot="no workspace" accent="var(--primary)" />
        <StatCard icon="zap" label="Capacidade média" value={d.avgLoad} suffix="%" foot="carga do time" accent="var(--st-done)" />
        <StatCard icon="alert" label="Sobrecarregados" value={d.overloaded} foot="acima de 85%" accent="var(--st-risk)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", marginTop: "var(--gap)" }}>
        {d.members.map((u) => {
          const over = u.loadPct > 85;
          const label = over ? "Sobrecarregado" : u.loadPct < 50 ? "Disponível" : "Equilibrado";
          const c = over ? "var(--st-risk)" : u.loadPct < 50 ? "var(--muted)" : "var(--st-done)";
          const bg = over ? "var(--st-risk-bg)" : u.loadPct < 50 ? "var(--surface-3)" : "var(--st-done-bg)";
          return (
            <div key={u.id} className="card card-pad">
              <div className="row between" style={{ marginBottom: 16 }}>
                <div className="row gap12">
                  <Avatar user={u} size={48} />
                  <div>
                    <b style={{ fontSize: 15 }}>{u.name}</b>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{u.jobTitle}</div>
                  </div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32, border: "none", background: "none", color: "var(--muted)" }}>
                  <Icon name="more" size={18} />
                </button>
              </div>
              <div className="row" style={{ gap: 0, marginBottom: 16 }}>
                {[["Projetos", u.projects], ["Tarefas", u.tasks], ["Concluídas", u.completed]].map(([l, v], j) => (
                  <div key={l} style={{ flex: 1, borderLeft: j ? "1px solid var(--line)" : "none", paddingLeft: j ? 14 : 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)" }}>{v}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Alocação</span>
                <span className="badge" style={{ fontSize: 11, color: c, background: bg }}>{label} · {u.loadPct}%</span>
              </div>
              <ProgressBar value={u.loadPct} color={over ? "var(--st-risk)" : "var(--primary)"} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
