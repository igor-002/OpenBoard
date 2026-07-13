// Relatórios do funil de Leads: tempo em fila, conversão, aging, responsáveis.
// Tudo real (Lead + LeadStageEvent) — nada estimado ou inventado.
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLeadsStats } from "@/server/comercial/leads-stats";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { brl } from "@/lib/format";
import { AutoRefresh } from "@/components/common/AutoRefresh";

function fmtDias(d: number | null): string {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;
}

export default async function LeadsRelatoriosPage() {
  await requireUser();
  const s = await getLeadsStats();
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13.5, borderTop: "1px solid var(--line)", verticalAlign: "middle" };

  return (
    <div className="page">
      <AutoRefresh seconds={60} />
      <div className="page-head">
        <div>
          <Link href="/comercial/leads" className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="chevLeft" size={14} /> Leads
          </Link>
          <h1 className="page-title">Relatórios de Leads</h1>
          <p className="page-sub">Tempo em fila, conversão do funil e gargalos — dados reais do histórico de movimentações.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: "var(--gap)" }}>
        <StatCard icon="target" label="Leads ativos" value={s.kpis.ativos} foot={`${brl(s.kpis.valorAbertoCents)} em aberto`} accent="var(--st-progress)" />
        <StatCard icon="wallet" label="Previsão ponderada" value={brl(s.kpis.forecastCents)} foot="valor em aberto × prob. do estágio" accent="var(--st-review)" />
        <StatCard icon="check" label="Aprovados (30d)" value={s.kpis.ganhos30d} foot={`${brl(s.kpis.valorGanho30dCents)} · ${s.kpis.perdidos30d} sem resposta`} accent="var(--st-done)" />
        <StatCard icon="trendUp" label="Taxa de conversão" value={s.kpis.taxaConversao != null ? `${s.kpis.taxaConversao}%` : "—"} foot={s.kpis.cicloMedioDias != null ? `ciclo médio ${fmtDias(s.kpis.cicloMedioDias)} até aprovar` : "sem leads fechados ainda"} accent="var(--primary)" />
        <StatCard icon="alert" label="Parados há +7 dias" value={s.kpis.paradosMais7d} foot="ativos sem mudar de fila" accent="var(--st-risk)" />
      </div>

      {/* Funil + tempo médio por estágio */}
      <div className="grid" style={{ gridTemplateColumns: "1.1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Funil de conversão" sub="Quantos leads chegaram a cada etapa (histórico completo)" pad>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {s.funil.map((f) => (
              <div key={f.id} className="row gap12" style={{ alignItems: "center" }}>
                <span style={{ width: 92, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{f.label}</span>
                <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "var(--r-pill)", height: 28, position: "relative", overflow: "hidden" }}>
                  <div style={{ width: `${f.pct}%`, background: f.c, height: "100%", borderRadius: "var(--r-pill)", minWidth: f.reached > 0 ? 28 : 0, transition: "width .3s" }} />
                  <span style={{ position: "absolute", right: 12, top: 0, height: "100%", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>
                    {f.reached}<span className="muted" style={{ fontWeight: 700, fontSize: 12 }}>{f.pct}%</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tempo médio por fila" sub="Quanto tempo um lead fica em cada estágio antes de sair" pad>
          {s.tempoMedioEstagio.every((t) => t.mediaDias == null) ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Ainda sem movimentações registradas — mova leads no Kanban para alimentar este relatório.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(() => {
                const max = Math.max(...s.tempoMedioEstagio.map((t) => t.mediaDias ?? 0), 0.01);
                return s.tempoMedioEstagio.map((t) => (
                  <div key={t.id} className="row gap12" style={{ alignItems: "center" }}>
                    <span style={{ width: 92, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{t.label}</span>
                    <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "var(--r-pill)", height: 24, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${((t.mediaDias ?? 0) / max) * 100}%`, background: t.c, height: "100%", borderRadius: "var(--r-pill)", minWidth: t.mediaDias != null ? 24 : 0 }} />
                    </div>
                    <span style={{ width: 74, textAlign: "right", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {fmtDias(t.mediaDias)}
                      <span className="muted" style={{ fontWeight: 600, fontSize: 11, marginLeft: 4 }}>({t.amostras})</span>
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* Foto atual por fila */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Situação atual das filas" sub="Quem está em cada estágio agora e há quanto tempo" pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-3)" }}>
                  <th style={th}>Fila</th>
                  <th style={{ ...th, textAlign: "right" }}>Leads</th>
                  <th style={{ ...th, textAlign: "right" }}>Valor estimado</th>
                  <th style={{ ...th, textAlign: "right" }}>Tempo médio na fila</th>
                  <th style={{ ...th, textAlign: "right" }}>Mais antigo</th>
                </tr>
              </thead>
              <tbody>
                {s.porEstagio.map((e) => (
                  <tr key={e.id}>
                    <td style={td}>
                      <span className="row gap8" style={{ alignItems: "center", fontWeight: 700, color: e.c }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: e.c }} />{e.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{e.count}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{e.valorCents > 0 ? brl(e.valorCents) : <span className="muted">—</span>}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtDias(e.mediaDias)}</td>
                    <td style={{ ...td, textAlign: "right", color: e.maxDias != null && e.maxDias > 7 && e.id !== "ganho" && e.id !== "perdido" ? "var(--st-risk)" : "var(--ink-2)", fontWeight: e.maxDias != null && e.maxDias > 7 ? 700 : 400 }}>{fmtDias(e.maxDias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Aging + entrada semanal */}
      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Leads parados há mais tempo" sub="Ativos que não mudam de fila — candidatos a follow-up" pad={false}>
          {s.aging.length === 0 ? (
            <div className="card-pad muted">Nenhum lead ativo no funil.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-3)" }}>
                    <th style={th}>Lead</th>
                    <th style={th}>Fila</th>
                    <th style={{ ...th, textAlign: "right" }}>Na fila há</th>
                    <th style={{ ...th, textAlign: "right" }}>Sem contato há</th>
                    <th style={th}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {s.aging.map((a) => {
                    const risco = a.dias > 7;
                    return (
                      <tr key={a.id}>
                        <td style={td}>
                          <Link href={`/comercial/leads/${a.id}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{a.nome}</Link>
                          {a.empresa && <div className="muted" style={{ fontSize: 12 }}>{a.empresa}</div>}
                        </td>
                        <td style={td}>
                          {(() => {
                            const meta = s.porEstagio.find((e) => e.id === a.stage);
                            return (
                              <span className="row gap8" style={{ alignItems: "center", fontSize: 12.5, fontWeight: 700, color: meta?.c }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta?.c }} />{meta?.label ?? a.stage}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 800, color: risco ? "var(--st-risk)" : "var(--ink)" }}>{fmtDias(a.dias)}</td>
                        <td style={{ ...td, textAlign: "right", color: "var(--muted)" }}>{fmtDias(a.semContatoDias)}</td>
                        <td style={{ ...td, color: a.assignedUserName ? "var(--ink-2)" : "var(--muted)" }}>{a.assignedUserName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Entrada de leads por semana" sub="Novos leads × aprovados nas últimas 8 semanas" pad>
          {s.entradaSemanas.every((w) => w.novos === 0 && w.ganhos === 0) ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem leads no período.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, padding: "8px 4px 0" }}>
                {(() => {
                  const max = Math.max(...s.entradaSemanas.map((w) => Math.max(w.novos, w.ganhos)), 1);
                  return s.entradaSemanas.map((w) => (
                    <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                        <div title={`Novos: ${w.novos}`} style={{ width: 13, height: `${(w.novos / max) * 100}%`, background: "var(--st-progress)", borderRadius: "4px 4px 0 0", minHeight: w.novos ? 4 : 0 }} />
                        <div title={`Aprovados: ${w.ganhos}`} style={{ width: 13, height: `${(w.ganhos / max) * 100}%`, background: "var(--st-done)", borderRadius: "4px 4px 0 0", minHeight: w.ganhos ? 4 : 0 }} />
                      </div>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{w.label}</span>
                    </div>
                  ));
                })()}
              </div>
              <div className="row gap12" style={{ justifyContent: "center", marginTop: 8, fontSize: 12 }}>
                <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-progress)" }} /> Novos</span>
                <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} /> Aprovados</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Responsáveis + origem */}
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Por responsável" sub="Carga atual e resultado de cada atendente" pad={false}>
          {s.porResponsavel.length === 0 ? (
            <div className="card-pad muted">Nenhum lead cadastrado.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-3)" }}>
                    <th style={th}>Responsável</th>
                    <th style={{ ...th, textAlign: "right" }}>Ativos</th>
                    <th style={{ ...th, textAlign: "right" }}>Em aberto</th>
                    <th style={{ ...th, textAlign: "right" }}>Aprovados</th>
                    <th style={{ ...th, textAlign: "right" }}>Sem resposta</th>
                    <th style={{ ...th, textAlign: "right" }}>Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {s.porResponsavel.map((r) => (
                    <tr key={r.name}>
                      <td style={{ ...td, fontWeight: 700, color: r.name === "Sem responsável" ? "var(--muted)" : "var(--ink)" }}>{r.name}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.ativos}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.valorAbertoCents > 0 ? brl(r.valorAbertoCents) : <span className="muted">—</span>}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{r.ganhos}</td>
                      <td style={{ ...td, textAlign: "right", color: "var(--st-risk)" }}>{r.perdidos}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.conversao != null ? `${r.conversao}%` : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Por origem" sub="Conversão e receita por canal — onde vale investir" pad={false}>
          {s.porOrigem.length === 0 ? (
            <div className="card-pad muted">Nenhum lead cadastrado.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-3)" }}>
                    <th style={th}>Origem</th>
                    <th style={{ ...th, textAlign: "right" }}>Total</th>
                    <th style={{ ...th, textAlign: "right" }}>Ativos</th>
                    <th style={{ ...th, textAlign: "right" }}>Aprovados</th>
                    <th style={{ ...th, textAlign: "right" }}>Conversão</th>
                    <th style={{ ...th, textAlign: "right" }}>Valor aprovado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.porOrigem.map((o) => (
                    <tr key={o.origem}>
                      <td style={{ ...td, fontWeight: 700 }}>{o.origem}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{o.total}</td>
                      <td style={{ ...td, textAlign: "right" }}>{o.ativos}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{o.ganhos}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{o.conversao != null ? `${o.conversao}%` : <span className="muted">—</span>}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{o.valorGanhoCents > 0 ? brl(o.valorGanhoCents) : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
