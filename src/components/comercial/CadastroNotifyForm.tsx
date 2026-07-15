"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { saveCadastroNotifySettings, type ConfigActionState } from "@/app/(comercial)/comercial/config/actions";

type UserOpt = { id: string; name: string; role: string };

// Escolhe quem recebe toast + sino quando chega solicitação de cadastro nova.
export function CadastroNotifyForm({ users, selectedIds }: { users: UserOpt[]; selectedIds: string[] }) {
  const [state, formAction, pending] = useActionState<ConfigActionState, FormData>(saveCadastroNotifySettings, {});
  // "salvo" derivado do state (sem setState síncrono em effect): esconde a
  // mensagem guardando a referência do state já exibido após 4s.
  const [ocultoPara, setOcultoPara] = useState<ConfigActionState | null>(null);
  const saved = !!state.ok && state !== ocultoPara;

  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => setOcultoPara(state), 4000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map((u) => (
          <label
            key={u.id}
            style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer", padding: "6px 2px" }}
          >
            <input type="checkbox" name="userIds" value={u.id} defaultChecked={selectedIds.includes(u.id)} />
            <span style={{ fontWeight: 600 }}>{u.name}</span>
            {u.role === "admin" && <span className="badge">admin</span>}
          </label>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        Sem ninguém marcado, todos os administradores recebem (fallback de segurança).
      </p>

      {state.error && <div className="form-error">{state.error}</div>}
      {saved && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--st-done)" }}>
          <Icon name="checkCircle" size={15} /> Destinatários salvos.
        </div>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          <Icon name="check" size={15} /> {pending ? "Salvando…" : "Salvar destinatários"}
        </button>
      </div>
    </form>
  );
}
