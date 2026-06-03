"use client";

import { useState, type ReactNode } from "react";

export function Tabs({ items }: { items: { key: string; label: string; node: ReactNode }[] }) {
  const [active, setActive] = useState(items[0]?.key);
  const current = items.find((i) => i.key === active) ?? items[0];
  return (
    <div className="card">
      <div className="row" style={{ borderBottom: "1px solid var(--line)", padding: "0 var(--card-pad)", gap: 4 }}>
        {items.map((i) => (
          <button key={i.key} className={`dtab ${active === i.key ? "on" : ""}`} onClick={() => setActive(i.key)}>
            {i.label}
          </button>
        ))}
      </div>
      <div className="card-pad">{current?.node}</div>
    </div>
  );
}
