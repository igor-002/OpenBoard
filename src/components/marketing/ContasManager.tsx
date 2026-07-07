"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { fullLabel } from "@/lib/format";
import {
  createCompanyAction,
  deleteCompanyAction,
  createAccountAction,
  deleteAccountAction,
  setAccountActiveAction,
  connectAccountTokenAction,
  renameAccountAction,
  runManualMarketingSyncAction,
} from "@/app/(marketing)/marketing/social/contas/actions";

interface AccountRow {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
}
interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  accounts: AccountRow[];
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 40, height: 22, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer",
        background: on ? "var(--st-done)" : "var(--line-2)", position: "relative", transition: "background .15s", opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "var(--sh-sm)" }} />
    </button>
  );
}

export function ContasManager({ companies }: { companies: CompanyRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newAccount, setNewAccount] = useState<{ companyId: string; username: string; displayName: string } | null>(null);
  const [tokenFor, setTokenFor] = useState<string | null>(null);
  const [tokenValue, setTokenValue] = useState("");
  const [renameFor, setRenameFor] = useState<{ id: string; real: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, onOk?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        onOk?.();
        router.refresh();
      } else {
        setMsg(r.error ?? "Erro inesperado.");
      }
    });
  }

  function addCompany() {
    const name = newCompanyName.trim();
    if (!name) return;
    run(() => createCompanyAction(name), () => setNewCompanyName(""));
  }

  function addAccount() {
    if (!newAccount || !newAccount.username.trim()) return;
    run(
      () => createAccountAction(newAccount.companyId, newAccount.username, newAccount.displayName),
      () => setNewAccount(null),
    );
  }

  function connectToken() {
    if (!tokenFor || !tokenValue.trim()) return;
    const accountId = tokenFor;
    setMsg(null);
    start(async () => {
      const r = await connectAccountTokenAction(accountId, tokenValue);
      if (!r.ok) {
        setMsg(r.error ?? "Erro inesperado.");
        return;
      }
      setTokenFor(null);
      setTokenValue("");
      if (r.usernameMismatch) {
        // Token válido, mas pertence a um username diferente do cadastrado —
        // não corrige sozinho, oferece o rename pro admin decidir.
        setRenameFor({ id: accountId, real: r.usernameMismatch });
        setRenameValue(r.usernameMismatch);
        setMsg(`Token conectado, mas pertence a @${r.usernameMismatch} (cadastro diverge).`);
      }
      router.refresh();
    });
  }

  function renameAccount() {
    if (!renameFor || !renameValue.trim()) return;
    run(
      () => renameAccountAction(renameFor.id, renameValue),
      () => setRenameFor(null),
    );
  }

  function syncAgora() {
    setMsg(null);
    start(async () => {
      const r = await runManualMarketingSyncAction();
      if (!r.ok) {
        setMsg("Falha ao sincronizar.");
        return;
      }
      const erros = r.resultados?.filter((x) => x.status === "erro").length ?? 0;
      const semToken = r.resultados?.filter((x) => x.status === "sem_token").length ?? 0;
      setMsg(`Sync concluído: ${r.resultados?.length ?? 0} conta(s), ${erros} erro(s), ${semToken} sem token.`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)" }}>
        <button className="btn btn-primary" onClick={syncAgora} disabled={pending}>
          <Icon name="zap" size={15} /> {pending ? "…" : "Sincronizar agora"}
        </button>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>

      <Card title="Nova empresa" pad>
        <div className="row gap12">
          <input
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Nome da empresa"
            style={{ flex: 1, maxWidth: 320 }}
            className="input"
          />
          <button className="btn btn-ghost" onClick={addCompany} disabled={pending || !newCompanyName.trim()}>
            <Icon name="plus" size={15} /> Adicionar
          </button>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        {companies.length === 0 && (
          <div className="card card-pad muted">Nenhuma empresa cadastrada ainda.</div>
        )}
        {companies.map((c) => (
          <Card
            key={c.id}
            title={c.name}
            sub={`${c.accounts.length} conta(s) · /${c.slug}`}
            pad={false}
            action={
              <button
                className="icon-btn"
                title="Excluir empresa"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Excluir "${c.name}" e todas as suas contas?`)) run(() => deleteCompanyAction(c.id));
                }}
              >
                <Icon name="alert" size={15} />
              </button>
            }
          >
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Conta</th>
                  <th style={{ textAlign: "left" }}>Token</th>
                  <th style={{ textAlign: "left" }}>Último sync</th>
                  <th style={{ textAlign: "center" }}>Ativa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="row gap8" style={{ alignItems: "center" }}>
                        <span style={{ fontWeight: 700 }}>@{a.username}</span>
                        <button
                          className="icon-btn"
                          title="Renomear (corrigir username)"
                          style={{ width: 22, height: 22 }}
                          onClick={() => { setRenameFor({ id: a.id, real: a.username }); setRenameValue(a.username); }}
                        >
                          <Icon name="more" size={12} />
                        </button>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.displayName}</div>
                    </td>
                    <td>
                      {a.hasToken ? (
                        <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)" }}>
                          conectado{a.tokenExpiresAt ? ` · expira ${fullLabel(new Date(a.tokenExpiresAt))}` : ""}
                        </span>
                      ) : (
                        <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>sem token</span>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12 }}
                        onClick={() => { setTokenFor(a.id); setTokenValue(""); }}
                      >
                        {a.hasToken ? "Renovar" : "Conectar"}
                      </button>
                    </td>
                    <td className="muted">{a.lastSyncAt ? fullLabel(new Date(a.lastSyncAt)) : "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <Toggle on={a.active} disabled={pending} onChange={(v) => run(() => setAccountActiveAction(a.id, v))} />
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        title="Excluir conta"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Excluir @${a.username}?`)) run(() => deleteAccountAction(a.id));
                        }}
                      >
                        <Icon name="alert" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: "12px var(--card-pad)" }}>
              {newAccount?.companyId === c.id ? (
                <div className="row gap8" style={{ alignItems: "center" }}>
                  <input
                    value={newAccount.username}
                    onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                    placeholder="@usuario"
                    className="input"
                    style={{ maxWidth: 160 }}
                  />
                  <input
                    value={newAccount.displayName}
                    onChange={(e) => setNewAccount({ ...newAccount, displayName: e.target.value })}
                    placeholder="Nome de exibição (opcional)"
                    className="input"
                    style={{ maxWidth: 220 }}
                  />
                  <button className="btn btn-primary" onClick={addAccount} disabled={pending}>Salvar</button>
                  <button className="btn btn-ghost" onClick={() => setNewAccount(null)}>Cancelar</button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => setNewAccount({ companyId: c.id, username: "", displayName: "" })}
                >
                  <Icon name="plus" size={15} /> Conta Instagram
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {tokenFor && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setTokenFor(null)}
        >
          <div className="card card-pad" style={{ width: 420, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>Conectar token de acesso</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
              Cole o token de longa duração da Instagram Platform (variante &quot;Login do Instagram&quot;).
              O token é validado contra a API antes de ser salvo.
            </p>
            <textarea
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="IGQ..."
              rows={4}
              className="input"
              style={{ width: "100%", resize: "vertical", marginBottom: 12 }}
            />
            <div className="row gap8" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setTokenFor(null)} disabled={pending}>Cancelar</button>
              <button className="btn btn-primary" onClick={connectToken} disabled={pending || !tokenValue.trim()}>
                {pending ? "Validando…" : "Conectar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {renameFor && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setRenameFor(null)}
        >
          <div className="card card-pad" style={{ width: 380, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>Corrigir username</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
              O token conectado pertence a <b>@{renameFor.real}</b>. Ajuste o username cadastrado se necessário.
            </p>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="@usuario"
              className="input"
              style={{ width: "100%", marginBottom: 12 }}
            />
            <div className="row gap8" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRenameFor(null)} disabled={pending}>Cancelar</button>
              <button className="btn btn-primary" onClick={renameAccount} disabled={pending || !renameValue.trim()}>
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
