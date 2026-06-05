"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
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
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useOverlayClose } from "@/components/ui/useOverlayClose";
import { Avatar } from "@/components/ui/Avatar";
import { TaskCard } from "./TaskCard";
import { KANBAN_COLS } from "@/lib/meta";
import {
  createTask, moveTask, updateTask, deleteTask,
  addSubtask, toggleSubtask, deleteSubtask, addTaskComment, deleteTaskComment,
} from "@/app/(app)/kanban/actions";
import type { KanbanData, TaskCardData, SubtaskItem, TaskCommentItem } from "@/server/tasks";
import type { TaskColumn, AvatarUser } from "@/lib/types";

type CurrentUser = AvatarUser & { id: string };

export function KanbanBoard({ data, currentUser, isAdmin }: { data: KanbanData; currentUser: CurrentUser; isAdmin: boolean }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskCardData[]>(data.tasks);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskCardData | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // distância de ativação: clique (sem mover) abre o card; mover > 6px arrasta.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Re-sincroniza com o servidor após revalidate/refresh.
  useEffect(() => {
    setTasks(data.tasks);
  }, [data.tasks]);

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const col = e.over ? (String(e.over.id) as TaskColumn) : null;
    if (!col) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.column === col) return;
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, column: col } : x))); // otimista
    startMove(async () => {
      await moveTask(id, col);
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Quadro de tarefas</h1>
          <p className="page-sub">{tasks.length} tarefas · arraste entre as colunas (clique para abrir)</p>
        </div>
        <div className="row gap12">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} />
            Nova tarefa
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, alignItems: "start" }}>
          {KANBAN_COLS.map((col) => {
            const items = tasks.filter((t) => t.column === col.id);
            return (
              <Column key={col.id} id={col.id} label={col.label} color={col.c} count={items.length}>
                {items.map((t) => (
                  <DraggableCard key={t.id} t={t} dimmed={activeId === t.id} onOpen={() => setEditing(t)} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <div style={{ cursor: "grabbing" }}><TaskCard t={activeTask} /></div> : null}</DragOverlay>
      </DndContext>

      {open && <NewTaskModal data={data} onClose={() => { setOpen(false); router.refresh(); }} />}
      {editing && (
        <EditTaskModal
          task={editing}
          members={data.members}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function Column({
  id,
  label,
  color,
  count,
  children,
}: {
  id: string;
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: "var(--surface-3)",
        borderRadius: "var(--r-lg)",
        padding: 12,
        outline: isOver ? "2px dashed var(--primary)" : "2px dashed transparent",
        transition: "outline-color .12s",
      }}
    >
      <div className="row between" style={{ padding: "4px 6px 12px" }}>
        <div className="row gap8">
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
          <b style={{ fontSize: 13.5 }}>{label}</b>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", background: "var(--surface)", padding: "1px 8px", borderRadius: "var(--r-pill)" }}>
            {count}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 40 }}>{children}</div>
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
      style={{ cursor: "grab", opacity: dimmed ? 0.4 : 1, touchAction: "none", outline: "none" }}
    >
      <TaskCard t={t} />
    </div>
  );
}

function NewTaskModal({ data, onClose }: { data: KanbanData; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createTask, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div
      {...useOverlayClose(onClose)}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 460, padding: 24, boxShadow: "var(--sh-lg)" }}
      >
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3 className="card-title" style={{ fontSize: 18 }}>Nova tarefa</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onClose} aria-label="Fechar">
            <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label htmlFor="title">Título</label>
            <input className="input" id="title" name="title" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="projectId">Projeto</label>
            <select className="input" id="projectId" name="projectId" required defaultValue="">
              <option value="" disabled>Selecione…</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="row gap12">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="priority">Prioridade</label>
              <select className="input" id="priority" name="priority" defaultValue="med">
                <option value="high">Alta</option>
                <option value="med">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="column">Coluna</label>
              <select className="input" id="column" name="column" defaultValue="todo">
                {KANBAN_COLS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="assigneeId">Responsável</label>
            <select className="input" id="assigneeId" name="assigneeId" defaultValue="">
              <option value="">Sem responsável</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tags">Tags (separadas por vírgula)</label>
            <input className="input" id="tags" name="tags" placeholder="Design, Mobile" />
          </div>

          {state.error && <div className="form-error">{state.error}</div>}

          <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Criando…" : "Criar tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PRIORITY_OPTS: [string, string][] = [["high", "Alta"], ["med", "Média"], ["low", "Baixa"]];

function EditTaskModal({
  task,
  members,
  currentUser,
  isAdmin,
  onClose,
}: {
  task: TaskCardData;
  members: { id: string; name: string }[];
  currentUser: CurrentUser;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateTask.bind(null, task.id), {});
  const [delPending, startDel] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // checklist + comentários: estado local otimista (servidor sincroniza ao fechar)
  const [subs, setSubs] = useState<SubtaskItem[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");
  const [coms, setComs] = useState<TaskCommentItem[]>(task.commentList);
  const [newCom, setNewCom] = useState("");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  function confirmDelete() {
    startDel(async () => {
      await deleteTask(task.id);
      onClose();
    });
  }

  function addSub() {
    const t = newSub.trim();
    if (!t) return;
    setSubs((p) => [...p, { id: "tmp-" + Date.now(), title: t, done: false }]);
    setNewSub("");
    void addSubtask(task.id, t).then(() => router.refresh());
  }
  function toggleSub(id: string) {
    setSubs((p) => p.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
    void toggleSubtask(id).then(() => router.refresh());
  }
  function delSub(id: string) {
    setSubs((p) => p.filter((s) => s.id !== id));
    void deleteSubtask(id).then(() => router.refresh());
  }
  function addCom() {
    const b = newCom.trim();
    if (!b) return;
    setComs((p) => [...p, { id: "tmp-" + Date.now(), body: b, createdAt: new Date(), authorId: currentUser.id, author: currentUser }]);
    setNewCom("");
    void addTaskComment(task.id, b).then(() => router.refresh());
  }
  function delCom(id: string) {
    setComs((p) => p.filter((c) => c.id !== id));
    void deleteTaskComment(id).then(() => router.refresh());
  }

  const doneCount = subs.filter((s) => s.done).length;

  return (
    <Modal title="Tarefa" onClose={onClose} maxWidth={500}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 14 }}>{task.projectName}</div>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input className="input" id="title" name="title" defaultValue={task.title} required autoFocus />
        </div>
        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="priority">Prioridade</label>
            <select className="input" id="priority" name="priority" defaultValue={task.priority}>
              {PRIORITY_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="column">Coluna</label>
            <select className="input" id="column" name="column" defaultValue={task.column}>
              {KANBAN_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="assigneeId">Responsável</label>
            <select className="input" id="assigneeId" name="assigneeId" defaultValue={task.assigneeId ?? ""}>
              <option value="">Sem responsável</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 160 }}>
            <label htmlFor="dueDate">Prazo</label>
            <input className="input" id="dueDate" name="dueDate" type="date" defaultValue={task.dueIso ?? ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="tags">Tags (separadas por vírgula)</label>
          <input className="input" id="tags" name="tags" defaultValue={task.tags.join(", ")} />
        </div>

        {state.error && <div className="form-error">{state.error}</div>}

        <div className="row between" style={{ marginTop: 4 }}>
          <button type="button" className="btn" style={{ color: "var(--st-risk)" }} onClick={() => setConfirming(true)} disabled={delPending}>
            <Icon name="alert" size={15} />
            Excluir
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>

      {/* Checklist (subtarefas) */}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 16 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h4 className="card-title" style={{ fontSize: 14 }}>Checklist</h4>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{doneCount}/{subs.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {subs.map((s) => (
            <div key={s.id} className="row gap8" style={{ alignItems: "center" }}>
              <input type="checkbox" checked={s.done} onChange={() => toggleSub(s.id)} />
              <span style={{ flex: 1, fontSize: 13.5, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--muted)" : "var(--ink-2)" }}>{s.title}</span>
              <button type="button" onClick={() => delSub(s.id)} title="Remover" style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer" }}>
                <Icon name="plus" size={14} style={{ transform: "rotate(45deg)" }} />
              </button>
            </div>
          ))}
        </div>
        <div className="row gap8">
          <input className="input" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} placeholder="Adicionar item…" style={{ flex: 1, padding: "8px 10px" }} />
          <button type="button" className="btn" onClick={addSub} style={{ padding: "8px 12px" }}>Add</button>
        </div>
      </div>

      {/* Comentários (thread) */}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
        <h4 className="card-title" style={{ fontSize: 14, marginBottom: 10 }}>Comentários</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {coms.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sem comentários.</div>}
          {coms.map((c) => (
            <div key={c.id} className="row gap8" style={{ alignItems: "flex-start" }}>
              <Avatar user={c.author} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between">
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{c.author.name}<span className="muted" style={{ fontWeight: 500 }}> · {new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
                  {(c.authorId === currentUser.id || isAdmin) && (
                    <button type="button" onClick={() => delCom(c.id)} title="Excluir" style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer" }}>
                      <Icon name="plus" size={13} style={{ transform: "rotate(45deg)" }} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="row gap8">
          <input className="input" value={newCom} onChange={(e) => setNewCom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCom(); } }} placeholder="Escrever comentário…" style={{ flex: 1, padding: "8px 10px" }} />
          <button type="button" className="btn btn-primary" onClick={addCom} style={{ padding: "8px 12px" }}>Enviar</button>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          danger
          title="Excluir tarefa?"
          confirmLabel="Excluir"
          pending={delPending}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(false)}
          message={<>A tarefa <b style={{ color: "var(--ink)" }}>{task.title}</b> será removida. Esta ação não pode ser desfeita.</>}
        />
      )}
    </Modal>
  );
}
