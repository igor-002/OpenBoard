"use client";

// Quadro de demandas: arrastar muda o status, clicar abre o painel de detalhe.
// Resolver e Aguardando pedem texto (solução / motivo), então soltar nessas
// colunas abre o painel já na pergunta em vez de mover calado.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NovaDemandaModal } from "@/components/demanda/NovaDemandaModal";
import { useAbrirDemanda } from "@/components/demanda/PainelDemanda";
import { emitToast } from "@/lib/toast";
import { dayLabel } from "@/lib/format";
import { KANBAN_COLS, DIAS_CONCLUIDA_QUADRO, ORIGEM_META, isAtrasada } from "@/lib/meta";
import { mudarStatusAction } from "@/app/(app)/demandas/actions";
import type { KanbanData, TaskCardData } from "@/server/tasks";
import type { TaskColumn } from "@/lib/types";

export function KanbanBoard({ data }: { data: KanbanData }) {
  const router = useRouter();
  const abrir = useAbrirDemanda();
  // Movimento otimista: coluna que o cartão "já tem" enquanto o servidor responde.
  // Derivar de data.tasks (em vez de copiar pro estado) mantém o quadro sempre
  // igual ao servidor assim que o refresh chega.
  const [movendo, setMovendo] = useState<Record<string, TaskColumn>>({});
  const tasks = data.tasks.map((t) => (movendo[t.id] ? { ...t, column: movendo[t.id] } : t));
  const [dono, setDono] = useState(""); // filtro: id, "nenhum" ou vazio
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // distância de ativação: clique (sem mover) abre o cartão; mover > 6px arrasta.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const col = e.over ? (String(e.over.id) as TaskColumn) : null;
    const t = tasks.find((x) => x.id === id);
    if (!col || !t || t.column === col) return;
    if (col === "done" || col === "waiting") return abrir(t.numero, col);

    setMovendo((m) => ({ ...m, [id]: col }));
    startMove(async () => {
      const r = await mudarStatusAction(id, col);
      if (!r.ok) emitToast({ variant: "error", title: r.error });
      router.refresh();
      // Com erro o cartão volta sozinho; com sucesso o servidor já traz a coluna nova.
      setMovendo((m) => {
        const { [id]: _feito, ...resto } = m;
        void _feito;
        return resto;
      });
    });
  }

  const visiveis = tasks.filter((t) => (dono === "" ? true : dono === "nenhum" ? !t.assigneeId : t.assigneeId === dono));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Quadro de demandas</h1>
          <p className="page-sub">
            Arraste para mudar o status, clique para abrir.
            {data.antigas > 0 && (
              <>
                {" "}
                Resolvidas há mais de {DIAS_CONCLUIDA_QUADRO} dias ficam{" "}
                <Link href="/atividades?status=done" className="dm-link">
                  na lista ({data.antigas})
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <div className="row gap12">
          <select className="hj-select" value={dono} onChange={(e) => setDono(e.target.value)} aria-label="Filtrar por responsável">
            <option value="">Todos os responsáveis</option>
            <option value="nenhum">Sem dono</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} />
            Nova demanda
          </button>
        </div>
      </div>

      <DndContext id="quadro-tarefas" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="qd-colunas">
          {KANBAN_COLS.map((col) => {
            const items = visiveis.filter((t) => t.column === col.id);
            return (
              <Column key={col.id} id={col.id} label={col.label} color={col.c} count={items.length}>
                {items.map((t) => (
                  <DraggableCard key={t.id} t={t} dimmed={activeId === t.id} onOpen={() => abrir(t.numero)} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <div style={{ cursor: "grabbing" }}><Cartao t={activeTask} /></div> : null}</DragOverlay>
      </DndContext>

      {open && (
        <NovaDemandaModal
          tipos={data.tipos}
          members={data.members}
          projects={data.projects}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Column({ id, label, color, count, children }: { id: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="hj-grupo qd-coluna" data-sobre={isOver || undefined}>
      <div className="hj-grupo-topo">
        <span className="hj-pilula" style={{ color, background: "var(--surface)" }}>
          <i />
          {label} <b>{count}</b>
        </span>
      </div>
      <div className="qd-cartoes">{children}</div>
    </div>
  );
}

function DraggableCard({ t, dimmed, onOpen }: { t: TaskCardData; dimmed: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      style={{ cursor: "grab", opacity: dimmed ? 0.4 : 1, touchAction: "none" }}
    >
      <Cartao t={t} />
    </div>
  );
}

function Cartao({ t }: { t: TaskCardData }) {
  const om = ORIGEM_META[t.origem];
  const atrasada = isAtrasada(t.column, t.dueDate);
  return (
    <div className="qd-cartao">
      <div className="hj-linha-meta" style={{ marginTop: 0 }}>
        <span className="dl-num">#{t.numero}</span>
        {t.priority === "high" && <span className="hj-chip cor-vermelho">Alta</span>}
        <span className="hj-chip" style={{ color: om.c, background: om.bg }}>
          {om.label}
        </span>
      </div>
      <div className="qd-titulo">{t.title}</div>
      {(t.solicitante || t.projectName) && <div className="dl-sub">{[t.solicitante, t.projectName].filter(Boolean).join(" · ")}</div>}
      {t.column === "waiting" && t.waitingReason && <div className="dm-nota cor-ambar" style={{ margin: "8px 0 0" }}>{t.waitingReason}</div>}
      <div className="qd-rodape">
        <div className="hj-linha-meta" style={{ marginTop: 0 }}>
          {t.subTotal > 0 && (
            <span className="row" style={{ gap: 4 }}>
              <Icon name="checkCircle" size={13} />
              {t.subDone}/{t.subTotal}
            </span>
          )}
          {t.comments > 0 && (
            <span className="row" style={{ gap: 4 }}>
              <Icon name="msg" size={13} />
              {t.comments}
            </span>
          )}
          {t.dueDate && (
            <span className={`row ${atrasada ? "risco" : ""}`} style={{ gap: 4 }}>
              <Icon name="calendar" size={13} />
              {dayLabel(t.dueDate)}
            </span>
          )}
        </div>
        {t.assignee ? <Avatar user={t.assignee} size={24} ring={false} /> : <span className="hj-chip cor-laranja">Sem dono</span>}
      </div>
    </div>
  );
}
