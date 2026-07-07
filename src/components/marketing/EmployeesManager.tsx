"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import {
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
} from "@/app/(marketing)/marketing/equipe/funcionarios/actions";

interface EmployeeRow {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  userId: string | null;
}
type UserOpt = { id: string; name: string };

export function EmployeesManager({ employees, userOpts }: { employees: EmployeeRow[]; userOpts: UserOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<{ name: string; role: string; userId: string } | null>(null);

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

  function addEmployee() {
    if (!newForm || !newForm.name.trim()) return;
    run(
      () => createEmployeeAction(newForm.name, newForm.role, newForm.userId || null),
      () => setNewForm(null),
    );
  }

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)" }}>
        <button className="btn btn-primary" onClick={() => setNewForm({ name: "", role: "", userId: "" })} disabled={pending}>
          <Icon name="plus" size={15} /> Novo funcionário
        </button>
        {msg && <span style={{ color: "var(--st-risk)", fontSize: 12.5 }}>{msg}</span>}
      </div>

      <Card title="Funcionários" sub={`${employees.length} cadastrado(s)`} pad={false}>
        {employees.length === 0 ? (
          <div className="card-pad muted">Nenhum funcionário ainda.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Nome</th>
                <th style={{ textAlign: "left" }}>Cargo</th>
                <th style={{ textAlign: "left" }}>Usuário OpenBoard</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <EmployeeRowItem key={e.id} employee={e} userOpts={userOpts} pending={pending} run={run} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {newForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setNewForm(null)}
        >
          <div className="card card-pad" style={{ width: 400, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Novo funcionário</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="input" placeholder="Nome" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} autoFocus />
              <input className="input" placeholder="Cargo (ex: Social Media)" value={newForm.role} onChange={(e) => setNewForm({ ...newForm, role: e.target.value })} />
              <select className="input" value={newForm.userId} onChange={(e) => setNewForm({ ...newForm, userId: e.target.value })}>
                <option value="">— sem vínculo com usuário —</option>
                {userOpts.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setNewForm(null)} disabled={pending}>Cancelar</button>
                <button className="btn btn-primary" onClick={addEmployee} disabled={pending || !newForm.name.trim()}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmployeeRowItem({
  employee,
  userOpts,
  pending,
  run,
}: {
  employee: EmployeeRow;
  userOpts: UserOpt[];
  pending: boolean;
  run: (fn: () => Promise<{ ok?: boolean; error?: string }>) => void;
}) {
  const [role, setRole] = useState(employee.role);

  return (
    <tr>
      <td>
        <span className="row gap8" style={{ alignItems: "center" }}>
          <Avatar user={{ name: employee.name, initials: employee.name.slice(0, 2).toUpperCase(), color: employee.avatarColor }} size={30} />
          <span style={{ fontWeight: 700 }}>{employee.name}</span>
        </span>
      </td>
      <td>
        <input
          className="input"
          value={role}
          disabled={pending}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => role !== employee.role && run(() => updateEmployeeAction(employee.id, { role }))}
          style={{ maxWidth: 180 }}
        />
      </td>
      <td>
        <select
          className="select-comercial"
          value={employee.userId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => updateEmployeeAction(employee.id, { userId: e.target.value || null }))}
          style={{ maxWidth: 200 }}
        >
          <option value="">— não vinculado —</option>
          {userOpts.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </td>
      <td>
        <button
          className="icon-btn"
          title="Excluir"
          disabled={pending}
          onClick={() => {
            if (confirm(`Excluir "${employee.name}"? As tarefas dele também serão removidas.`)) {
              run(() => deleteEmployeeAction(employee.id));
            }
          }}
        >
          <Icon name="alert" size={14} />
        </button>
      </td>
    </tr>
  );
}
