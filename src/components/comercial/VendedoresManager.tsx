"use client";

import { useState, useTransition, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { setVendedorAtivo, setVendedorHistorico, setVendedorUser, autoVincularVendedores, syncVendedoresAction } from "@/app/(comercial)/comercial/vendedores/actions";
import type { VendedorRow } from "@/server/comercial/queries";

type UserOpt = { id: string; name: string };

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

export function VendedoresManager({ rows, userOpts, isAdmin }: { rows: VendedorRow[]; userOpts: UserOpt[]; workspaceId: string; isAdmin: boolean }) {
  const [list, setList] = useState(rows);
  const [busca, setBusca] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const userNome = useMemo(() => new Map(userOpts.map((u) => [u.id, u.name])), [userOpts]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return list;
    return list.filter((v) => v.nome.toLowerCase().includes(t) || v.ixcId.includes(t));
  }, [list, busca]);

  const ativos = list.filter((v) => v.ativo).length;

  function toggleAtivo(v: VendedorRow, val: boolean) {
    setList((l) => l.map((x) => (x.id === v.id ? { ...x, ativo: val, incluirHistorico: val ? x.incluirHistorico : false } : x)));
    start(async () => { await setVendedorAtivo(v.id, val); });
  }
  function toggleHist(v: VendedorRow, val: boolean) {
    setList((l) => l.map((x) => (x.id === v.id ? { ...x, incluirHistorico: val } : x)));
    start(async () => { await setVendedorHistorico(v.id, val); });
  }
  function vincularUser(v: VendedorRow, userId: string) {
    setList((l) => l.map((x) => (x.id === v.id ? { ...x, userId: userId || null, userName: userId ? userNome.get(userId) ?? null : null } : x)));
    start(async () => { await setVendedorUser(v.id, userId || null); });
  }
  function autoVincular() {
    setMsg(null);
    start(async () => {
      const r = await autoVincularVendedores();
      setMsg(r.ok ? `${r.vinculados ?? 0} vendedor(es) vinculados por nome. Recarregue.` : r.error ?? "Erro");
    });
  }
  function syncVend() {
    setMsg(null);
    start(async () => {
      const r = await syncVendedoresAction();
      setMsg(r.ok ? `Vendedores sincronizados (${r.total} no IXC). Recarregue.` : r.error ?? "Erro");
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Vendedores</h1>
          <p className="page-sub">Defina quais vendedores aparecem no CRM e entram no sync de contratos.</p>
        </div>
        {isAdmin && (
          <div className="row gap12" style={{ alignItems: "center" }}>
            {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
            <button className="btn btn-ghost" onClick={autoVincular} disabled={pending} title="Vincula vendedores a usuários do OpenBoard com mesmo nome">
              <Icon name="users" size={15} /> Vincular por nome
            </button>
            <button className="btn btn-primary" onClick={syncVend} disabled={pending}>
              <Icon name="download" size={15} /> {pending ? "…" : "Sincronizar Vendedores"}
            </button>
          </div>
        )}
      </div>

      <div className="card card-pad row gap8" style={{ alignItems: "center", background: "var(--surface-3)" }}>
        <Icon name="search" size={15} style={{ color: "var(--muted)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou ID IXC…"
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14 }}
        />
      </div>

      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Vendedores" sub={`${ativos} de ${list.length} ativos no CRM`} pad={false}>
          {filtrados.length === 0 ? (
            <div className="card-pad muted">Nenhum vendedor. {isAdmin ? "Clique em Sincronizar Vendedores." : ""}</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Vendedor</th>
                  <th style={{ textAlign: "left" }}>ID IXC</th>
                  <th style={{ textAlign: "left" }}>Usuário OpenBoard</th>
                  <th style={{ textAlign: "center" }}>Ativo no CRM</th>
                  <th style={{ textAlign: "center" }}>Histórico (sync)</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="row gap8" style={{ alignItems: "center" }}>
                        <span style={{ fontWeight: 700 }}>{v.nome}</span>
                        {v.incluirHistorico && (
                          <span className="badge" style={{ color: "var(--st-progress)", background: "var(--st-progress-bg)", fontSize: 10 }}>HIST</span>
                        )}
                      </span>
                    </td>
                    <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>{v.ixcId}</td>
                    <td>
                      {isAdmin ? (
                        <select className="select-comercial" value={v.userId ?? ""} disabled={pending} onChange={(e) => vincularUser(v, e.target.value)} style={{ maxWidth: 200 }}>
                          <option value="">— não vinculado —</option>
                          {userOpts.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={v.userName ? "" : "muted"}>{v.userName ?? "—"}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Toggle on={v.ativo} disabled={!isAdmin || pending} onChange={(val) => toggleAtivo(v, val)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {v.ativo ? (
                        <Toggle on={v.incluirHistorico} disabled={!isAdmin || pending} onChange={(val) => toggleHist(v, val)} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {!isAdmin && <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Apenas administradores podem alterar.</p>}
    </div>
  );
}
