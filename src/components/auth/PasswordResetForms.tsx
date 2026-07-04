"use client";

// Forms do fluxo "esqueci minha senha" (pedir link + redefinir).
// Mesmo visual do AuthForm (auth-wrap/auth-card).
import { useActionState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { forgotPasswordAction, resetPasswordAction, type ForgotState } from "@/app/(auth)/actions";

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="sb-logo"><Icon name="layers" /></div>
          <div>
            <div className="sb-brand-name">OpenBoard</div>
            <div className="sb-brand-sub">Controle de Projetos</div>
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-.4px" }}>{title}</h1>
        <p className="page-sub" style={{ marginBottom: 22 }}>{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  return (
    <Shell title="Esqueci minha senha" sub="Informe seu e-mail para gerar um link de redefinição.">
      {state.ok ? (
        <div>
          <div style={{ background: "var(--st-done-bg)", color: "var(--st-done)", borderRadius: "var(--r-md)", padding: 14, fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>
            Se o e-mail existir no sistema, um link de redefinição foi gerado (válido por 1 hora).
            Sem e-mail configurado, o link aparece no log do servidor — peça ao administrador.
          </div>
          <p className="page-sub" style={{ textAlign: "center", marginTop: 20 }}>
            <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>Voltar ao login</Link>
          </p>
        </div>
      ) : (
        <>
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </div>
            {state.error && <div className="form-error">{state.error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? "Gerando…" : "Gerar link de redefinição"}
            </button>
          </form>
          <p className="page-sub" style={{ textAlign: "center", marginTop: 20 }}>
            Lembrou a senha?{" "}
            <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>Entrar</Link>
          </p>
        </>
      )}
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(resetPasswordAction, {});
  if (!token) {
    return (
      <Shell title="Redefinir senha" sub="Link incompleto.">
        <div className="form-error">Este link não tem token. Peça um novo em Esqueci minha senha.</div>
        <p className="page-sub" style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/esqueci-senha" style={{ color: "var(--primary)", fontWeight: 700 }}>Pedir novo link</Link>
        </p>
      </Shell>
    );
  }
  return (
    <Shell title="Redefinir senha" sub="Escolha a nova senha da sua conta.">
      {state.ok ? (
        <div>
          <div style={{ background: "var(--st-done-bg)", color: "var(--st-done)", borderRadius: "var(--r-md)", padding: 14, fontSize: 13.5, fontWeight: 700 }}>
            Senha redefinida com sucesso.
          </div>
          <Link href="/login" className="btn btn-primary btn-block" style={{ marginTop: 16, justifyContent: "center" }}>
            Entrar com a nova senha
          </Link>
        </div>
      ) : (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="hidden" name="token" value={token} />
          <div className="field">
            <label htmlFor="password">Nova senha</label>
            <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirmar nova senha</label>
            <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {state.error && <div className="form-error">{state.error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Redefinir senha"}
          </button>
        </form>
      )}
    </Shell>
  );
}
