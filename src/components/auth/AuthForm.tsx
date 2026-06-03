"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AuthState } from "@/app/(auth)/actions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({ mode, action }: { mode: "login" | "register"; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="sb-logo">
            <Icon name="layers" />
          </div>
          <div>
            <div className="sb-brand-name">OpenBoard</div>
            <div className="sb-brand-sub">Controle de Projetos</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-.4px" }}>
          {isLogin ? "Entrar" : "Criar conta"}
        </h1>
        <p className="page-sub" style={{ marginBottom: 22 }}>
          {isLogin ? "Acesse o seu workspace." : "Comece a organizar seus projetos."}
        </p>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input className="input" id="name" name="name" type="text" autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </div>

          {state.error && <div className="form-error">{state.error}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Aguarde…" : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="page-sub" style={{ textAlign: "center", marginTop: 20 }}>
          {isLogin ? (
            <>
              Não tem conta?{" "}
              <Link href="/register" style={{ color: "var(--primary)", fontWeight: 700 }}>
                Criar agora
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>
                Entrar
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
