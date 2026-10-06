"use client";

import { useTransition, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAbrirDemanda } from "@/components/demanda/PainelDemanda";
import { emitToast } from "@/lib/toast";
import { ORIGEM_META } from "@/lib/meta";
import { atribuirDemandaAction, mudarStatusAction } from "@/app/(app)/demandas/actions";
import type { Priority, TaskColumn, TaskOrigin } from "@/lib/types";

// Cartão de demanda da tela Hoje. O texto de apoio (`meta`) vem pronto do servidor:
// ele depende do relógio, e calcular no client daria diferença na hidratação.
export function LinhaTarefa({
  id,
  numero,
  title,
  column,
  priority,
  origem,
  assigneeId,
  meta,
  membros,
  // "despachar" mostra o seletor de responsável; "andar" mostra iniciar/resolver.
  acao,
  vivo = false,
}: {
  id: string;
  numero: number;
  title: string;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  assigneeId: string | null;
  meta: ReactNode;
  membros: { id: string; name: string }[];
  acao: "despachar" | "andar" | "nenhuma";
  vivo?: boolean;
}) {
  const [pending, start] = useTransition();
  const abrir = useAbrirDemanda();
  const om = ORIGEM_META[origem];

  function roda(fn: () => Promise<{ ok: boolean; error?: string }>, feito: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) emitToast({ variant: "success", title: feito });
      else emitToast({ variant: "error", title: r.error ?? "Não deu certo." });
    });
  }

  return (
    <div className="hj-linha">
      {vivo && <span className="hj-vivo" title="Em atendimento" />}
      <button type="button" className="hj-linha-corpo" onClick={() => abrir(numero)} title={`Abrir demanda #${numero}`}>
        <span className="hj-linha-titulo">{title}</span>
        <span className="hj-linha-meta">
          <span className="dl-num">#{numero}</span>
          {priority === "high" && <span className="hj-chip cor-vermelho">Urgente</span>}
          <span className="hj-chip" style={{ color: om.c, background: om.bg }}>
            {om.label}
          </span>
          {meta}
        </span>
      </button>
      <div className="hj-acoes">
        {acao === "despachar" && (
          <select
            className="hj-select"
            value={assigneeId ?? ""}
            disabled={pending}
            aria-label={`Responsável pela demanda ${numero}`}
            onChange={(e) => {
              const novo = e.target.value || null;
              const nome = membros.find((m) => m.id === novo)?.name;
              roda(() => atribuirDemandaAction(id, novo), nome ? `#${numero} passada para ${nome}` : `#${numero} ficou sem dono`);
            }}
          >
            <option value="">Passar para…</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {acao === "andar" && column === "todo" && (
          <button className="hj-btn" disabled={pending} onClick={() => roda(() => mudarStatusAction(id, "doing"), `#${numero} em atendimento`)}>
            <Icon name="play" size={12} />
            Iniciar
          </button>
        )}
        {/* Resolver pede a solução: abre o painel já na pergunta. */}
        {acao === "andar" && column !== "todo" && (
          <button className="hj-btn feito" onClick={() => abrir(numero, "done")}>
            <Icon name="check" size={13} />
            Resolver
          </button>
        )}
      </div>
    </div>
  );
}
