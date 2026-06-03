"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { hms } from "@/lib/format";
import { startTimer, pauseTimer, resumeTimer, finishTimer } from "@/app/(app)/time/actions";
import type { TimeData, TimeLogRow } from "@/server/time";
import type { TimeLogStatus } from "@/lib/types";

const STATUS: Record<TimeLogStatus, [string, string, string, IconName]> = {
  running: ["Rodando", "var(--st-done)", "var(--st-done-bg)", "play"],
  paused: ["Pausado", "var(--pr-med)", "var(--pr-med-bg)", "pause"],
  done: ["Finalizado", "var(--muted)", "var(--surface-3)", "check"],
};

// Cronômetro ao vivo: soma o segmento em andamento quando "running".
function LiveDuration({ row }: { row: TimeLogRow }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (row.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [row.status]);
  const secs =
    row.durationSec + (row.status === "running" ? Math.max(0, Math.floor((now - row.startedMs) / 1000)) : 0);
  return (
    <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, color: row.status === "running" ? "var(--st-done)" : "var(--ink)" }}>
      {hms(secs)}
    </b>
  );
}

export function StartTimerButton({ projects }: { projects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(startTimer, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="play" size={15} />
        Iniciar timer
      </button>
      {open && (
        <Modal title="Iniciar timer" onClose={() => setOpen(false)}>
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label htmlFor="projectId">Projeto</label>
              <select className="input" id="projectId" name="projectId" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="taskTitle">No que está trabalhando?</label>
              <input className="input" id="taskTitle" name="taskTitle" placeholder="Ex.: Modelagem de dados" required autoFocus />
            </div>
            {state.error && <div className="form-error">{state.error}</div>}
            <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Iniciando…" : "Iniciar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function TimeLogTable({ data }: { data: TimeData }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const run = (fn: (id: string) => Promise<unknown>, id: string) =>
    start(async () => {
      await fn(id);
      router.refresh();
    });

  return (
    <table className="tbl" style={{ marginTop: 6 }}>
      <thead>
        <tr><th>Membro</th><th>Projeto · tarefa</th><th>Duração</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {data.logs.length === 0 && (
          <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Nenhum apontamento ainda. Clique em “Iniciar timer”.</td></tr>
        )}
        {data.logs.map((l) => {
          const sm = STATUS[l.status];
          const mine = l.userId === data.currentUserId;
          return (
            <tr key={l.id}>
              <td>
                <div className="row gap12">
                  <Avatar user={l.user} size={34} />
                  <div><div className="nm">{l.user.name}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.user.jobTitle}</div></div>
                </div>
              </td>
              <td><div style={{ fontWeight: 600 }}>{l.projectName.split("—")[0].trim()}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{l.taskTitle}</div></td>
              <td><LiveDuration row={l} /></td>
              <td><span className="badge" style={{ color: sm[1], background: sm[2] }}><Icon name={sm[3]} size={12} />{sm[0]}</span></td>
              <td style={{ textAlign: "right" }}>
                {mine && l.status !== "done" && (
                  <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                    {l.status === "running" ? (
                      <button className="btn" style={{ padding: "6px 10px" }} disabled={busy} onClick={() => run(pauseTimer, l.id)} title="Pausar">
                        <Icon name="pause" size={14} />
                      </button>
                    ) : (
                      <button className="btn" style={{ padding: "6px 10px" }} disabled={busy} onClick={() => run(resumeTimer, l.id)} title="Retomar">
                        <Icon name="play" size={14} />
                      </button>
                    )}
                    <button className="btn" style={{ padding: "6px 10px" }} disabled={busy} onClick={() => run(finishTimer, l.id)} title="Finalizar">
                      <Icon name="check" size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
