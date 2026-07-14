import { Donut } from "@/components/charts/Charts";
import { Card } from "@/components/ui/Card";
import { fmtNumber, fmtCompact, monthShort } from "@/lib/marketing/format";

export const PALETTE = ["var(--c1)", "var(--c3)", "var(--c5)", "var(--c4)", "var(--c2)", "var(--c6)"];

export type DonutItem = { label: string; value: number; pct?: number };

// Donut com legenda, para as distribuições do módulo Marketing (tipos de
// mídia, origem de visualizações). Espelha DonutCard do Comercial.
export function SocialDonutCard({ title, sub, items }: { title: string; sub?: string; items: DonutItem[] }) {
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
                <span style={{ fontWeight: 700 }}>{fmtNumber(it.value)}</span>
                <span className="muted" style={{ width: 38, textAlign: "right" }}>{Math.round((it.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// Evolução mensal multi-linha (ex.: seguidores por perfil). Cor por conta é
// ESTÁVEL (índice fixo na lista de contas, nunca por ordem de valor/render).
// Pontos nulos viram lacuna na linha, mas o ponto isolado adjacente a uma
// lacuna continua visível (mês sem vizinho não "some").
export function EvolutionChart({
  months,
  series,
  h = 220,
}: {
  months: string[];
  series: { key: string; label: string; color: string; values: (number | null)[] }[];
  h?: number;
}) {
  const w = 640;
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = Math.max(...allValues, 1) * 1.1;
  // Mês único não tem linha: o ponto vai pro centro (em x=0 ficaria cortado
  // na borda). O histórico só cresce daqui pra frente (a API não dá passado).
  const single = months.length === 1;
  const stepX = single ? 0 : w / (months.length - 1);
  const xAt = (i: number) => (single ? w / 2 : i * stepX);
  const y = (v: number) => h - (v / max) * h;

  const vazio = allValues.length === 0;

  return (
    <div>
      {vazio ? (
        <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ overflow: "visible" }}>
            {series.map((s) => {
              const pts = s.values.map((v, i) => (v == null ? null : [xAt(i), y(v)] as const));
              // segmentos contíguos (sem cruzar lacunas)
              const segments: (readonly [number, number])[][] = [];
              let cur: (readonly [number, number])[] = [];
              for (const p of pts) {
                if (p) cur.push(p);
                else if (cur.length) {
                  segments.push(cur);
                  cur = [];
                }
              }
              if (cur.length) segments.push(cur);
              return (
                <g key={s.key}>
                  {segments.map((seg, i) => (
                    <path
                      key={i}
                      d={seg.map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={s.color} />)}
                </g>
              );
            })}
          </svg>
          <div className="row gap8" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {months.map((m) => (
              <span key={m} style={{ flex: 1, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>{monthShort(m)}</span>
            ))}
          </div>
          <div className="row gap12" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {series.map((s) => {
              const last = [...s.values].reverse().find((v) => v != null);
              return (
                <span key={s.key} className="row gap8" style={{ alignItems: "center", fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  {s.label}
                  {single && last != null && <b>{fmtCompact(last)}</b>}
                </span>
              );
            })}
          </div>
          {single && (
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              Só há dados do mês atual — a linha de evolução se forma a partir do próximo mês
              (a API do Instagram não fornece histórico de seguidores).
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Barras verticais simples (produção mensal da equipe).
export function VerticalBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160, padding: "10px 4px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div title={`${d.label}: ${d.value}`} style={{ width: 22, height: `${(d.value / max) * 100}%`, background: "var(--c1)", borderRadius: "6px 6px 0 0", minHeight: d.value ? 4 : 0 }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Barras horizontais (engajamento por conta, geografia/origem dos links).
// Valor fica FORA da pista, à direita — número sobre a barra colorida não
// tinha contraste.
export function BarsList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <div className="muted" style={{ padding: 8 }}>Sem contas.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it) => (
        <div key={it.label} className="row gap12" style={{ alignItems: "center" }}>
          <span style={{ width: 120, fontSize: 13, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
          <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "var(--r-pill)", height: 16, overflow: "hidden" }}>
            <div style={{ width: `${(it.value / max) * 100}%`, background: "var(--c1)", height: "100%", borderRadius: "var(--r-pill)", minWidth: it.value > 0 ? 16 : 0, transition: "width .3s" }} />
          </div>
          <span style={{ width: 52, textAlign: "right", fontWeight: 800, fontSize: 12.5, color: "var(--ink)", flexShrink: 0 }}>{fmtNumber(it.value)}</span>
        </div>
      ))}
    </div>
  );
}
