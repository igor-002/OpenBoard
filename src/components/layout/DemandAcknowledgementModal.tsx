"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { acknowledgeTaskDemand } from "@/app/(app)/acknowledgements/actions";
import type { PendingTaskAcknowledgement } from "@/server/task-acknowledgements";

const PRIORITY = {
  high: { label: "Alta", color: "var(--st-risk)", bg: "var(--st-risk-bg)" },
  med: { label: "Média", color: "var(--pr-med)", bg: "var(--pr-med-bg)" },
  low: { label: "Baixa", color: "var(--st-done)", bg: "var(--st-done-bg)" },
};

export function DemandAcknowledgementModal({ initial }: { initial: PendingTaskAcknowledgement[] }) {
  const [pendingItems, setPendingItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const item = pendingItems[0];
  if (!item) return null;

  const priority = PRIORITY[item.priority];
  const tipo = item.tipoName ?? (item.origem === "planejada" ? "Tarefa" : "Atividade");

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeTaskDemand(item.id);
      if (!result.ok) return setError(result.error ?? "Não foi possível confirmar.");
      setPendingItems((items) => items.filter((current) => current.id !== item.id));
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demand-title"
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(16,24,40,.64)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }}
    >
      <section className="card" style={{ width: "min(900px, 100%)", maxHeight: "min(760px, calc(100vh - 48px))", overflowY: "auto", padding: 34, boxShadow: "var(--sh-lg)" }}>
        <div className="row gap12" style={{ alignItems: "flex-start", marginBottom: 24 }}>
          <span style={{ width: 48, height: 48, flex: "0 0 auto", borderRadius: 14, display: "grid", placeItems: "center", background: "var(--primary-bg)", color: "var(--primary)" }}>
            <Icon name="bell" size={24} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase" }}>
              Nova demanda para você{pendingItems.length > 1 ? ` · ${pendingItems.length} pendentes` : ""}
            </div>
            <h2 id="demand-title" style={{ margin: "5px 0 0", fontSize: 28, lineHeight: 1.2, letterSpacing: "-.5px" }}>{item.title}</h2>
          </div>
        </div>

        <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 22 }}>
          <span className="badge" style={{ color: priority.color, background: priority.bg, border: "none" }}>{priority.label}</span>
          <span className="badge">{tipo}</span>
          {item.projectName && <span className="badge"><Icon name="folder" size={12} /> {item.projectName}</span>}
          {item.dueDate && <span className="badge"><Icon name="calendar" size={12} /> Prazo: {new Date(item.dueDate).toLocaleDateString("pt-BR")}</span>}
        </div>

        <div className="card" style={{ padding: 20, background: "var(--surface-3)", minHeight: 122, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.65 }}>
          {item.description ?? "Sem descrição adicional. Confira detalhes e próximos passos na demanda."}
        </div>

        <p className="muted" style={{ margin: "20px 0 0", fontSize: 13 }}>
          Confirme somente após ler. Registro entra nas atualizações da demanda.
        </p>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 22 }}>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={pending} style={{ minHeight: 48, padding: "0 22px", fontSize: 15 }}>
            <Icon name="checkCircle" size={18} /> {pending ? "Confirmando…" : "Confirmo que recebi esta demanda"}
          </button>
        </div>
      </section>
    </div>
  );
}
