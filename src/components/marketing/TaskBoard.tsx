"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { isOverdue } from "@/lib/marketing/team-math";
import type { TaskDTO, TaskStatus, TaskPriority } from "@/server/marketing/task-source";
import type { EmployeeInfo } from "@/server/marketing/task-source";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "@/app/(marketing)/marketing/equipe/actions";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};
const STATUS_COLOR: Record<string, string> = {
  pendente: "var(--muted)",
  em_andamento: "var(--st-progress)",
  concluida: "var(--st-done)",
  atrasada: "var(--st-risk)",
};
const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLOR: Record<string, string> = { baixa: "var(--muted)", media: "var(--pr-med)", alta: "var(--st-risk)" };

type FormState = {
  id?: string;
  employeeId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
};

function emptyForm(employeeId: string): FormState {
  return { employeeId, title: "", description: "", priority: "media", dueDate: "" };
}

export function TaskBoard({ tasks, employees }: { tasks: TaskDTO[]; employees: EmployeeInfo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterEmployee && t.employeeId !== filterEmployee) return false;
      if (filterStatus && (isOverdue(t) ? "atrasada" : t.status) !== filterStatus) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filterEmployee, filterStatus, busca]);

  const employeeName = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  function statusOf(t: TaskDTO): string {
    return isOverdue(t) ? "atrasada" : t.status;
  }

  function save() {
    if (!form || !form.title.trim() || !form.employeeId) return;
    setMsg(null);
    const input = {
      employeeId: form.employeeId,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      dueDate: form.dueDate || null,
    };
    start(async () => {
      const r = form.id ? await updateTaskAction(form.id, input) : await createTaskAction(input);
      if (r.ok) {
        setForm(null);
        router.refresh();
      } else {
        setMsg(r.error ?? "Erro ao salvar.");
      }
    });
  }

  function setStatus(t: TaskDTO, status: TaskStatus) {
    start(async () => {
      await updateTaskAction(t.id, { status });
      router.refresh();
    });
  }

  function remove(t: TaskDTO) {
    if (!confirm(`Excluir a tarefa "${t.title}"?`)) return;
    start(async () => {
      await deleteTaskAction(t.id);
      router.refresh();
    });
  }

  return (
    <>
      <Card
        title="Tarefas"
        sub={`${filtered.length} tarefa(s)`}
        pad={false}
        action={
          <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Buscar título ou descrição…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <select className="select-comercial" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
              <option value="atrasada">Atrasada</option>
            </select>
            <select className="select-comercial" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
              <option value="">Todos os funcionários</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => setForm(emptyForm(filterEmployee || employees[0]?.id || ""))}
              disabled={employees.length === 0}
            >
              <Icon name="plus" size={15} /> Nova tarefa
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="card-pad muted">Nenhuma tarefa.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Tarefa</th>
                <th style={{ textAlign: "left" }}>Funcionário</th>
                <th style={{ textAlign: "left" }}>Prioridade</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Prazo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const st = statusOf(t);
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      {t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}
                    </td>
                    <td>{employeeName.get(t.employeeId) ?? "—"}</td>
                    <td>
                      <span className="badge" style={{ color: PRIORITY_COLOR[t.priority], background: "color-mix(in srgb, " + PRIORITY_COLOR[t.priority] + " 15%, transparent)" }}>
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ color: STATUS_COLOR[st], background: "color-mix(in srgb, " + STATUS_COLOR[st] + " 15%, transparent)" }}>
                        {STATUS_LABEL[st] ?? st}
                      </span>
                    </td>
                    <td className="muted">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
                    <td>
                      <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                        {t.status !== "concluida" ? (
                          <button className="icon-btn" title="Marcar como concluída" disabled={pending} onClick={() => setStatus(t, "concluida")}>
                            <Icon name="check" size={14} />
                          </button>
                        ) : (
                          <button className="icon-btn" title="Reabrir" disabled={pending} onClick={() => setStatus(t, "pendente")}>
                            <Icon name="dashCircle" size={14} />
                          </button>
                        )}
                        {t.status === "pendente" && (
                          <button className="icon-btn" title="Iniciar" disabled={pending} onClick={() => setStatus(t, "em_andamento")}>
                            <Icon name="play" size={14} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          title="Editar"
                          disabled={pending}
                          onClick={() =>
                            setForm({
                              id: t.id,
                              employeeId: t.employeeId,
                              title: t.title,
                              description: t.description,
                              priority: t.priority as TaskPriority,
                              dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
                            })
                          }
                        >
                          <Icon name="more" size={14} />
                        </button>
                        <button className="icon-btn" title="Excluir" disabled={pending} onClick={() => remove(t)}>
                          <Icon name="alert" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {form && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setForm(null)}
        >
          <div className="card card-pad" style={{ width: 460, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>{form.id ? "Editar tarefa" : "Nova tarefa"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input className="input" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
              <textarea className="input" placeholder="Descrição (opcional)" rows={3} style={{ resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="row gap8">
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                  <option value="baixa">Prioridade baixa</option>
                  <option value="media">Prioridade média</option>
                  <option value="alta">Prioridade alta</option>
                </select>
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              {msg && <span style={{ color: "var(--st-risk)", fontSize: 12.5 }}>{msg}</span>}
              <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setForm(null)} disabled={pending}>Cancelar</button>
                <button className="btn btn-primary" onClick={save} disabled={pending || !form.title.trim()}>
                  {pending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
