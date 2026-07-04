// Churn & Retenção: MRR novo × MRR perdido (net revenue movement).
// Perdas vêm do ContratoStatusEvent (transições detectadas pelo sync) — o IXC
// não expõe esse histórico, então ele acumula a partir da criação da tabela.
import { requireUser } from "@/lib/auth";
import { getChurnStats } from "@/server/comercial/queries";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { brl } from "@/lib/format";
import { AutoRefresh } from "@/components/common/AutoRefresh";

const STATUS_LABEL: Record<string, string> = {
  A: "Ativo", AA: "Aguardando ativação", P: "Pré-contrato",
  C: "Cancelado", CN: "Cancelamento negociado", CA: "Cancelamento automático",
  B: "Bloqueado", CM: "Bloqueio manual", D: "Desativado", FA: "Financeiro atrasado", N: "Negativado",
};
const stLabel = (s: string) => STATUS_LABEL[s] ?? s;

export default async function ChurnPage() {
  await requireUser();
  const s = await getChurnStats();
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13.5, borderTop: "1px solid var(--line)", verticalAlign: "middle" };
  const netPos = s.kpis.net30dCents >= 0;

  return (
    <div className="page">
      <AutoRefresh seconds={120} />
      <div className="page-head">
        <div>
          <h1 className="page-title">Churn &amp; Retenção</h1>
          <p className="page-sub">
            MRR que entra × MRR que sai — o crescimento real da base.
            {s.desdeQuando && <> Histórico de perdas registrado desde {s.desdeQuando.toLocaleDateString("pt-BR")}.</>}
          </p>
        </div>
      </div>

      {/* KPIs 30d */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)" }}>
        <StatCard icon="trendUp" label="MRR novo (30d)" value={brl(s.kpis.mrrNovo30dCents)} foot={`${s.kpis.novos30d} contratos ativados`} accent="var(--st-done)" />
        <StatCard icon="alert" label="MRR perdido (30d)" value={brl(s.kpis.mrrPerdido30dCents)} foot={`${s.kpis.perdidos30d} contratos cancelados/desativados`} accent="var(--st-risk)" />
        <StatCard icon="wallet" label="Net MRR (30d)" value={`${netPos ? "+" : "−"}${brl(Math.abs(s.kpis.net30dCents))}`} foot={netPos ? "base crescendo" : "base encolhendo"} accent={netPos ? "var(--st-done)" : "var(--st-risk)"} />
        <StatCard icon="chart" label="Churn rate (30d)" value={s.kpis.churnRate30d != null ? `${s.kpis.churnRate30d}%` : "—"} foot="perdidos ÷ base ativa" accent="var(--primary)" />
      </div>

      {/* Novos × perdidos por mês */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="MRR novo × perdido por mês" sub="Últimos 6 meses — perdas contam a partir do início do histórico" pad>
          {s.meses.every((m) => m.novosMrrCents === 0 && m.perdidosMrrCents === 0) ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem movimentações no período.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "8px 4px 0" }}>
                {(() => {
                  const max = Math.max(...s.meses.map((m) => Math.max(m.novosMrrCents, m.perdidosMrrCents)), 1);
                  return s.meses.map((m) => (
                    <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5 }}>
                        <div title={`Novo: ${brl(m.novosMrrCents)} (${m.novos})`} style={{ width: 16, height: `${(m.novosMrrCents / max) * 100}%`, background: "var(--st-done)", borderRadius: "5px 5px 0 0", minHeight: m.novosMrrCents ? 4 : 0 }} />
                        <div title={`Perdido: ${brl(m.perdidosMrrCents)} (${m.perdidos})`} style={{ width: 16, height: `${(m.perdidosMrrCents / max) * 100}%`, background: "var(--st-risk)", borderRadius: "5px 5px 0 0", minHeight: m.perdidosMrrCents ? 4 : 0 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{m.label}</span>
                    </div>
                  ));
                })()}
              </div>
              <div className="row gap12" style={{ justifyContent: "center", marginTop: 8, fontSize: 12 }}>
                <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} /> MRR novo</span>
                <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-risk)" }} /> MRR perdido</span>
              </div>
            </>
          )}
        </Card>

        <Card title="Net MRR por mês" sub="Novo − perdido: o que sobrou de crescimento" pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-3)" }}>
                  <th style={th}>Mês</th>
                  <th style={{ ...th, textAlign: "right" }}>Novo</th>
                  <th style={{ ...th, textAlign: "right" }}>Perdido</th>
                  <th style={{ ...th, textAlign: "right" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {s.meses.map((m) => (
                  <tr key={m.label}>
                    <td style={{ ...td, fontWeight: 700 }}>{m.label}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--st-done)", fontWeight: 700 }}>{m.novosMrrCents > 0 ? brl(m.novosMrrCents) : <span className="muted">—</span>}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--st-risk)", fontWeight: 700 }}>{m.perdidosMrrCents > 0 ? brl(m.perdidosMrrCents) : <span className="muted">—</span>}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: m.netCents >= 0 ? "var(--st-done)" : "var(--st-risk)" }}>
                      {m.netCents >= 0 ? "+" : "−"}{brl(Math.abs(m.netCents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Cancelamentos recentes */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Perdas recentes" sub="Contratos que saíram de ativo — candidatos a resgate/entrevista de saída" pad={false}>
          {s.eventosRecentes.length === 0 ? (
            <div className="card-pad muted">
              Nenhuma perda registrada ainda. O sync compara o status de cada contrato com o espelho local — quando um contrato ativo virar cancelado/desativado no IXC, aparece aqui.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-3)" }}>
                    <th style={th}>Cliente</th>
                    <th style={th}>Vendedor</th>
                    <th style={th}>Transição</th>
                    <th style={{ ...th, textAlign: "right" }}>MRR perdido</th>
                    <th style={{ ...th, textAlign: "right" }}>Detectado em</th>
                  </tr>
                </thead>
                <tbody>
                  {s.eventosRecentes.map((e) => (
                    <tr key={`${e.contratoIxcId}-${+e.at}`}>
                      <td style={{ ...td, fontWeight: 700 }}>{e.clienteNome}<div className="muted" style={{ fontSize: 11.5 }}>contrato #{e.contratoIxcId}</div></td>
                      <td style={{ ...td, color: e.vendedorNome ? "var(--ink-2)" : "var(--muted)" }}>{e.vendedorNome ?? "—"}</td>
                      <td style={td}>
                        <span style={{ fontSize: 12.5 }}>{stLabel(e.fromStatus)} <span className="muted">→</span> <b style={{ color: "var(--st-risk)" }}>{stLabel(e.toStatus)}</b></span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "var(--st-risk)" }}>{e.mrrCents > 0 ? brl(e.mrrCents) : <span className="muted">—</span>}</td>
                      <td style={{ ...td, textAlign: "right", color: "var(--muted)", whiteSpace: "nowrap" }}>{e.at.toLocaleDateString("pt-BR")}</td>
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
