"use client";

// Detalhe da atividade: meta, status (mesmo fluxo do kanban), linha do tempo de
// atualizações (TaskComment) e relato final de execução ao concluir.
import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { PriorityBadge } from "@/components/ui/Badge";
import { KANBAN_COLS, ORIGEM_META } from "@/lib/meta";
import { moveTask, addTaskComment, deleteTaskComment } from "@/app/(app)/kanban/actions";
import { concludeAtividade, updateReport, editAtividade, deleteAtividade, opcoesAtividadeAction, type OpcoesAtividade } from "@/app/(app)/atividades/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { emitToast } from "@/lib/toast";
import type { AtividadeRow, AtividadeComment } from "@/server/atividades";
import type { TaskColumn, AvatarUser } from "@/lib/types";

type CurrentUser = AvatarUser & { id: string };

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtMin(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function AtividadeDetailModal({
  atividade: a,
  currentUser,
  isAdmin,
  onClose,
}: {
  atividade: AtividadeRow;
  currentUser: CurrentUser;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [column, setColumn] = useState<TaskColumn>(a.column);
  const [concluding, setConcluding] = useState(false);
  const [editingReport, setEditingReport] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesAtividade>({ tipos: [], projetos: [], usuarios: [] });
  const [, startMove] = useTransition();

  // Carrega tipos/projetos/pessoas só quando entra em edição.
  function abrirEdicao() {
    setEditando(true);
    if (!opcoes.tipos.length) void opcoesAtividadeAction().then(setOpcoes);
  }

  function excluir() {
    setConfirmarExclusao(false);
    void deleteAtividade(a.id).then((r) => {
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra excluir", sub: r.error });
      emitToast({ variant: "success", title: "Atividade excluída", sub: a.title });
      onClose();
      router.refresh();
    });
  }

  // Timeline otimista (mesmo padrão do EditTaskModal do kanban).
  const [coms, setComs] = useState<AtividadeComment[]>(a.comments);
  const [newCom, setNewCom] = useState("");

  function changeColumn(col: TaskColumn) {
    if (col === column) return;
    if (col === "done") {
      // Concluir exige relato — abre o form em vez de mover direto.
      setConcluding(true);
      return;
    }
    setColumn(col);
    startMove(async () => {
      await moveTask(a.id, col);
      router.refresh();
    });
  }

  function addUpdate() {
    const b = newCom.trim();
    if (!b) return;
    setComs((p) => [...p, { id: "tmp-" + Date.now(), body: b, createdAt: new Date(), authorId: currentUser.id, author: currentUser }]);
    setNewCom("");
    void addTaskComment(a.id, b).then(() => router.refresh());
  }
  function delUpdate(id: string) {
    setComs((p) => p.filter((c) => c.id !== id));
    void deleteTaskComment(id).then(() => router.refresh());
  }

  const om = ORIGEM_META[a.origem];
  const colMeta = KANBAN_COLS.find((c) => c.id === column);
  const emAndamentoMin = a.startedAt && !a.doneAt ? Math.max(0, Math.round((Date.now() - +new Date(a.startedAt)) / 60000)) : null;

  return (
    <Modal title="Atividade" onClose={onClose} maxWidth={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            <span className="badge" style={{ color: om.c, background: om.bg }}>{om.label}</span>
            {a.tipoName && <span className="badge" style={{ color: "var(--muted)", background: "var(--surface-3)" }}>{a.tipoName}</span>}
            <PriorityBadge pr={a.priority} />
            {colMeta && (
              <span className="badge" style={{ color: colMeta.c, background: "var(--surface-3)" }}>
                <span className="bdot" style={{ background: colMeta.c }} />
                {colMeta.label}
              </span>
            )}
          </div>
          <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, flex: 1 }}>{a.title}</div>
            {!editando && !concluding && (
              <div className="row gap8" style={{ flex: "0 0 auto" }}>
                <button type="button" className="btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={abrirEdicao}>
                  <Icon name="edit" size={13} /> Editar
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "3px 10px", fontSize: 12, color: "var(--st-risk)" }}
                  onClick={() => setConfirmarExclusao(true)}
                >
                  <Icon name="trash" size={13} /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        {editando && (
          <EditForm
            atividade={a}
            opcoes={opcoes}
            onCancel={() => setEditando(false)}
            onSaved={() => {
              setEditando(false);
              router.refresh();
            }}
          />
        )}

        {/* Meta */}
        <div className="card" style={{ padding: 14, background: "var(--surface-3)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
          <div><span className="muted">Cliente:</span> <b>{a.clienteRazao ?? "— (interna)"}</b>{a.clienteIxcId && <span className="muted"> · IXC {a.clienteIxcId}</span>}</div>
          <div><span className="muted">Projeto:</span> <b>{a.projectName ?? "Avulsa (sem projeto)"}</b></div>
          <div><span className="muted">Responsável:</span> <b>{a.assignee?.name ?? "—"}</b></div>
          <div><span className="muted">Criada:</span> <b>{fmtDateTime(a.createdAt)}</b></div>
          <div><span className="muted">Início:</span> <b>{a.startedAt ? fmtDateTime(a.startedAt) : "—"}</b></div>
          <div><span className="muted">Conclusão:</span> <b>{a.doneAt ? fmtDateTime(a.doneAt) : "—"}</b></div>
          <div><span className="muted">Estimado:</span> <b>{a.estimatedMinutes ? fmtMin(a.estimatedMinutes) : "—"}</b></div>
          <div>
            <span className="muted">Tempo real:</span>{" "}
            <b>
              {a.realMinutes != null ? fmtMin(a.realMinutes) : emAndamentoMin != null ? `${fmtMin(emAndamentoMin)} (em andamento)` : "—"}
            </b>
          </div>
        </div>

        {/* Status */}
        {!concluding && (
          <div className="field">
            <label htmlFor="at-col">Status</label>
            <select className="input" id="at-col" value={column} onChange={(e) => changeColumn(e.target.value as TaskColumn)}>
              {KANBAN_COLS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Concluir com relato */}
        {concluding && (
          <ConcludeForm
            taskId={a.id}
            initialReport={a.report ?? ""}
            onDone={() => { setConcluding(false); setColumn("done"); router.refresh(); }}
            onCancel={() => setConcluding(false)}
          />
        )}

        {/* Relato final (quando já concluída) */}
        {!concluding && a.report && !editingReport && (
          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>Relato de execução</h4>
              <button type="button" className="btn" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setEditingReport(true)}>Editar</button>
            </div>
            <div className="card" style={{ padding: 12, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "var(--surface-3)" }}>{a.report}</div>
          </div>
        )}
        {editingReport && (
          <ReportEditor
            taskId={a.id}
            initial={a.report ?? ""}
            onSaved={() => { setEditingReport(false); router.refresh(); }}
            onCancel={() => setEditingReport(false)}
          />
        )}

        {/* Linha do tempo de atualizações */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h4 className="card-title" style={{ fontSize: 14, marginBottom: 10 }}>Atualizações</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
            {coms.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sem atualizações ainda.</div>}
            {coms.map((c) => (
              <div key={c.id} className="row gap8" style={{ alignItems: "flex-start" }}>
                <Avatar user={c.author} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between">
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {c.author.name}
                      <span className="muted" style={{ fontWeight: 500 }}> · {fmtDateTime(c.createdAt)}</span>
                    </span>
                    {(c.authorId === currentUser.id || isAdmin) && (
                      <button type="button" onClick={() => delUpdate(c.id)} title="Excluir" style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer" }}>
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
            <input
              className="input"
              value={newCom}
              onChange={(e) => setNewCom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUpdate(); } }}
              placeholder="Registrar atualização (o que aconteceu, próximo passo…)"
              style={{ flex: 1, padding: "8px 10px" }}
            />
            <button type="button" className="btn btn-primary" onClick={addUpdate} style={{ padding: "8px 12px" }}>Registrar</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmarExclusao}
        danger
        title="Excluir esta atividade?"
        message={`“${a.title}” sai do quadro, dos relatórios e do histórico. Não dá pra desfazer.`}
        confirmLabel="Excluir atividade"
        onConfirm={excluir}
        onCancel={() => setConfirmarExclusao(false)}
      />
    </Modal>
  );
}

function ConcludeForm({ taskId, initialReport, onDone, onCancel }: { taskId: string; initialReport: string; onDone: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(concludeAtividade.bind(null, taskId), {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="card" style={{ padding: 14, background: "var(--surface-3)", display: "flex", flexDirection: "column", gap: 10 }}>
      <b style={{ fontSize: 13.5 }}>Concluir atividade — relato de execução</b>
      <textarea
        className="input"
        name="report"
        rows={4}
        defaultValue={initialReport}
        placeholder="O que foi feito? Ex.: realizei suporte pro cliente X, identifiquei tal problema, resolvi assim…"
        style={{ resize: "vertical" }}
        autoFocus
        required
      />
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="row gap8" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel}>Voltar</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Concluindo…" : "Concluir"}
        </button>
      </div>
    </form>
  );
}

function ReportEditor({ taskId, initial, onSaved, onCancel }: { taskId: string; initial: string; onSaved: () => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateReport(taskId, text);
      if (res.ok) onSaved();
      else setError(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <div className="card" style={{ padding: 14, background: "var(--surface-3)", display: "flex", flexDirection: "column", gap: 10 }}>
      <b style={{ fontSize: 13.5 }}>Editar relato de execução</b>
      <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical" }} autoFocus />
      {error && <div className="form-error">{error}</div>}
      <div className="row gap8" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// Edição da atividade. Campo em branco = limpa (projeto, cliente, prazo). O
// "tempo real" só aparece em atividade concluída: ele reposiciona o início pra
// que fim − início bata com o informado, que é como o sistema mede duração.
function EditForm({
  atividade: a,
  opcoes,
  onCancel,
  onSaved,
}: {
  atividade: AtividadeRow;
  opcoes: OpcoesAtividade;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(a.title);
  const [tipoId, setTipoId] = useState(a.tipoId ?? "");
  const [priority, setPriority] = useState(a.priority);
  const [origem, setOrigem] = useState(a.origem);
  const [projectId, setProjectId] = useState(a.projectId ?? "");
  const [assigneeId, setAssigneeId] = useState(a.assigneeId ?? "");
  const [estimado, setEstimado] = useState(a.estimatedMinutes ? String(a.estimatedMinutes) : "");
  const [real, setReal] = useState(a.realMinutes != null ? String(a.realMinutes) : "");
  const [dueDate, setDueDate] = useState(a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : "");
  const [salvando, setSalvando] = useState(false);

  function salvar() {
    setSalvando(true);
    void editAtividade(a.id, {
      title,
      tipoId: tipoId || undefined,
      priority,
      origem,
      projectId: projectId || null,
      assigneeId: assigneeId || undefined,
      estimatedMinutes: estimado ? Number(estimado) : null,
      realMinutes: a.doneAt && real ? Number(real) : undefined,
      dueDate: dueDate || null,
    }).then((r) => {
      setSalvando(false);
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra salvar", sub: r.error });
      emitToast({ variant: "success", title: "Atividade atualizada" });
      onSaved();
    });
  }

  return (
    <div className="card" style={{ padding: 14, background: "var(--surface-3)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="field">
        <label>Título</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Tipo</label>
          <select className="input" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            {opcoes.tipos.length === 0 && <option value="">carregando…</option>}
            {opcoes.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Prioridade</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            <option value="high">Alta</option>
            <option value="med">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div className="field">
          <label>Origem</label>
          <select className="input" value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            <option value="planejada">Planejada</option>
            <option value="avulsa">Avulsa</option>
            <option value="presencial">Presencial</option>
          </select>
        </div>
        <div className="field">
          <label>Responsável</label>
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {opcoes.usuarios.length === 0 && <option value="">carregando…</option>}
            {opcoes.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Projeto</label>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Avulsa (sem projeto)</option>
          {opcoes.projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: a.doneAt ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Estimado (min)</label>
          <input className="input" type="number" min={1} value={estimado} onChange={(e) => setEstimado(e.target.value)} placeholder="—" />
        </div>
        {a.doneAt && (
          <div className="field">
            <label>Tempo real (min)</label>
            <input className="input" type="number" min={1} value={real} onChange={(e) => setReal(e.target.value)} placeholder="—" />
          </div>
        )}
        <div className="field">
          <label>Prazo</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="row gap8" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || !title.trim()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
