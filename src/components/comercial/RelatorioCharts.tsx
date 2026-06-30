import { Donut } from "@/components/charts/Charts";
import { Card } from "@/components/ui/Card";
import { brl } from "@/lib/format";

export const PALETTE = ["var(--c1)", "var(--c3)", "var(--c5)", "var(--c4)", "var(--c2)", "var(--c6)"];

// ── Funil de Vendas: barras horizontais Cadastrados → Ativos → Aguardando → Cancelados
export function FunilVendas({
  cadastrados,
  ativos,
  aguardando,
  cancelados,
}: {
  cadastrados: number;
  ativos: number;
  aguardando: number;
  cancelados: number;
}) {
  const max = Math.max(cadastrados, 1);
  const linhas = [
    { label: "Cadastrados", v: cadastrados, c: "var(--muted-2)" },
    { label: "Ativos", v: ativos, c: "var(--st-done)" },
    { label: "Aguardando", v: aguardando, c: "var(--st-progress)" },
    { label: "Cancelados", v: cancelados, c: "var(--st-risk)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {linhas.map((l) => (
        <div key={l.label} className="row gap12" style={{ alignItems: "center" }}>
          <span style={{ width: 96, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{l.label}</span>
          <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "var(--r-pill)", height: 28, position: "relative", overflow: "hidden" }}>
            <div style={{ width: `${(l.v / max) * 100}%`, background: l.c, height: "100%", borderRadius: "var(--r-pill)", minWidth: l.v > 0 ? 28 : 0, transition: "width .3s" }} />
            <span style={{ position: "absolute", right: 12, top: 0, height: "100%", display: "flex", alignItems: "center", fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{l.v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Evolução: barras agrupadas (Ativos / Aguardando) por mês ──────────────────
export function EvolucaoBars({ data }: { data: { label: string; ativos: number; aguardando: number; mrrCents: number }[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.ativos, d.aguardando)), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 200, padding: "8px 4px 0" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5 }}>
              <div title={`Ativos: ${d.ativos}`} style={{ width: 16, height: `${(d.ativos / max) * 100}%`, background: "var(--st-done)", borderRadius: "5px 5px 0 0", minHeight: d.ativos ? 4 : 0 }} />
              <div title={`Aguardando: ${d.aguardando}`} style={{ width: 16, height: `${(d.aguardando / max) * 100}%`, background: "var(--st-progress)", borderRadius: "5px 5px 0 0", minHeight: d.aguardando ? 4 : 0 }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="row gap12" style={{ justifyContent: "center", marginTop: 8, fontSize: 12 }}>
        <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} /> Ativos</span>
        <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-progress)" }} /> Aguardando</span>
      </div>
    </div>
  );
}

// ── Donut com legenda (distribuição por categoria) ────────────────────────────
export type DonutItem = { label: string; value: number; money?: boolean };

export function DonutCard({ title, sub, items }: { title: string; sub?: string; items: DonutItem[] }) {
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const segs = items.map((it, i) => ({ value: it.value, color: PALETTE[i % PALETTE.length] }));
  const vazio = items.every((it) => it.value === 0);
  return (
    <Card title={title} sub={sub} pad>
      {vazio ? (
        <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
      ) : (
        <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Donut segments={segs} size={132} stroke={20} />
          </div>
          <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it, i) => (
              <div key={it.label} className="row gap8" style={{ alignItems: "center", fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                <span style={{ fontWeight: 700 }}>{it.money ? brl(it.value) : it.value}</span>
                <span className="muted" style={{ width: 38, textAlign: "right" }}>{Math.round((it.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
