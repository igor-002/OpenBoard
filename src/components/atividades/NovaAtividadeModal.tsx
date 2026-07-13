"use client";

// Modal de criação de atividade (avulsa/presencial/planejada), com tipo,
// cliente, estimativa e descrição inicial (vira 1ª atualização da timeline).
import { useEffect, useActionState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ClientePicker } from "./ClientePicker";
import { createAtividade } from "@/app/(app)/atividades/actions";
import { ORIGEM_META } from "@/lib/meta";
import type { TaskOrigin } from "@/lib/types";

const ORIGENS: TaskOrigin[] = ["avulsa", "presencial", "planejada"];

export function NovaAtividadeModal({
  tipos,
  members,
  projects,
  currentUserId,
  onClose,
}: {
  tipos: { id: string; name: string }[];
  members: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createAtividade, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="Nova atividade" onClose={onClose} maxWidth={520}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="at-title">Título</label>
          <input className="input" id="at-title" name="title" placeholder="Ex.: Configuração de hotspot" required autoFocus />
        </div>

        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="at-tipo">Tipo</label>
            <select className="input" id="at-tipo" name="tipoId" required defaultValue="">
              <option value="" disabled>Selecione…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="at-origem">Origem</label>
            <select className="input" id="at-origem" name="origem" defaultValue="avulsa">
              {ORIGENS.map((o) => (
                <option key={o} value={o}>{ORIGEM_META[o].label}</option>
              ))}
            </select>
          </div>
        </div>

        <ClientePicker />

        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="at-assignee">Responsável</label>
            <select className="input" id="at-assignee" name="assigneeId" defaultValue={currentUserId}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="at-priority">Prioridade</label>
            <select className="input" id="at-priority" name="priority" defaultValue="med">
              <option value="high">Alta</option>
              <option value="med">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="at-status">Status inicial</label>
            <select className="input" id="at-status" name="column" defaultValue="todo">
              <option value="todo">A fazer</option>
              <option value="doing">Em progresso (já estou executando)</option>
            </select>
          </div>
          <div className="field" style={{ width: 130 }}>
            <label htmlFor="at-est">Estimativa (min)</label>
            <input className="input" id="at-est" name="estimatedMinutes" type="number" min={1} placeholder="60" />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label htmlFor="at-due">Prazo</label>
            <input className="input" id="at-due" name="dueDate" type="date" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="at-desc">Descrição inicial (opcional — entra na linha do tempo)</label>
          <textarea className="input" id="at-desc" name="descricao" rows={3} placeholder="Contexto da demanda, quem pediu, o que foi combinado…" style={{ resize: "vertical" }} />
        </div>

        <div className="field">
          <label htmlFor="at-project">Projeto (opcional)</label>
          <select className="input" id="at-project" name="projectId" defaultValue="">
            <option value="">Sem projeto (atividade avulsa)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {state.error && <div className="form-error">{state.error}</div>}

        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Registrando…" : "Registrar atividade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
