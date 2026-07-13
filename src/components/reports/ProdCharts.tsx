"use client";

// Gráficos interativos do relatório de produtividade (tooltip por marca,
// legenda com valores, cores estáveis por entidade — CSS vars do protótipo).
import { useState } from "react";
import { ORIGEM_META } from "@/lib/meta";
import type { PeriodoDia } from "@/server/relatorios";
import type { TaskOrigin } from "@/lib/types";

function fmtMin(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// ── Barras diárias: criadas × concluídas, tooltip por dia ────────────────────
export function DailyBars({ data }: { data: PeriodoDia[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => Math.max(d.criadas, d.concluidas)), 1);
  const h = 190;
  const showEvery = Math.ceil(data.length / 14); // no máx. ~14 rótulos no eixo

  return (
    <div>
      <div className="row gap16" style={{ marginBottom: 10 }}>
        <span className="row gap8" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--primary)" }} />Criadas
        </span>
        <span className="row gap8" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} />Concluídas
        </span>
      </div>
      <div style={{ position: "relative" }}>
        {hover != null && (
          <div
            style={{
              position: "absolute",
              top: -8,
              left: `${((hover + 0.5) / data.length) * 100}%`,
              transform: `translateX(${hover > data.length * 0.7 ? "-100%" : "-50%"})`,
              background: "var(--ink)",
              color: "#fff",
              borderRadius: "var(--r-sm)",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              zIndex: 5,
              pointerEvents: "none",
              boxShadow: "var(--sh-md)",
            }}
          >
            <div style={{ opacity: 0.75, marginBottom: 2 }}>{data[hover].label}</div>
            <div>Criadas: {data[hover].criadas}</div>
            <div>Concluídas: {data[hover].concluidas}</div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", height: h, gap: 2 }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              key={d.iso}
              onMouseEnter={() => setHover(i)}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 2,
                background: hover === i ? "var(--surface-3)" : "transparent",
                borderRadius: 6,
                padding: "0 1px",
                cursor: "default",
              }}
            >
              <div
                title={`Criadas: ${d.criadas}`}
                style={{
                  width: "50%",
                  maxWidth: 14,
                  height: `${(d.criadas / max) * 92}%`,
                  background: "var(--primary)",
                  borderRadius: "4px 4px 0 0",
                  minHeight: d.criadas ? 3 : 0,
                }}
              />
              <div
                title={`Concluídas: ${d.concluidas}`}
                style={{
                  width: "50%",
                  maxWidth: 14,
                  height: `${(d.concluidas / max) * 92}%`,
                  background: "var(--st-done)",
                  borderRadius: "4px 4px 0 0",
                  minHeight: d.concluidas ? 3 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ position: "relative", height: 18, marginTop: 6, borderTop: "1px solid var(--line)" }}>
          {data.map((d, i) =>
            i % showEvery === 0 || hover === i ? (
              <span
                key={d.iso}
                style={{
                  position: "absolute",
                  top: 5,
                  left: `${((i + 0.5) / data.length) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10.5,
                  fontWeight: hover === i ? 800 : 600,
                  color: hover === i ? "var(--ink)" : "var(--muted)",
                  whiteSpace: "nowrap",
                  background: hover === i ? "var(--surface)" : "transparent",
                  zIndex: hover === i ? 2 : 1,
                  padding: "0 3px",
                }}
              >
                {d.label}
              </span>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

// ── Donut de origem com hover + legenda com valores ──────────────────────────
export function OrigemDonut({ data }: { data: { origem: TaskOrigin; criadas: number }[] }) {
  const [hover, setHover] = useState<TaskOrigin | null>(null);
  const total = data.reduce((s, d) => s + d.criadas, 0);
  const size = 160;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  if (total === 0) return <div className="muted" style={{ fontSize: 13.5 }}>Sem atividades criadas no período.</div>;

  const hovered = hover ? data.find((d) => d.origem === hover) : null;

  return (
    <div className="row gap16" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
          {data.map((d) => {
            const frac = d.criadas / total;
            const dash = Math.max(0, c * frac - 2); // gap 2px entre segmentos
            const el = (
              <circle
                key={d.origem}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={ORIGEM_META[d.origem].c}
                strokeWidth={hover === d.origem ? stroke + 5 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc}
                strokeLinecap="butt"
                style={{ transition: "stroke-width .12s", cursor: "default" }}
                onMouseEnter={() => setHover(d.origem)}
                onMouseLeave={() => setHover(null)}
              />
            );
            acc += c * frac;
            return el;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>
              {hovered ? hovered.criadas : total}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {hovered ? ORIGEM_META[hovered.origem].label : "no período"}
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d) => (
          <div
            key={d.origem}
            className="row between"
            onMouseEnter={() => setHover(d.origem)}
            onMouseLeave={() => setHover(null)}
            style={{ background: hover === d.origem ? "var(--surface-3)" : "transparent", borderRadius: 6, padding: "3px 6px", cursor: "default" }}
          >
            <span className="row gap8">
              <span className="bdot" style={{ width: 9, height: 9, background: ORIGEM_META[d.origem].c }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{ORIGEM_META[d.origem].label}</span>
            </span>
            <b style={{ fontSize: 13 }}>
              {d.criadas}
              <span className="muted" style={{ fontWeight: 600, marginLeft: 6 }}>{Math.round((d.criadas / total) * 100)}%</span>
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Barras horizontais por tipo (contagem + tempo médio) ─────────────────────
export function TipoBars({ data }: { data: { id: string; name: string; criadas: number; concluidas: number; tempoMedioMin: number | null }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.criadas + d.concluidas), 1);

  if (data.length === 0) return <div className="muted" style={{ fontSize: 13.5 }}>Sem atividades por tipo no período.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => {
        const vol = d.criadas + d.concluidas;
        return (
          <div
            key={d.id}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            style={{ background: hover === d.id ? "var(--surface-3)" : "transparent", borderRadius: 6, padding: "4px 6px" }}
          >
            <div className="row between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{d.name}</span>
              <span style={{ fontSize: 12.5 }}>
                <b>{d.concluidas}</b>
                <span className="muted"> concluída{d.concluidas === 1 ? "" : "s"}</span>
                {d.tempoMedioMin != null && <span className="muted"> · média {fmtMin(d.tempoMedioMin)}</span>}
              </span>
            </div>
            <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden", display: "flex", gap: 2 }}>
              <div style={{ width: `${(d.concluidas / max) * 100}%`, background: "var(--st-done)", borderRadius: 4 }} />
              <div style={{ width: `${((vol - d.concluidas) / max) * 100}%`, background: "var(--primary)", borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
      <div className="row gap16" style={{ marginTop: 2 }}>
        <span className="row gap8" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--st-done)" }} />Concluídas
        </span>
        <span className="row gap8" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--primary)" }} />Criadas (ainda abertas)
        </span>
      </div>
    </div>
  );
}

// ── Estimado × real por membro (pares de barras) ─────────────────────────────
export function EstRealBars({ data }: { data: { id: string; name: string; estimadoMin: number; realMin: number }[] }) {
  const rows = data.filter((d) => d.estimadoMin > 0 || d.realMin > 0);
  const max = Math.max(...rows.map((d) => Math.max(d.estimadoMin, d.realMin)), 1);
  const [hover, setHover] = useState<string | null>(null);

  if (rows.length === 0)
    return <div className="muted" style={{ fontSize: 13.5 }}>Sem atividades com estimativa e tempo real no período.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((d) => {
        const estourou = d.realMin > d.estimadoMin;
        return (
          <div
            key={d.id}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            style={{ background: hover === d.id ? "var(--surface-3)" : "transparent", borderRadius: 6, padding: "4px 6px" }}
          >
            <div className="row between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{d.name}</span>
              <span style={{ fontSize: 12.5 }}>
                <span className="muted">est. {fmtMin(d.estimadoMin)} · </span>
                <b style={{ color: estourou ? "var(--st-risk)" : "var(--st-done)" }}>real {fmtMin(d.realMin)}</b>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ height: 6, width: `${(d.estimadoMin / max) * 100}%`, background: "var(--c5)", borderRadius: 3, minWidth: 3 }} />
              <div style={{ height: 6, width: `${(d.realMin / max) * 100}%`, background: estourou ? "var(--st-risk)" : "var(--st-done)", borderRadius: 3, minWidth: 3 }} />
            </div>
          </div>
        );
      })}
      <div className="row gap16" style={{ marginTop: 2 }}>
        <span className="row gap8" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c5)" }} />Estimado
        </span>
        <span className="row gap8" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--st-done)" }} />Real (vermelho = estourou)
        </span>
      </div>
    </div>
  );
}
