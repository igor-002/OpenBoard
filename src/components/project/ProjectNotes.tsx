"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { addNote, deleteNote } from "@/app/(app)/projects/actions";
import type { ProjectNoteItem } from "@/server/projects";

function when(d: Date) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ProjectNotes({
  projectId,
  notes,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  notes: ProjectNoteItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addNote.bind(null, projectId), {});
  const [delPending, startDel] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  function confirmRemove() {
    const id = confirmId;
    if (!id) return;
    startDel(async () => {
      await deleteNote(id);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <textarea
          name="body"
          className="input"
          rows={3}
          placeholder="Escreva uma observação sobre o projeto / cliente…"
          required
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
        {state.error && <div className="form-error">{state.error}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ padding: "8px 14px" }}>
            {pending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="muted" style={{ fontSize: 13.5 }}>Nenhuma observação ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {notes.map((n) => {
            const canDelete = n.authorId === currentUserId || isAdmin;
            return (
              <div key={n.id} className="row gap12" style={{ alignItems: "flex-start" }}>
                <Avatar user={n.author} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {n.author.name}
                      <span className="muted" style={{ fontWeight: 500 }}> · {when(n.createdAt)}</span>
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => setConfirmId(n.id)}
                        title="Excluir"
                        style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer", padding: 2 }}
                      >
                        <Icon name="alert" size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmId && (
        <ConfirmModal
          danger
          title="Excluir observação?"
          confirmLabel="Excluir"
          pending={delPending}
          onConfirm={confirmRemove}
          onClose={() => setConfirmId(null)}
          message="Esta observação será removida permanentemente."
        />
      )}
    </div>
  );
}
