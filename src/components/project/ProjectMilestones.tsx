"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { dayLabel } from "@/lib/format";
import { addMilestone, setMilestoneState, deleteMilestone } from "@/app/(app)/projects/actions";

type State = "done" | "doing" | "todo";
type Milestone = { id: string; title: string; state: State; date: Date };

const STATES: [State, string][] = [["todo", "A fazer"], ["doing", "Em progresso"], ["done", "Concluído"]];
const colorOf = (s: State) => (s === "done" ? "var(--st-done)" : s === "doing" ? "var(--primary)" : "var(--line-2)");

export function ProjectMilestones({ projectId, milestones }: { projectId: string; milestones: Milestone[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addMilestone.bind(null, projectId), {});
  const [, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  function setSt(id: string, s: State) {
    start(async () => {
      await setMilestoneState(id, s);
      router.refresh();
    });
  }
  function confirmRm() {
    const id = confirmId;
    if (!id) return;
    start(async () => {
      await deleteMilestone(id);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <>
      {milestones.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Nenhum marco ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
          {milestones.map((m, i, arr) => {
            const c = colorOf(m.state);
            return (
              <div key={m.id} className="row gap12" style={{ alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: m.state === "todo" ? "var(--surface)" : c, border: `2.5px solid ${c}`, marginTop: 2, flex: "none" }} />
                  {i < arr.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--line)", minHeight: 22 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 16 }}>
                  <div className="row between">
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: m.state === "todo" ? "var(--muted)" : "var(--ink)" }}>{m.title}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{dayLabel(m.date)}</span>
                  </div>
                  <div className="row gap8" style={{ marginTop: 6 }}>
                    <select value={m.state} onChange={(e) => setSt(m.id, e.target.value as State)} className="input" style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}>
                      {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <button onClick={() => setConfirmId(m.id)} title="Excluir" style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer" }}>
                      <Icon name="alert" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <input className="input" name="title" placeholder="Novo marco…" required style={{ padding: "8px 10px" }} />
        <div className="row gap8">
          <select className="input" name="state" defaultValue="todo" style={{ padding: "8px 10px", flex: 1 }}>
            {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="input" name="date" type="date" required style={{ padding: "8px 10px", flex: 1 }} />
        </div>
        {state.error && <div className="form-error">{state.error}</div>}
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ padding: "8px 12px" }}>
          {pending ? "Salvando…" : "Adicionar marco"}
        </button>
      </form>

      {confirmId && (
        <ConfirmModal
          danger
          title="Excluir marco?"
          confirmLabel="Excluir"
          onConfirm={confirmRm}
          onClose={() => setConfirmId(null)}
          message="Este marco será removido."
        />
      )}
    </>
  );
}
