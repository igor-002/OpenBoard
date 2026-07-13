import { requireModule } from "@/lib/permissions";
import { getReportsData } from "@/server/reports";
import { getProdutividadeReport, resolvePeriodo } from "@/server/relatorios";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { StatusBadge } from "@/components/ui/Badge";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { DailyBars, OrigemDonut, TipoBars, EstRealBars } from "@/components/reports/ProdCharts";
import { ORIGEM_META } from "@/lib/meta";
import { fullLabel, minLabel } from "@/lib/format";

const COL_LABEL: Record<string, string> = { todo: "A fazer", doing: "Em andamento", review: "Revisão", done: "Concluída" };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const user = await requireModule("gestao");
  const sp = await searchParams;
  const { from, to, preset } = resolvePeriodo(sp);

  const [p, d] = await Promise.all([
    getProdutividadeReport(user.workspaceId, from, to),
    getReportsData(user.workspaceId),
  ]);

  const pdfUrl = `/api/relatorios/produtividade?from=${iso(from)}&to=${iso(to)}`;
  const resumoUrl = `/api/relatorios/resumo?from=${iso(from)}&to=${iso(to)}`;
  const taxa = p.kpis.criadas > 0 ? Math.round((p.kpis.concluidas / p.kpis.criadas) * 100) : null;
  const desvio =
    p.kpis.estimadoTotalMin > 0
      ? Math.round(((p.kpis.realTotalMin - p.kpis.estimadoTotalMin) / p.kpis.estimadoTotalMin) * 100)
      : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-sub">
            Produtividade de {fullLabel(from)} até {fullLabel(to)}
          </p>
        </div>
        <div className="row gap12">
          <a className="btn" href={resumoUrl} target="_blank" rel="noopener">
            <Icon name="download" size={16} />
            Resumo (PDF simples)
          </a>
          <a className="btn btn-primary" href={pdfUrl} target="_blank" rel="noopener">
            <Icon name="download" size={16} />
            Relatório completo (PDF)
          </a>
        </div>
      </div>

      <PeriodPicker preset={preset} fromIso={iso(from)} toIso={iso(to)} />

      {/* KPIs do período */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
        <StatCard icon="plus" label="Criadas" value={p.kpis.criadas} foot="no período" accent="var(--primary)" />
        <StatCard
          icon="checkCircle"
          label="Concluídas"
          value={p.kpis.concluidas}
          foot={taxa != null ? `${taxa}% das criadas` : "no período"}
          accent="var(--st-done)"
        />
        <StatCard icon="circle" label="Abertas agora" value={p.kpis.abertasAtuais} foot={`${p.kpis.vencidasAtuais} vencidas`} accent="var(--st-progress)" />
        <StatCard
          icon="clock"
          label="Tempo médio"
          value={p.kpis.tempoMedioExecMin != null ? minLabel(p.kpis.tempoMedioExecMin) : "—"}
          foot="execução (início → fim)"
          accent="var(--st-review)"
        />
        <StatCard
          icon="target"
          label="No prazo"
          value={p.kpis.noPrazoPct != null ? String(p.kpis.noPrazoPct) : "—"}
          suffix={p.kpis.noPrazoPct != null ? "%" : undefined}
          foot="concluídas até o prazo"
          accent="var(--st-progress)"
        />
        <StatCard
          icon="zap"
          label="Estimado × real"
          value={desvio != null ? `${desvio > 0 ? "+" : ""}${desvio}%` : "—"}
          foot={
            p.kpis.estimadoTotalMin > 0
              ? `${minLabel(p.kpis.estimadoTotalMin)} → ${minLabel(p.kpis.realTotalMin)}`
              : "sem estimativas no período"
          }
          accent={desvio != null && desvio > 0 ? "var(--st-risk)" : "var(--st-done)"}
        />
      </div>

      {/* Atividade por dia + origem */}
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr", marginTop: "var(--gap)" }}>
        <Card title="Atividade no período" sub={`Criadas vs. concluídas por ${p.porDia.length > 0 && p.porDia[0].label.includes("–") ? "semana" : "dia"}`}>
          <DailyBars data={p.porDia} />
        </Card>
        <Card title="Origem da demanda" sub="Criadas no período — planejada vs. avulsa vs. presencial">
          <OrigemDonut data={p.porOrigem} />
        </Card>
      </div>

      {/* Tipo + cliente */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "var(--gap)" }}>
        <Card title="Por tipo de atividade" sub="Volume e tempo médio de execução">
          <TipoBars data={p.porTipo} />
        </Card>
        <Card title="Por cliente" sub="Clientes com mais demandas no período" pad={false}>
          {p.porCliente.length === 0 ? (
            <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nenhuma atividade vinculada a cliente no período.</div>
          ) : (
            <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
              <thead>
                <tr><th>Cliente</th><th style={{ textAlign: "right" }}>Demandas</th><th style={{ textAlign: "right" }}>Concluídas</th></tr>
              </thead>
              <tbody>
                {p.porCliente.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{c.razao}</div>
                      {c.ixcId && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>IXC {c.ixcId}</div>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{c.total}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{c.concluidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Produtividade por membro */}
      <Card title="Produtividade por pessoa" sub="Atividades no período + carga atual" style={{ marginTop: "var(--gap)" }} pad={false}>
        {p.porMembro.length === 0 ? (
          <div className="card-pad muted" style={{ fontSize: 13.5 }}>Sem atividade no período.</div>
        ) : (
          <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th style={{ textAlign: "right" }}>Criadas</th>
                <th style={{ textAlign: "right" }}>Concluídas</th>
                <th style={{ textAlign: "right" }}>Tempo médio</th>
                <th style={{ textAlign: "right" }}>Est. × real</th>
                <th style={{ textAlign: "right" }}>No prazo</th>
                <th style={{ textAlign: "right" }}>Horas apont.</th>
                <th style={{ textAlign: "right" }}>Abertas agora</th>
              </tr>
            </thead>
            <tbody>
              {p.porMembro.map((m) => {
                const estourou = m.estimadoMin > 0 && m.realMin > m.estimadoMin;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="row gap8" style={{ minWidth: 0 }}>
                        <Avatar user={m} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{m.jobTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{m.criadas}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{m.concluidas}</td>
                    <td style={{ textAlign: "right" }}>{m.tempoMedioMin != null ? minLabel(m.tempoMedioMin) : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {m.estimadoMin > 0 ? (
                        <span style={{ fontWeight: 600, color: estourou ? "var(--st-risk)" : "var(--st-done)" }}>
                          {minLabel(m.estimadoMin)} → {minLabel(m.realMin)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{m.noPrazoPct != null ? `${m.noPrazoPct}%` : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.horasApontadas > 0 ? `${m.horasApontadas.toLocaleString("pt-BR")}h` : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{m.abertasAtuais}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Estimado × real + prolongadas */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", marginTop: "var(--gap)" }}>
        <Card title="Estimado × real por pessoa" sub="Soma das concluídas com estimativa no período">
          <EstRealBars data={p.porMembro} />
        </Card>
        <Card title="Atividades se prolongando" sub="Abertas há mais tempo (snapshot atual)" pad={false}>
          {p.prolongadas.length === 0 ? (
            <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nada em aberto. 🎉</div>
          ) : (
            <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
              <thead>
                <tr><th>Atividade</th><th>Responsável</th><th>Etapa</th><th style={{ textAlign: "right" }}>Aberta há</th></tr>
              </thead>
              <tbody>
                {p.prolongadas.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.projectName ?? t.tipoName ?? "Avulsa"}</div>
                    </td>
                    <td style={{ color: t.assigneeName ? "var(--ink-2)" : "var(--muted)" }}>{t.assigneeName ?? "Sem responsável"}</td>
                    <td>{COL_LABEL[t.column] ?? t.column}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: t.diasAberta > 14 ? "var(--st-risk)" : "var(--ink-2)" }}>{t.diasAberta}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Concluídas no período (detalhe com relato) */}
      <Card title={`Concluídas no período (${p.concluidas.length})`} sub="Com relato de execução — clique para expandir" style={{ marginTop: "var(--gap)" }} pad={false}>
        {p.concluidas.length === 0 ? (
          <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nenhuma atividade concluída no período.</div>
        ) : (
          <div style={{ padding: "6px 0" }}>
            {p.concluidas.map((t) => (
              <details key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                <summary className="row between" style={{ padding: "10px 20px", cursor: "pointer", listStyle: "none", gap: 12 }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.title}</span>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                      {t.assigneeName ?? "—"} · {t.tipoName ?? "sem tipo"}{t.clienteRazao ? ` · ${t.clienteRazao}` : ""}
                    </span>
                  </span>
                  <span className="row gap8" style={{ whiteSpace: "nowrap" }}>
                    <span className="badge" style={{ color: ORIGEM_META[t.origem].c, background: ORIGEM_META[t.origem].bg }}>{ORIGEM_META[t.origem].label}</span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                      {t.realMinutes != null ? minLabel(t.realMinutes) : "—"}
                      {t.estimatedMinutes != null ? ` / est. ${minLabel(t.estimatedMinutes)}` : ""}
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{fullLabel(t.doneAt)}</span>
                  </span>
                </summary>
                <div style={{ padding: "0 20px 12px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
                  {t.projectName && <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Projeto: {t.projectName} · {t.updates} atualização{t.updates === 1 ? "" : "s"} na linha do tempo</div>}
                  {t.report ? <div style={{ whiteSpace: "pre-wrap" }}>{t.report}</div> : <span className="muted">Sem relato registrado.</span>}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      {/* ── Visão geral (snapshot, independe do período) ── */}
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "28px 4px 12px", color: "var(--ink)" }}>Visão geral do workspace</h2>

      <Card title="Desempenho por projeto" sub="Métricas-chave de cada frente" pad={false}>
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
            {d.projects.map((p2) => {
              const lead = p2.members[0];
              return (
                <tr key={p2.id}>
                  <td>
                    <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p2.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p2.client}</div>
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
                      <div style={{ flex: 1 }}><ProgressBar value={p2.progress} color={p2.status === "done" ? "var(--st-done)" : "var(--primary)"} /></div>
                      <b style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{p2.progress}%</b>
                    </div>
                  </td>
                  <td style={{ color: p2.risk ? "var(--st-risk)" : "var(--ink-2)", fontWeight: 600, whiteSpace: "nowrap" }}>{p2.dueDate ? fullLabel(p2.dueDate) : "Sem prazo"}</td>
                  <td><StatusBadge status={p2.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", marginTop: "var(--gap)" }}>
        <Card title="Capacidade do time" sub="Tarefas abertas, atrasos e horas logadas (30d) por pessoa" pad={false}>
          <table className="tbl" style={{ marginTop: 6, width: "100%" }}>
            <thead>
              <tr><th>Pessoa</th><th style={{ textAlign: "right" }}>Abertas</th><th style={{ textAlign: "right" }}>Vencidas</th><th style={{ textAlign: "right" }}>Projetos</th><th style={{ textAlign: "right" }}>Horas (30d)</th></tr>
            </thead>
            <tbody>
              {d.carga.map((pc) => (
                <tr key={pc.id}>
                  <td>
                    <div className="row gap8" style={{ minWidth: 0 }}>
                      <Avatar user={pc} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pc.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{pc.jobTitle}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{pc.abertas}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: pc.vencidas > 0 ? "var(--st-risk)" : "var(--muted)" }}>{pc.vencidas || "—"}</td>
                  <td style={{ textAlign: "right" }}>{pc.projetos || "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pc.horas30d > 0 ? `${pc.horas30d.toLocaleString("pt-BR")}h` : <span className="muted">—</span>}</td>
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
                {d.previsoes.map((pv) => {
                  const atrasa = pv.atrasoPrevistoDias != null && pv.atrasoPrevistoDias > 0;
                  return (
                    <tr key={pv.id}>
                      <td>
                        <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{pv.name}</div>
                        {pv.dueDate && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>prazo {fullLabel(pv.dueDate)}</div>}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{pv.restantes}</td>
                      <td style={{ textAlign: "right" }}>{pv.velocidadeSemana > 0 ? pv.velocidadeSemana.toLocaleString("pt-BR") : <span className="muted">0</span>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {pv.previsao == null ? (
                          <span title="Nenhuma tarefa concluída nas últimas 4 semanas" style={{ color: "var(--st-risk)", fontWeight: 700 }}>sem ritmo</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: atrasa ? "var(--st-risk)" : "var(--st-done)" }}>
                            {fullLabel(pv.previsao)}
                            {pv.atrasoPrevistoDias != null && (
                              <span style={{ fontSize: 11.5, marginLeft: 6, color: atrasa ? "var(--st-risk)" : "var(--muted)" }}>
                                {atrasa ? `+${pv.atrasoPrevistoDias}d` : "no prazo"}
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
