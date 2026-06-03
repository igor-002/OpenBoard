"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { setMyPassword, skipPasswordChange } from "@/app/(app)/settings/account/actions";

export function FirstAccessModal({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(mustChange);
  const [state, formAction, pending] = useActionState(setMyPassword, {});
  const [skipping, startSkip] = useTransition();

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  if (!open) return null;

  function skip() {
    setOpen(false);
    startSkip(async () => {
      await skipPasswordChange();
      router.refresh();
    });
  }

  return (
    <Modal title="Bem-vindo(a) à OpenBoard" onClose={skip} maxWidth={420}>
      <p className="page-sub" style={{ margin: "0 0 16px" }}>
        Sua senha foi definida pelo administrador. Quer criar uma senha própria agora?
      </p>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="next">Nova senha</label>
          <input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={8} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar senha</label>
          <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        {state.error && <div className="form-error">{state.error}</div>}
        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn" onClick={skip} disabled={skipping || pending}>Agora não</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Salvando…" : "Definir senha"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
