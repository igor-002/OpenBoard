"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { addFollowupAction, updateStatusAction, assignAction } from "@/app/(marketing)/marketing/demandas/actions";
import type { GlpiUserOpt } from "@/server/glpi/users";

const STATUS_OPTS: { id: number; label: string }[] = [
  { id: 1, label: "Novo" },
  { id: 2, label: "Em atendimento" },
  { id: 4, label: "Pendente" },
  { id: 5, label: "Solucionado" },
  { id: 6, label: "Fechado" },
];

type Msg = { ok: boolean; text: string } | null;

export function TicketActions({
  glpiId,
  statusId,
  assignable,
}: {
  glpiId: number;
  statusId: number;
  assignable: GlpiUserOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  const [content, setContent] = useState("");
  const [priv, setPriv] = useState(false);
  const [status, setStatus] = useState(String(statusId));
  const [assignee, setAssignee] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error || "Falha na operação." });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ marginBottom: 14 }}>
        <h2 className="card-title">Ações</h2>
        {msg && (
          <span style={{ color: msg.ok ? "var(--st-done)" : "var(--st-risk)", fontWeight: 600, fontSize: 12.5 }}>{msg.text}</span>
        )}
      </div>

      {/* Acompanhamento */}
      <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Novo acompanhamento</label>
      <textarea
        className="input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva uma atualização para este chamado…"
        rows={3}
        style={{ width: "100%", marginTop: 6, resize: "vertical" }}
      />
      <div className="row gap12" style={{ alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <label className="row gap8" style={{ alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}>
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> privado
        </label>
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          disabled={pending || !content.trim()}
          onClick={() => run(() => addFollowupAction(glpiId, content, priv), "Acompanhamento adicionado.", () => setContent(""))}
        >
          <Icon name="msg" size={15} /> Adicionar
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", margin: "16px 0" }} />

      {/* Status + atribuição */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
          <div className="row gap8" style={{ marginTop: 6 }}>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: 1 }}>
              {STATUS_OPTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button
              className="btn btn-ghost"
              disabled={pending || Number(status) === statusId}
              onClick={() => run(() => updateStatusAction(glpiId, Number(status)), "Status atualizado.")}
            >
              Aplicar
            </button>
          </div>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Atribuir responsável</label>
          <div className="row gap8" style={{ marginTop: 6 }}>
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ flex: 1 }}>
              <option value="">Escolher…</option>
              {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button
              className="btn btn-ghost"
              disabled={pending || !assignee}
              onClick={() => run(() => assignAction(glpiId, Number(assignee)), "Responsável atribuído.", () => setAssignee(""))}
            >
              Atribuir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
