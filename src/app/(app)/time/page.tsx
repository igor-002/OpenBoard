import { requireModule } from "@/lib/permissions";
import { getTimeData } from "@/server/time";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { ProgressBar } from "@/components/ui/Progress";
import { StartTimerButton, TimeLogTable } from "@/components/time/TimeTracker";
import { hms } from "@/lib/format";

const PROJ_COLORS = ["var(--primary)", "var(--st-review)", "var(--st-progress)", "var(--st-done)"];

export default async function TimePage() {
  const user = await requireModule("gestao");
  const d = await getTimeData(user.workspaceId, user.id);
  const hours = Math.round(d.totalSec / 3600);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Controle de tempo</h1>
          <p className="page-sub">{d.members} membros · {d.logs.length} apontamentos</p>
        </div>
        <div className="row gap12">
          <StartTimerButton projects={d.projectOpts} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatCard icon="clock" label="Horas apontadas" value={hours} suffix="h" foot="no período" accent="var(--primary)" />
        <StatCard icon="play" label="Timers ativos" value={d.running} foot="em execução" accent="var(--st-done)" />
        <StatCard icon="checkCircle" label="Apontamentos" value={d.logs.length} foot="lançados" accent="var(--st-review)" />
        <StatCard icon="users" label="Membros ativos" value={d.members} foot={`em ${d.projects} projetos`} accent="var(--st-progress)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.6fr", marginTop: "var(--gap)" }}>
        <Card title="Tempo acumulado" sub="Toda a equipe">
          <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-1.5px", fontVariantNumeric: "tabular-nums", margin: "4px 0" }}>
            {hms(d.totalSec)}
          </div>
          <div className="row gap16" style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 18 }}>
            {[["Membros", d.members], ["Projetos", d.projects], ["Tarefas", d.tasks]].map(([l, v]) => (
              <div key={l} style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{v}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "var(--line)", margin: "18px 0" }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 12 }}>POR PROJETO</div>
          {d.byProject.map((p, i) => (
            <div key={p.name} style={{ marginBottom: 13 }}>
              <div className="row between" style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name.split("—")[0].trim()}</span>
                <b style={{ fontSize: 12.5 }}>{p.pct}%</b>
              </div>
              <ProgressBar value={p.pct} color={PROJ_COLORS[i % PROJ_COLORS.length]} />
            </div>
          ))}
        </Card>

        <Card title="Apontamentos" sub="Quem está trabalhando em quê" pad={false}>
          <TimeLogTable data={d} />
        </Card>
      </div>
    </div>
  );
}
