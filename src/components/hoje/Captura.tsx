"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import { criarDemandaAction } from "@/app/(app)/demandas/actions";
import { ORIGEM_META, ORIGENS } from "@/lib/meta";
import type { TaskOrigin } from "@/lib/types";

// Registro em uma linha: digita, Enter, pronto. Os controles ao lado guardam a
// última escolha, porque várias demandas seguidas costumam vir do mesmo jeito.
export function Captura({ membros, meId }: { membros: { id: string; name: string }[]; meId: string }) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [origem, setOrigem] = useState<TaskOrigin>("whatsapp");
  const [urgente, setUrgente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const possoReceber = membros.some((m) => m.id === meId);

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setErro(null);
    start(async () => {
      const r = await criarDemandaAction({ title, assigneeId: assigneeId || null, origem, priority: urgente ? "high" : "med" });
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível registrar.");
        return;
      }
      const para = membros.find((m) => m.id === assigneeId)?.name;
      const dono = para ? `Passada para ${para}` : "Ficou em Sem dono";
      emitToast({ variant: "success", title: `Demanda #${r.numero} aberta`, sub: r.chamado ? `${dono} · chamado #${r.chamado} no GLPI` : dono });
      if (r.aviso) emitToast({ variant: "error", title: "Demanda aberta, mas sem chamado no GLPI", sub: r.aviso });
      setTitle("");
      setUrgente(false);
      campo.current?.focus();
    });
  }

  return (
    <form className="hj-captura" onSubmit={registrar}>
      <span className="hj-captura-mais">
        <Icon name="plus" size={18} />
      </span>
      <input
        ref={campo}
        className="hj-captura-texto"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="O que apareceu? Escreva e aperte Enter"
        aria-label="Nova demanda"
        maxLength={200}
        autoFocus
      />
      <select className="hj-select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Responsável">
        <option value="">Sem dono</option>
        {possoReceber && <option value={meId}>Para mim</option>}
        {membros
          .filter((m) => m.id !== meId)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
      </select>
      <select className="hj-select" value={origem} onChange={(e) => setOrigem(e.target.value as TaskOrigin)} aria-label="Como chegou">
        {ORIGENS.map((o) => (
          <option key={o} value={o}>
            {ORIGEM_META[o].label}
          </option>
        ))}
      </select>
      <button type="button" className="hj-flag" aria-pressed={urgente} onClick={() => setUrgente((v) => !v)}>
        <Icon name="flag" size={14} />
        Urgente
      </button>
      <button type="submit" className="btn btn-primary" disabled={pending || title.trim().length < 2}>
        {pending ? "Registrando…" : "Registrar"}
      </button>
      {erro && (
        <div className="hj-erro" role="alert">
          {erro}
        </div>
      )}
    </form>
  );
}
