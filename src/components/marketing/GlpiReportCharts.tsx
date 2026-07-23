"use client";

// Gráficos e KPIs dinâmicos do Relatório de Demandas GLPI: números com
// count-up na entrada e barras que crescem + tooltip no hover. Base visual =
// ProdCharts (relatório de Projetos), adaptado pros dados do GLPI.
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

// Interpolação suave (ease-out) de 0 até `value` na montagem.
function useCountUp(value: number, ms = 700): number {
  const [n, setN] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const from = ref.current;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (value - from) * eased;
      setN(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

// KPI card com o mesmo visual do StatCard, mas com valor animado (count-up).
export function AnimatedStat({
  icon,
  label,
  value,
  suffix,
  foot,
  accent,
  decimals = 0,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  suffix?: string;
  foot?: string;
  accent?: string;
  decimals?: number;
}) {
  const c = accent || "var(--primary)";
  const n = useCountUp(value ?? 0);
  const shown = value == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <div className="stat" style={{ animation: "gl-fade-up .5s ease both" }}>
      <div className="top">
        <span className="label">{label}</span>
        <span className="ico" style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="row gap8" style={{ alignItems: "baseline" }}>
        <span className="val">{shown}</span>
        {suffix && value != null && <span style={{ fontSize: 15, fontWeight: 700, color: "var(--muted)" }}>{suffix}</span>}
      </div>
      <div className="foot"><span>{foot}</span></div>
      <style>{"@keyframes gl-fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes gl-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}"}</style>
    </div>
  );
}

type Dia = { label: string; abertas: number; solucionadas: number };

// Barras agrupadas abertas × solucionadas por dia/semana. Crescem na entrada
// (scaleY) e mostram tooltip com os valores no hover da coluna.
export function DemandasDailyBars({ data }: { data: Dia[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => Math.max(d.abertas, d.solucionadas)), 1);
  if (data.length === 0) return <div className="muted" style={{ padding: 8 }}>Sem dados no período.</div>;

  return (
    <div>
      <div className="row gap16" style={{ marginBottom: 10 }}>
        <span className="row gap8" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-progress)" }} />Abertas
        </span>
        <span className="row gap8" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--st-done)" }} />Solucionadas
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
            <div>Abertas: {data[hover].abertas}</div>
            <div>Solucionadas: {data[hover].solucionadas}</div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", height: 190, gap: 3 }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              key={d.label}
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
                title={`Abertas: ${d.abertas}`}
                style={{
                  width: "50%", maxWidth: 12,
                  height: `${(d.abertas / max) * 92}%`,
                  background: "var(--st-progress)", borderRadius: "4px 4px 0 0",
                  minHeight: d.abertas ? 3 : 0,
                  transformOrigin: "bottom",
                  animation: `gl-grow .6s ${i * 0.02}s ease both`,
                }}
              />
              <div
                title={`Solucionadas: ${d.solucionadas}`}
                style={{
                  width: "50%", maxWidth: 12,
                  height: `${(d.solucionadas / max) * 92}%`,
                  background: "var(--st-done)", borderRadius: "4px 4px 0 0",
                  minHeight: d.solucionadas ? 3 : 0,
                  transformOrigin: "bottom",
                  animation: `gl-grow .6s ${i * 0.02 + 0.08}s ease both`,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ position: "relative", height: 18, marginTop: 6, borderTop: "1px solid var(--line)" }}>
          {data.map((d, i) => {
            const showEvery = Math.ceil(data.length / 14);
            return i % showEvery === 0 || hover === i ? (
              <span
                key={d.label}
                style={{
                  position: "absolute", top: 5,
                  left: `${((i + 0.5) / data.length) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10.5,
                  fontWeight: hover === i ? 800 : 600,
                  color: hover === i ? "var(--ink)" : "var(--muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {d.label}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
