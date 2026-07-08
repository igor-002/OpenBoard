"use client";

// Gráficos comerciais interativos: animação de entrada, valores sempre visíveis
// e tooltip no hover (CSS puro — sem lib externa). Cores vêm do design system
// (var(--c*)/status), texto usa tokens de texto, nunca a cor da série.
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { brl } from "@/lib/format";

export const PALETTE = ["var(--c1)", "var(--c3)", "var(--c5)", "var(--c4)", "var(--c2)", "var(--c6)"];

// Estilos compartilhados (keyframes + tooltip). Renderizado 1x por gráfico —
// duplicar <style> com o mesmo conteúdo é inócuo.
function ChartStyles() {
  return (
    <style>{`
      @keyframes obchart-grow-up { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes obchart-grow-right { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes obchart-fade-in { from { opacity: 0; } to { opacity: 1; } }
      .obchart-hover { position: relative; }
      .obchart-tip {
        position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translate(-50%, 4px);
        background: var(--ink); color: var(--surface); padding: 7px 10px; border-radius: 8px;
        font-size: 12px; font-weight: 600; line-height: 1.45; white-space: nowrap;
        opacity: 0; pointer-events: none; transition: opacity .15s ease, transform .15s ease;
        z-index: 5; box-shadow: 0 6px 18px rgba(0,0,0,.18);
      }
      .obchart-hover:hover .obchart-tip { opacity: 1; transform: translate(-50%, 0); }
      .obchart-hover:hover .obchart-bar { filter: brightness(1.08); }
      .obchart-bar { transition: filter .15s ease; }
      @media (prefers-reduced-motion: reduce) {
        .obchart-anim { animation: none !important; }
      }
    `}</style>
  );
}

// ── Funil de Vendas: barras horizontais animadas + % de conversão visível ─────
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
    { label: "Cadastrados", v: cadastrados, c: "var(--muted-2)", pct: null as number | null },
    { label: "Ativos", v: ativos, c: "var(--st-done)", pct: Math.round((ativos / max) * 100) },
    { label: "Aguardando", v: aguardando, c: "var(--st-progress)", pct: Math.round((aguardando / max) * 100) },
    { label: "Cancelados", v: cancelados, c: "var(--st-risk)", pct: Math.round((cancelados / max) * 100) },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ChartStyles />
      {linhas.map((l, i) => (
        <div key={l.label} className="row gap12 obchart-hover" style={{ alignItems: "center" }}>
          <div className="obchart-tip">
            {l.label}: {l.v} contrato{l.v === 1 ? "" : "s"}
            {l.pct != null && <><br />{l.pct}% dos cadastrados</>}
          </div>
          <span style={{ width: 96, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{l.label}</span>
          <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "var(--r-pill)", height: 28, position: "relative", overflow: "hidden" }}>
            <div
              className="obchart-bar obchart-anim"
              style={{
                width: `${(l.v / max) * 100}%`, background: l.c, height: "100%", borderRadius: "var(--r-pill)",
                minWidth: l.v > 0 ? 28 : 0, transformOrigin: "left",
                animation: "obchart-grow-right .55s cubic-bezier(.2,.8,.3,1) both", animationDelay: `${i * 90}ms`,
              }}
            />
            <span style={{ position: "absolute", right: 12, top: 0, height: "100%", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>
              {l.pct != null && <small style={{ fontWeight: 700, color: "var(--muted)" }}>{l.pct}%</small>}
              {l.v}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Barras pareadas genéricas (2 séries por rótulo) — usada em Evolução/Churn ─
export type PairBarsPoint = { label: string; a: number; b: number; extra?: string };

export function PairBars({
  data,
  serieA,
  serieB,
  corA,
  corB,
  height = 200,
  money = false,
}: {
  data: PairBarsPoint[];
  serieA: string;
  serieB: string;
  corA: string;
  corB: string;
  height?: number;
  money?: boolean; // formata valores como R$ (labels + tooltip)
}) {
  const max = Math.max(...data.map((d) => Math.max(d.a, d.b)), 1);
  const fmt = (v: number) => (money ? brl(v) : String(v));
  return (
    <div>
      <ChartStyles />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height, padding: "8px 4px 0" }}>
        {data.map((d, i) => (
          <div key={d.label} className="obchart-hover" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
            <div className="obchart-tip">
              {d.label}<br />{serieA}: {fmt(d.a)} · {serieB}: {fmt(d.b)}
              {d.extra && <><br />{d.extra}</>}
            </div>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
              {[{ v: d.a, c: corA }, { v: d.b, c: corB }].map((s, j) => (
                <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", width: 22 }}>
                  {/* valor sempre visível em cima da barra (token de texto, não cor da série) */}
                  <span className="obchart-anim" style={{ fontSize: money ? 9.5 : 11.5, fontWeight: 800, color: "var(--ink)", marginBottom: 4, whiteSpace: "nowrap", animation: "obchart-fade-in .4s ease both", animationDelay: `${i * 70 + 250}ms` }}>{fmt(s.v)}</span>
                  <div
                    className="obchart-bar obchart-anim"
                    style={{
                      width: "100%", height: `${(s.v / max) * 88}%`, background: s.c, borderRadius: "5px 5px 0 0",
                      minHeight: s.v ? 4 : 0, transformOrigin: "bottom",
                      animation: "obchart-grow-up .55s cubic-bezier(.2,.8,.3,1) both", animationDelay: `${i * 70}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="row gap12" style={{ justifyContent: "center", marginTop: 8, fontSize: 12 }}>
        <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: corA }} /> {serieA}</span>
        <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: corB }} /> {serieB}</span>
      </div>
    </div>
  );
}

// ── Evolução: Ativações × Aguardando (últimos meses) ─────────────────────────
export function EvolucaoBars({ data }: { data: { label: string; ativos: number; aguardando: number; mrrCents: number }[] }) {
  return (
    <PairBars
      data={data.map((d) => ({ label: d.label, a: d.ativos, b: d.aguardando, extra: d.mrrCents > 0 ? `MRR ativado: ${brl(d.mrrCents)}` : undefined }))}
      serieA="Ativações"
      serieB="Aguardando"
      corA="var(--st-done)"
      corB="var(--st-progress)"
    />
  );
}

// ── Donut com legenda interativa (hover destaca o segmento) ───────────────────
export type DonutItem = { label: string; value: number; money?: boolean };

export function DonutCard({ title, sub, items }: { title: string; sub?: string; items: DonutItem[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const vazio = items.every((it) => it.value === 0);
  const money = items.some((it) => it.money);

  const size = 132, stroke = 20;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Offsets pré-computados (sem mutação durante o render).
  const segs = items.reduce<{ dash: number; off: number }[]>((acc, it) => {
    const start = acc.length ? acc[acc.length - 1].off - circ * (items[acc.length - 1].value / total) : 0;
    acc.push({ dash: Math.max(0, circ * (it.value / total) - 2), off: start });
    return acc;
  }, []);

  return (
    <Card title={title} sub={sub} pad>
      {vazio ? (
        <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
      ) : (
        <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <ChartStyles />
          <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
              {items.map((it, i) => (
                <circle
                  key={it.label}
                  cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={PALETTE[i % PALETTE.length]} strokeWidth={ativo === i ? stroke + 4 : stroke}
                  strokeDasharray={`${segs[i].dash} ${circ - segs[i].dash}`} strokeDashoffset={segs[i].off} strokeLinecap="butt"
                  style={{ opacity: ativo == null || ativo === i ? 1 : 0.3, transition: "opacity .15s ease, stroke-width .15s ease" }}
                />
              ))}
            </svg>
            {/* centro: item destacado no hover, senão o total */}
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
              {ativo != null ? (
                <div>
                  <div style={{ fontWeight: 800, fontSize: money ? 13 : 15 }}>{items[ativo].money ? brl(items[ativo].value) : items[ativo].value}</div>
                  <div className="muted" style={{ fontSize: 10.5 }}>{Math.round((items[ativo].value / total) * 100)}%</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 800, fontSize: money ? 13 : 17 }}>{money ? brl(total) : total}</div>
                  <div className="muted" style={{ fontSize: 10.5 }}>total</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it, i) => (
              <div
                key={it.label}
                className="row gap8"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
                style={{ alignItems: "center", fontSize: 12.5, cursor: "default", borderRadius: 6, padding: "2px 4px", background: ativo === i ? "var(--surface-3)" : "transparent", transition: "background .15s ease" }}
              >
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
