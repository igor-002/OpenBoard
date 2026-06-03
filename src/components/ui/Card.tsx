// Card genérico com header opcional. Portado de components.jsx.
import type { CSSProperties, ReactNode } from "react";

export function Card({
  title,
  sub,
  action,
  children,
  pad = true,
  className = "",
  style,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  pad?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || action) && (
        <div
          className="card-head"
          style={{
            // header sempre com respiro lateral/topo (mesmo com pad=false, p/ não colar na borda)
            padding: "var(--card-pad) var(--card-pad) 0",
            marginBottom: pad ? 0 : 18,
          }}
        >
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: pad ? "var(--card-pad)" : 0 }}>{children}</div>
    </div>
  );
}
