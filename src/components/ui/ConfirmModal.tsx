"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const accent = danger ? "var(--st-risk)" : "var(--primary)";
  const accentBg = danger ? "var(--st-risk-bg)" : "var(--primary-tint)";
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 70, display: "grid", placeItems: "center", padding: 24 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 420, padding: 26, boxShadow: "var(--sh-lg)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: accentBg, color: accent, display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Icon name={danger ? "alert" : "help"} size={26} />
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)" }}>{title}</h3>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 }}>{message}</div>
        <div className="row gap12" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={onClose} disabled={pending} style={{ minWidth: 110, justifyContent: "center" }}>
            {cancelLabel}
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={pending}
            style={{ minWidth: 110, justifyContent: "center", background: accent, borderColor: accent, color: "#fff" }}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
