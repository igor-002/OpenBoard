"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useOverlayClose } from "@/components/ui/useOverlayClose";
import { createUser, updateUserRole, deleteUser, resetUserPassword, updateUserHourlyCost, updateUserModules } from "@/app/(app)/settings/users/actions";
import type { UserRow } from "@/server/users";
import type { Role } from "@/lib/types";
import { MODULES, MODULE_LABELS } from "@/lib/modules";

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDel, start] = useTransition();
  const [confirmUser, setConfirmUser] = useState<{ id: string; name: string } | null>(null);
  const [resetUser, setResetUser] = useState<{ id: string; name: string } | null>(null);
  const [modUser, setModUser] = useState<{ id: string; name: string; modules: string[] } | null>(null);
  // papéis em estado local (otimista) — o select reflete na hora; servidor confirma.
  const [roles, setRoles] = useState<Record<string, Role>>(() => Object.fromEntries(users.map((u) => [u.id, u.role])));
  useEffect(() => {
    setRoles(Object.fromEntries(users.map((u) => [u.id, u.role])));
  }, [users]);

  function changeRole(id: string, role: Role) {
    setErr(null);
    const prev = roles[id];
    setRoles((p) => ({ ...p, [id]: role })); // muda já
    start(async () => {
      const r = await updateUserRole(id, role);
      if (r.error) {
        setErr(r.error);
        setRoles((p) => ({ ...p, [id]: prev })); // reverte se falhou
      }
      router.refresh();
    });
  }
  function confirmRemove() {
    const target = confirmUser;
    if (!target) return;
    setErr(null);
    start(async () => {
      const r = await deleteUser(target.id);
      if (r.error) setErr(r.error);
      setConfirmUser(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-sub">{users.length} pessoas · gerencie acessos e papéis</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          Convidar usuário
        </button>
      </div>

      {err && <div className="form-error" style={{ marginBottom: 16 }}>{err}</div>}

      <Card pad={false}>
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>Pessoa</th><th>E-mail</th><th>Cargo</th><th>Custo/h</th><th>Papel</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="row gap12">
                      <Avatar user={u} size={34} />
                      <div className="nm">{u.name}{isSelf && <span className="muted" style={{ fontWeight: 500 }}> · você</span>}</div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.jobTitle}</td>
                  <td><HourlyCost userId={u.id} initial={u.hourlyCostCents} /></td>
                  <td>
                    <select
                      className="input"
                      style={{ width: 130, padding: "7px 10px" }}
                      value={roles[u.id] ?? u.role}
                      disabled={isSelf}
                      onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    >
                      <option value="admin">Admin</option>
                      <option value="membro">Membro</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                      {(roles[u.id] ?? u.role) === "admin" ? (
                        <span className="muted" style={{ fontSize: 12 }} title="Admin acessa todos os módulos">acesso total</span>
                      ) : (
                        <button
                          className="icon-btn"
                          style={{ width: 34, height: 34, border: "none", background: "none", color: "var(--ink-2)" }}
                          title="Módulos que este usuário acessa"
                          onClick={() => setModUser({ id: u.id, name: u.name, modules: u.modules })}
                        >
                          <Icon name="grid" size={16} />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        style={{ width: 34, height: 34, border: "none", background: "none", color: "var(--ink-2)" }}
                        title="Redefinir senha"
                        onClick={() => setResetUser({ id: u.id, name: u.name })}
                      >
                        <Icon name="settings" size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 34, height: 34, border: "none", background: "none", color: isSelf ? "var(--muted-2)" : "var(--st-risk)" }}
                        disabled={isSelf}
                        title={isSelf ? "Você não pode se remover" : "Remover"}
                        onClick={() => setConfirmUser({ id: u.id, name: u.name })}
                      >
                        <Icon name="alert" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {open && <InviteModal onClose={() => { setOpen(false); router.refresh(); }} />}
      {confirmUser && (
        <ConfirmModal
          danger
          title="Remover usuário?"
          confirmLabel="Remover"
          pending={pendingDel}
          onConfirm={confirmRemove}
          onClose={() => setConfirmUser(null)}
          message={<><b style={{ color: "var(--ink)" }}>{confirmUser.name}</b> perderá o acesso ao workspace. Esta ação não pode ser desfeita.</>}
        />
      )}
      {resetUser && <ResetModal user={resetUser} onClose={() => { setResetUser(null); router.refresh(); }} />}
      {modUser && <ModulesModal user={modUser} onClose={() => { setModUser(null); router.refresh(); }} />}
    </>
  );
}

// Escolhe quais módulos um usuário (não-admin) pode acessar.
function ModulesModal({ user, onClose }: { user: { id: string; name: string; modules: string[] }; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(user.modules);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(key: string) {
    setSel((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }
  function save() {
    setErr(null);
    start(async () => {
      const r = await updateUserModules(user.id, sel);
      if (r.error) { setErr(r.error); return; }
      onClose();
    });
  }

  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <h3 className="card-title" style={{ fontSize: 18, marginBottom: 8 }}>Acesso de {user.name}</h3>
        <p className="page-sub" style={{ margin: "0 0 16px" }}>
          Marque as áreas que este usuário pode ver e usar. Admins acessam tudo automaticamente.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MODULES.map((key) => (
            <label key={key} className="row gap12" style={{ alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={sel.includes(key)} onChange={() => toggle(key)} style={{ marginTop: 3 }} />
              <span style={{ fontSize: 14 }}>{MODULE_LABELS[key]}</span>
            </label>
          ))}
        </div>
        {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn" onClick={onClose} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar acesso"}</button>
        </div>
      </div>
    </div>
  );
}

// D1 — input de custo/hora (reais), salva no blur. Margem usa em /comercial/margem.
function HourlyCost({ userId, initial }: { userId: string; initial: number }) {
  const [val, setVal] = useState(initial ? String(initial / 100) : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  function save() {
    const cents = Math.round((parseFloat((val || "0").replace(",", ".")) || 0) * 100);
    if (cents === initial) return;
    start(async () => {
      await updateUserHourlyCost(userId, cents);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }
  return (
    <span className="row gap8" style={{ alignItems: "center" }}>
      <span className="muted" style={{ fontSize: 12 }}>R$</span>
      <input
        className="input"
        style={{ width: 84, padding: "7px 10px" }}
        type="number" min="0" step="0.01" inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        placeholder="0,00"
      />
      {pending ? <span className="muted" style={{ fontSize: 11 }}>…</span> : saved ? <Icon name="checkCircle" size={14} style={{ color: "var(--st-done)" }} /> : null}
    </span>
  );
}

function ResetModal({ user, onClose }: { user: { id: string; name: string }; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setErr(null);
    if (pwd.length < 8) { setErr("Senha precisa de ao menos 8 caracteres."); return; }
    start(async () => {
      const r = await resetUserPassword(user.id, pwd);
      if (r.error) { setErr(r.error); return; }
      onClose();
    });
  }

  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <h3 className="card-title" style={{ fontSize: 18, marginBottom: 8 }}>Redefinir senha</h3>
        <p className="page-sub" style={{ margin: "0 0 16px" }}>
          Defina uma nova senha para <b style={{ color: "var(--ink)" }}>{user.name}</b>. No próximo acesso será sugerido que troque por uma própria.
        </p>
        <div className="field">
          <label htmlFor="np">Nova senha</label>
          <input className="input" id="np" type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="mín. 8 caracteres" autoFocus />
        </div>
        {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn" onClick={onClose} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Salvando…" : "Redefinir"}</button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createUser, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3 className="card-title" style={{ fontSize: 18 }}>Convidar usuário</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onClose} aria-label="Fechar">
            <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input className="input" id="name" name="name" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="row gap12">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="jobTitle">Cargo</label>
              <input className="input" id="jobTitle" name="jobTitle" placeholder="Dev, Designer…" required />
            </div>
            <div className="field" style={{ width: 130 }}>
              <label htmlFor="role">Papel</label>
              <select className="input" id="role" name="role" defaultValue="membro">
                <option value="membro">Membro</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Senha inicial</label>
            <input className="input" id="password" name="password" type="text" minLength={8} placeholder="mín. 8 caracteres" required />
            <span className="muted" style={{ fontSize: 12 }}>O usuário entra com essa senha e pode trocá-la depois.</span>
          </div>

          {state.error && <div className="form-error">{state.error}</div>}

          <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Criando…" : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
