"use client";

import { useActionState, useEffect, useState } from "react";
import type { ProjectActionState } from "@/app/(app)/projects/actions";
import type { ProjectEdit } from "@/server/projects";

type Action = (prev: ProjectActionState, formData: FormData) => Promise<ProjectActionState>;

const STATUS_OPTS: [string, string][] = [
  ["planned", "Planejado"],
  ["progress", "Em andamento"],
  ["review", "Em revisão"],
  ["done", "Concluído"],
];

export function ProjectForm({
  action,
  users,
  initial,
  submitLabel,
  onDone,
}: {
  action: Action;
  users: { id: string; name: string }[];
  initial?: ProjectEdit;
  submitLabel: string;
  onDone: (id?: string) => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Sem prazo = projeto sem dueDate (mostra contador de dias em aberto).
  const [noDue, setNoDue] = useState(initial ? !initial.dueDate : false);

  useEffect(() => {
    if (state.ok) onDone(state.id);
  }, [state.ok, state.id, onDone]);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field">
        <label htmlFor="name">Nome do projeto</label>
        <input className="input" id="name" name="name" defaultValue={initial?.name} required autoFocus />
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="client">Cliente</label>
          <input className="input" id="client" name="client" defaultValue={initial?.client} required />
        </div>
        <div className="field" style={{ width: 150 }}>
          <label htmlFor="tag">Categoria</label>
          <input className="input" id="tag" name="tag" defaultValue={initial?.tag} placeholder="Web, Infra…" required />
        </div>
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={initial?.status ?? "planned"}>
            {STATUS_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="field" style={{ width: 110 }}>
          <label htmlFor="progress">Progresso %</label>
          <input className="input" id="progress" name="progress" type="number" min={0} max={100} defaultValue={initial?.progress ?? 0} />
        </div>
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="startDate">Início</label>
          <input className="input" id="startDate" name="startDate" type="date" defaultValue={initial?.startDate} required />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="dueDate">Prazo</label>
          {/* desabilitado não envia no formData -> vira "sem prazo" no servidor */}
          <input
            className="input"
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={initial?.dueDate || undefined}
            disabled={noDue}
            required={!noDue}
            style={noDue ? { opacity: 0.5 } : undefined}
          />
        </div>
      </div>
      <label className="row gap8" style={{ fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" checked={noDue} onChange={(e) => setNoDue(e.target.checked)} />
        Sem prazo (acompanhar por dias em aberto)
      </label>

      <div className="field">
        <label>Equipe</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 160, overflowY: "auto", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: 10 }}>
          {users.map((u) => (
            <label key={u.id} className="row gap8" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <input type="checkbox" name="memberIds" value={u.id} defaultChecked={initial?.memberIds.includes(u.id)} />
              {u.name}
            </label>
          ))}
        </div>
      </div>

      <label className="row gap8" style={{ fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" name="risk" defaultChecked={initial?.risk} />
        Marcar como “em risco”
      </label>

      {state.error && <div className="form-error">{state.error}</div>}

      <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
