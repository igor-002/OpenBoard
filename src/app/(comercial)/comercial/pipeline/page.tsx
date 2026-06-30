import Link from "next/link";
import { getPipeline } from "@/server/comercial/queries";
import { Icon } from "@/components/ui/Icon";
import { STATUS_LABEL } from "@/lib/ixc";
import { brl } from "@/lib/format";

const COL_COLOR: Record<string, string> = { AA: "var(--st-progress)", P: "var(--pr-med)" };

export default async function PipelinePage() {
  const cols = await getPipeline();
  const totalMrr = cols.reduce((a, c) => a + c.totalMrrCents, 0);
  const totalCount = cols.reduce((a, c) => a + c.total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="page-sub">{totalCount} contratos em negociação · {brl(totalMrr)}/mês em potencial — read-only (IXC é a fonte)</p>
        </div>
        <Link className="btn btn-ghost" href="/comercial/contratos?status=AA">Ver em lista <Icon name="chevRight" size={15} /></Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)},1fr)`, gap: "var(--gap)", alignItems: "start" }}>
        {cols.map((col) => {
          const cor = COL_COLOR[col.status] ?? "var(--muted)";
          return (
            <div key={col.status} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="row between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
                <div className="row gap8" style={{ alignItems: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: cor }} />
                  <span style={{ fontWeight: 800 }}>{STATUS_LABEL[col.status] ?? col.status}</span>
                  <span className="badge" style={{ color: cor, background: "var(--surface-3)" }}>{col.total}</span>
                </div>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{brl(col.totalMrrCents)}/mês</span>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflowY: "auto" }}>
                {col.cards.length === 0 ? (
                  <div className="muted" style={{ padding: 12, textAlign: "center", fontSize: 13 }}>Vazio.</div>
                ) : (
                  col.cards.map((c) => (
                    <div key={c.ixcId} className="card" style={{ padding: 12, boxShadow: "none", border: "1px solid var(--line)" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{c.clienteNome}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{c.vendedorNome ?? "—"}</div>
                      <div className="row between" style={{ marginTop: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{c.mrrCents ? brl(c.mrrCents) : "—"}</span>
                        <span className="badge" style={c.dias > 15 ? { color: "var(--st-risk)", background: "var(--st-risk-bg)" } : { color: "var(--muted)", background: "var(--surface-3)" }}>{c.dias}d</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
