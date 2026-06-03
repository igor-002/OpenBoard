// Barras e anéis de progresso. Portado de components.jsx.

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${value}%`, background: color || "var(--primary)" }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 46,
  stroke = 5,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color || "var(--primary)"}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset .6s" }}
      />
    </svg>
  );
}
