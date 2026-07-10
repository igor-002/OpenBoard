import { requireModule } from "@/lib/permissions";
import { getReportsData } from "@/server/reports";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { StatusBadge } from "@/components/ui/Badge";
import { Donut } from "@/components/charts/Charts";
import { fullLabel } from "@/lib/format";

const COL_LABEL: Record<string, string> = { todo: "A fazer", doing: "Em andamento", review: "Revisão", done: "Concluída" };

const AREA_COLORS = ["var(--c1)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

export default async function ReportsPage() {
  const user = await requireModule("gestao");
  const d = await getReportsData(user.workspaceId);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-sub">Desempenho consolidado do workspace</p>
        </div>
        <div className="row gap12">
          <button className="btn"><Icon name="download" size={16} />Exportar PDF</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <StatCard icon="checkCircle" label="Tarefas concluídas" value={d.tasksDone} foot="no total" accent="var(--st-done)" />
        <StatCard
          icon="clock"
          label="Tempo médio de entrega"
          value={d.tempoMedioDias != null ? String(d.tempoMedioDias) : "—"}
          suffix={d.tempoMedioDias != null ? "d" : undefined}
          foot={d.tempoMedioDias != null ? "criação → conclusão" : "sem conclusões registradas ainda"}
          accent="var(--primary)"
        />
        <StatCard
          icon="target"
          label="Entrega no prazo"
          value={d.noPrazoPct != null ? String(d.noPrazoPct) : "—"}
          suffix={d.noPrazoPct != null ? "%" : undefined}
          foot={d.noPrazoPct != null ? "concluídas até o prazo" : "sem concluídas com prazo ainda"}
          accent="var(--st-progress)"
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", marginTop: "var(--gap)" }}>
        <Card
          title="Produtividade"
          sub="Tarefas criadas vs. concluídas por mês — últimos 6 meses"
          action={
            <div className="row gap16">
              <div className="row gap8"><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--primary)" }} /><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Criadas</span></div>
              <div className="row gap8"><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} /><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Concluídas</span></div>
            </div>
          }
        >
          {(() => {
            const max = Math.max(...d.produtividade.map((m) => Math.max(m.criadas, m.concluidas)), 1);
            return (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 210, padding: "8px 4px 0" }}>
                {d.produtividade.map((m) => (
                  <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5 }}>
                      <div title={`Criadas: ${m.criadas}`} style={{ width: 18, height: `${(m.criadas / max) * 100}%`, background: "var(--primary)", borderRadius: "5px 5px 0 0", minHeight: m.criadas ? 4 : 0 }} />
                      <div title={`Concluídas: ${m.concluidas}`} style={{ width: 18, height: `${(m.concluidas / max) * 100}%`, background: "var(--st-done)", borderRadius: "5px 5px 0 0", minHeight: m.concluidas ? 4 : 0 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{m.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>

        <Card title="Esforço por área" sub="Por tag de tarefa">
          {d.effortByArea.length === 0 ? (
            <div className="muted" style={{ fontSize: 13.5 }}>Sem tags ainda.</div>
          ) : (
            <div className="row gap16" style={{ alignItems: "center", flexDirection: "column" }}>
              <div style={{ position: "relative", alignSelf: "center" }}>
                <Donut size={150} stroke={24} segments={d.effortByArea.map((a, i) => ({ value: a.pct, color: AREA_COLORS[i % AREA_COLORS.length] }))} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{d.effortByArea.length}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>áreas</div>
                  </div>
                </div>
              </div>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {d.effortByArea.map((a, i) => (
                  <div key={a.label} className="row between">
                    <div className="row gap8">
                      <span className="bdot" style={{ width: 9, height: 9, background: AREA_COLORS[i % AREA_COLORS.length] }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{a.label}</span>
                    </div>
                    <b style={{ fontSize: 13 }}>{a.pct}%</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Desempenho por projeto" sub="Métricas-chave de cada frente" style={{ marginTop: "var(--gap)" }} pad={false}>
        <table className="tbl" style={{ marginTop: 6, tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr><th>Projeto</th><th>Responsável</th><th>Progresso</th><th>Prazo</th><th>Status</th></tr>
          </thead>
          <tbody>
            {d.projects.map((p) => {
              const lead = p.members[0];
              return (
                <tr key={p.id}>
                  <td>
                    <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.client}</div>
                  </td>
                  <td>
                    {lead ? (
                      <div className="row gap8" style={{ minWidth: 0 }}>
                        <Avatar user={lead} size={28} />
                        <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.name?.split(" ")[0]}</span>
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="row gap12">
                      <div style={{ flex: 1 }}><ProgressBar value={p.progress} color={p.status === "done" ? "var(--st-done)" : "var(--primary)"} /></div>
                      <b style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{p.progress}%</b>
                    </div>
                  </td>
                  <td style={{ color: p.risk ? "var(--st-risk)" : "var(--ink-2)", fontWeight: 600, whiteSpace: "nowrap" }}>{p.dueDate ? fullLabel(p.dueDate) : "Sem prazo"}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Capacidade do time + previsão de entrega */}
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", marginTop: "var(--gap)" }}>
        <Card title="Capacidade do time" sub="Tarefas abertas, atrasos e horas logadas (30d) por pessoa" pad={false}>
          <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
            <thead>
              <tr><th>Pessoa</th><th style={{ textAlign: "right" }}>Abertas</th><th style={{ textAlign: "right" }}>Vencidas</th><th style={{ textAlign: "right" }}>Projetos</th><th style={{ textAlign: "right" }}>Horas (30d)</th></tr>
            </thead>
            <tbody>
              {d.carga.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row gap8" style={{ minWidth: 0 }}>
                      <Avatar user={p} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.jobTitle}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{p.abertas}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: p.vencidas > 0 ? "var(--st-risk)" : "var(--muted)" }}>{p.vencidas || "—"}</td>
                  <td style={{ textAlign: "right" }}>{p.projetos || "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.horas30d > 0 ? `${p.horas30d.toLocaleString("pt-BR")}h` : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Previsão de entrega" sub="Ritmo atual (concluídas/semana) × tarefas restantes" pad={false}>
          {d.previsoes.length === 0 ? (
            <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nenhum projeto ativo com tarefas pendentes.</div>
          ) : (
            <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
              <thead>
                <tr><th>Projeto</th><th style={{ textAlign: "right" }}>Restantes</th><th style={{ textAlign: "right" }}>Ritmo/sem</th><th style={{ textAlign: "right" }}>Previsão</th></tr>
              </thead>
              <tbody>
                {d.previsoes.map((p) => {
                  const atrasa = p.atrasoPrevistoDias != null && p.atrasoPrevistoDias > 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{p.name}</div>
                        {p.dueDate && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>prazo {fullLabel(p.dueDate)}</div>}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{p.restantes}</td>
                      <td style={{ textAlign: "right" }}>{p.velocidadeSemana > 0 ? p.velocidadeSemana.toLocaleString("pt-BR") : <span className="muted">0</span>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {p.previsao == null ? (
                          <span title="Nenhuma tarefa concluída nas últimas 4 semanas" style={{ color: "var(--st-risk)", fontWeight: 700 }}>sem ritmo</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: atrasa ? "var(--st-risk)" : "var(--st-done)" }}>
                            {fullLabel(p.previsao)}
                            {p.atrasoPrevistoDias != null && (
                              <span style={{ fontSize: 11.5, marginLeft: 6, color: atrasa ? "var(--st-risk)" : "var(--muted)" }}>
                                {atrasa ? `+${p.atrasoPrevistoDias}d` : "no prazo"}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Tarefas vencidas (aging) */}
      <Card title="Tarefas vencidas" sub="Prazo estourado — mais atrasadas primeiro" style={{ marginTop: "var(--gap)" }} pad={false}>
        {d.vencidas.length === 0 ? (
          <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nenhuma tarefa com prazo estourado. 🎉</div>
        ) : (
          <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
            <thead>
              <tr><th>Tarefa</th><th>Projeto</th><th>Responsável</th><th>Etapa</th><th style={{ textAlign: "right" }}>Prazo</th><th style={{ textAlign: "right" }}>Atraso</th></tr>
            </thead>
            <tbody>
              {d.vencidas.map((t) => (
                <tr key={t.id}>
                  <td><div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{t.title}</div></td>
                  <td style={{ color: "var(--ink-2)" }}>{t.projectName}</td>
                  <td style={{ color: t.assigneeName ? "var(--ink-2)" : "var(--muted)" }}>{t.assigneeName ?? "Sem responsável"}</td>
                  <td>{COL_LABEL[t.column] ?? t.column}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--ink-2)" }}>{fullLabel(t.dueDate)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "var(--st-risk)" }}>{t.diasAtraso}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
