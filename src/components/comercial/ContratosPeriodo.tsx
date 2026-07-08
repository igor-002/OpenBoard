// Tabelas de contratos/clientes do período (ativados + fechados). Server component
// presentacional — usado na Visão Geral (/comercial) e nos Relatórios.
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { STATUS_LABEL } from "@/lib/ixc";
import { brl, dayLabel } from "@/lib/format";
import type { ContratosPeriodo, ContratoLinha } from "@/server/comercial/queries";

function statusTone(s: string): { c: string; bg: string } {
  if (s === "A") return { c: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (s === "AA" || s === "P") return { c: "var(--st-progress)", bg: "var(--st-progress-bg)" };
  if (["C", "CN", "CA", "N", "FA"].includes(s)) return { c: "var(--st-risk)", bg: "var(--st-risk-bg)" };
  return { c: "var(--pr-med)", bg: "var(--pr-med-bg)" };
}

function ClienteCell({ l }: { l: ContratoLinha }) {
  return (
    <td style={{ padding: "10px 14px" }}>
      <Link href={`/comercial/clientes/${l.clienteIxcId}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{l.clienteNome}</Link>
      <div className="muted" style={{ fontSize: 12 }}>{l.vendedorNome ?? "sem vendedor"}</div>
    </td>
  );
}

function StatusBadge({ s }: { s: string }) {
  const t = statusTone(s);
  return <span className="badge" style={{ color: t.c, background: t.bg }}>{STATUS_LABEL[s] ?? s}</span>;
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", whiteSpace: "nowrap" };

export function ContratosPeriodoCards({ data }: { data: ContratosPeriodo }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
      <Card
        title="Clientes ativados no período"
        sub={`${data.ativados.length} contratos · ${brl(data.mrrAtivadosCents)} MRR · "venda anterior" = vendido em outro período`}
        pad={false}
      >
        {data.ativados.length === 0 ? (
          <div className="card-pad muted">Nenhum contrato ativado no período.</div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--surface-3)" }}>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th }}>Cadastro</th>
                  <th style={{ ...th }}>Ativação</th>
                  <th style={{ ...th, textAlign: "right" }}>Dias</th>
                  <th style={{ ...th, textAlign: "right" }}>MRR</th>
                </tr>
              </thead>
              <tbody>
                {data.ativados.map((l) => (
                  <tr key={l.ixcId}>
                    <ClienteCell l={l} />
                    <td className="muted" style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {l.dataCadastro ? dayLabel(new Date(l.dataCadastro)) : "—"}
                      {l.vendaOutroPeriodo && (
                        <span className="badge" style={{ marginLeft: 6, color: "var(--pr-med)", background: "var(--pr-med-bg)" }} title="Contrato vendido antes do período filtrado — ativação conta pra meta, mas a venda é antiga">
                          venda anterior
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--st-done)" }}>{l.dataAtivacao ? dayLabel(new Date(l.dataAtivacao)) : "—"}</td>
                    <td className="muted" style={{ padding: "10px 14px", textAlign: "right" }}>{l.diasAtivacao != null ? `${l.diasAtivacao}d` : "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{l.mrrCents ? brl(l.mrrCents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Vendas no período"
        sub={`${data.fechados.length} contratos vendidos (por data de cadastro) · ${brl(data.mrrFechadosCents)}`}
        pad={false}
      >
        {data.fechados.length === 0 ? (
          <div className="card-pad muted">Nenhum contrato cadastrado no período.</div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--surface-3)" }}>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th }}>Cadastro</th>
                  <th style={{ ...th }}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>MRR</th>
                </tr>
              </thead>
              <tbody>
                {data.fechados.map((l) => (
                  <tr key={l.ixcId}>
                    <ClienteCell l={l} />
                    <td className="muted" style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{l.dataCadastro ? dayLabel(new Date(l.dataCadastro)) : "—"}</td>
                    <td style={{ padding: "10px 14px" }}><StatusBadge s={l.status} /></td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{l.mrrCents ? brl(l.mrrCents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
