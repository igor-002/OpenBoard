// Trend (variação %) e StatCard (KPI). Portado de components.jsx.
import { Icon, type IconName } from "./Icon";

export function Trend({ value, up }: { value: number; up?: boolean }) {
  const isUp = up !== undefined ? up : value >= 0;
  return (
    <span className={`trend ${isUp ? "up" : "down"}`}>
      <Icon name={isUp ? "arrowUp" : "arrowDown"} size={12} />
      {Math.abs(value)}%
    </span>
  );
}

export function StatCard({
  icon,
  label,
  value,
  suffix,
  foot,
  trend,
  accent,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  suffix?: string;
  foot?: string;
  trend?: number;
  accent?: string;
}) {
  const c = accent || "var(--primary)";
  return (
    <div className="stat">
      <div className="top">
        <span className="label">{label}</span>
        <span
          className="ico"
          style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}
        >
          <Icon name={icon} />
        </span>
      </div>
      <div className="row gap8" style={{ alignItems: "baseline" }}>
        <span className="val">{value}</span>
        {suffix && (
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--muted)" }}>{suffix}</span>
        )}
      </div>
      <div className="foot">
        {trend !== undefined && <Trend value={trend} />}
        <span>{foot}</span>
      </div>
    </div>
  );
}
