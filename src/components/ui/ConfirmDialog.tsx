"use client";

// Modal de confirmação reutilizável — pra ações destrutivas/irreversíveis que
// antes disparavam direto no clique (excluir card, coluna, etc.).
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)", zIndex: 400, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 420, padding: 0, overflow: "hidden" }}
      >
        <div className="row gap12" style={{ padding: "18px 20px 8px", alignItems: "flex-start" }}>
          <span
            style={{ flex: "none", width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${danger ? "var(--st-risk)" : "var(--primary)"} 14%, transparent)`, color: danger ? "var(--st-risk)" : "var(--primary)" }}
          >
            <Icon name={danger ? "alert" : "check"} size={19} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--ink)" }}>{title}</div>
            {message && <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{message}</div>}
          </div>
        </div>
        <div className="row gap8" style={{ justifyContent: "flex-end", padding: "12px 20px 18px" }}>
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={danger ? "btn" : "btn btn-primary"}
            onClick={onConfirm}
            style={danger ? { background: "var(--st-risk)", borderColor: "var(--st-risk)", color: "#fff" } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
