// Gráficos SVG sem dependência externa. Portado de components.jsx.

// Barras Foco + Extra empilhadas (estilo ORDO).
export function HoursBarChart({
  data,
  maxH = 10,
}: {
  data: { d: string; focus: number; over: number }[];
  maxH?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 230, padding: "10px 4px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, height: "100%" }}>
          <div style={{ flex: 1, width: "100%", maxWidth: 46, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 3 }}>
            <div title={`Extra: ${d.over}h`} style={{ height: `${(d.over / maxH) * 100}%`, background: "var(--primary-tint-2)", borderRadius: "8px 8px 4px 4px" }} />
            <div title={`Foco: ${d.focus}h`} style={{ height: `${(d.focus / maxH) * 100}%`, background: "var(--primary)", borderRadius: "4px 4px 8px 8px", minHeight: 6 }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>{d.d}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  segments,
  size = 150,
  stroke = 22,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = c * frac;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-acc}
            strokeLinecap="butt"
          />
        );
        acc += dash;
        return el;
      })}
    </svg>
  );
}

export function LineChart({
  data,
  w = 560,
  h = 180,
  color = "var(--primary)",
  fill = true,
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
}) {
  const max = Math.max(...data) * 1.12;
  const min = 0;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / (max - min)) * h,
  ]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  // id único por instância para evitar colisão de gradiente.
  const gid = `lcg-${color.replace(/[^a-z0-9]/gi, "")}-${fill ? 1 : 0}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) =>
        i === pts.length - 1 ? (
          <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill={color} stroke="#fff" strokeWidth="2.5" />
        ) : null
      )}
    </svg>
  );
}
