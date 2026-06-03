"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 460,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24, overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth, padding: 24, boxShadow: "var(--sh-lg)", margin: "auto" }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3 className="card-title" style={{ fontSize: 18 }}>{title}</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onClose} aria-label="Fechar">
            <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
