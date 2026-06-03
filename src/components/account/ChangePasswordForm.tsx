"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/(app)/settings/account/actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, {});

  return (
    <form
      action={formAction}
      // Limpa os campos após sucesso.
      key={state.ok ? "ok" : "form"}
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 380 }}
    >
      <div className="field">
        <label htmlFor="current">Senha atual</label>
        <input className="input" id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">Nova senha</label>
        <input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirmar nova senha</label>
        <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && (
        <div className="form-error" style={{ color: "var(--st-done)", background: "var(--st-done-bg)" }}>
          Senha alterada com sucesso.
        </div>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Alterar senha"}
        </button>
      </div>
    </form>
  );
}
