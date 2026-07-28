"use client";

// Quadro de Demandas do Marketing (Kanban tipo Trello). Colunas próprias (não são
// status do GLPI). Card interno OU linkado a um chamado GLPI. Drag-and-drop nativo
// (desktop), etiquetas coloridas, prazo, anexos. Criar/editar card num modal rico.
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import { statusColors } from "@/lib/glpi-format";
import type { BoardDTO, CardDTO, LabelDTO, AttachmentDTO } from "@/server/marketing/board";
import {
  createCardAction,
  updateCardAction,
  deleteCardAction,
  moveCardAction,
  setCardLabelsAction,
  createLabelAction,
  uploadAttachmentAction,
  deleteAttachmentAction,
} from "@/app/(marketing)/marketing/quadro/actions";

const LABEL_SWATCHES = ["#f59e0b", "#f2691f", "#e5484d", "#16a34a", "#0d9488", "#2d6ff2", "#7a5ae0", "#db2777", "#6b7280"];

// Badge do prazo: vermelho vencido, âmbar ≤2 dias, neutro além.
function dueMeta(dueAt: string | null): { label: string; color: string; bg: string } | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (isNaN(d.getTime())) return null;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(d) - dia(new Date())) / 86400000);
  const label = dias < 0 ? `Venceu há ${Math.abs(dias)}d` : dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias}d`;
  const color = dias < 0 ? "var(--st-risk)" : dias <= 2 ? "var(--pr-med)" : "var(--muted)";
  const bg = dias < 0 ? "var(--st-risk-bg)" : dias <= 2 ? "var(--pr-med-bg)" : "var(--surface-3)";
  return { label, color, bg };
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type ModalState = { mode: "create"; columnId: string } | { mode: "edit"; card: CardDTO };

export function QuadroBoard({ board, openCardId = null }: { board: BoardDTO; openCardId?: string | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Chegou por link de notificação (?card=<id>) → abre o card direto.
  useEffect(() => {
    if (!openCardId) return;
    const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);
    if (card) setModal({ mode: "edit", card });
  }, [openCardId, board]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      const r = await action();
      if (!r.ok) emitToast({ variant: "error", title: "Falha", sub: r.error });
      else if (okMsg) emitToast({ variant: "success", title: okMsg });
      router.refresh();
    });
  }

  function drop(toColumnId: string, toIndex: number) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    run(() => moveCardAction(id, toColumnId, toIndex));
  }

  return (
    <>
      <div style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
        {board.columns.map((col) => {
          const isOver = overCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col.id) setOverCol(col.id); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); drop(col.id, col.cards.length); }}
              style={{
                flex: "0 0 292px",
                minWidth: 292,
                background: "var(--surface-2)",
                borderRadius: "var(--r-lg, 12px)",
                border: "1px solid var(--line)",
                outline: isOver ? "2px dashed var(--primary)" : "none",
                outlineOffset: 2,
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 190px)",
              }}
            >
              <div className="row between" style={{ padding: "11px 13px", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)", letterSpacing: 0.2 }}>{col.name}</span>
                <span className="badge" style={{ background: "var(--surface-3)", color: "var(--muted)", fontWeight: 800, minWidth: 22, textAlign: "center" }}>{col.cards.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, overflowY: "auto", flex: 1 }}>
                {col.cards.map((c) => (
                  <CardTile
                    key={c.id}
                    card={c}
                    dragging={dragId === c.id}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onOpen={() => setModal({ mode: "edit", card: c })}
                  />
                ))}
                {col.cards.length === 0 && (
                  <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: "10px 0", opacity: 0.6 }}>Sem cartões</div>
                )}
              </div>

              <button
                className="btn btn-ghost"
                onClick={() => setModal({ mode: "create", columnId: col.id })}
                style={{ justifyContent: "flex-start", padding: "9px 12px", fontSize: 12.5, fontWeight: 700, borderTop: "1px solid var(--line)", borderRadius: 0, color: "var(--muted)" }}
              >
                <Icon name="plus" size={15} /> Adicionar cartão
              </button>
            </div>
          );
        })}
      </div>

      {modal && (
        <CardModal
          key={modal.mode === "edit" ? modal.card.id : "new-" + modal.columnId}
          init={modal}
          allLabels={board.labels}
          onClose={() => setModal(null)}
          run={run}
          refresh={() => router.refresh()}
        />
      )}
    </>
  );
}

// ── Card no quadro ─────────────────────────────────────────────────────────────
function CardTile({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  card: CardDTO;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const due = dueMeta(card.dueAt);
  const st = card.glpi ? statusColors(card.glpi.statusId) : null;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="card"
      style={{ padding: 11, cursor: "grab", opacity: dragging ? 0.5 : 1, transition: "box-shadow .15s, transform .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md, 0 4px 14px rgba(0,0,0,.12))"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
    >
      {card.labels.length > 0 && (
        <div className="row" style={{ gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
          {card.labels.map((l) => (
            <span key={l.id} title={l.name} style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: l.color, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.3 }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.35 }}>
        {card.kind === "glpi" && card.glpiId != null && <span className="muted" style={{ fontWeight: 700 }}>#{card.glpiId} · </span>}
        {card.title}
      </div>

      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
        {card.kind === "glpi" && (
          <span className="badge" style={{ fontSize: 10, color: "var(--c3)", background: "color-mix(in srgb, var(--c3) 12%, transparent)", fontWeight: 700 }}>
            <Icon name="inbox" size={10} /> GLPI
          </span>
        )}
        {st && card.glpi && (
          <span className="badge" style={{ fontSize: 10, color: st.color, background: st.bg }}>{card.glpi.statusName || "—"}</span>
        )}
        {due && (
          <span className="badge" style={{ fontSize: 10, color: due.color, background: due.bg, fontWeight: 700 }}>
            <Icon name="clock" size={10} /> {due.label}
          </span>
        )}
        {card.attachments.length > 0 && (
          <span className="badge" style={{ fontSize: 10, color: "var(--muted)", background: "var(--surface-3)", fontWeight: 700 }}>
            <Icon name="paperclip" size={10} /> {card.attachments.length}
          </span>
        )}
        {card.description && (
          <span title="Tem descrição" className="badge" style={{ fontSize: 10, color: "var(--muted)", background: "var(--surface-3)" }}>
            <Icon name="sidebar" size={10} />
          </span>
        )}
      </div>

      {card.glpi?.assignees && (
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>→ {card.glpi.assignees}</div>
      )}
    </div>
  );
}

// ── Modal de criar/editar card ─────────────────────────────────────────────────
function CardModal({
  init,
  allLabels,
  onClose,
  run,
  refresh,
}: {
  init: ModalState;
  allLabels: LabelDTO[];
  onClose: () => void;
  run: (action: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void;
  refresh: () => void;
}) {
  // Em create: `saved` começa null e vira o card real após "Criar" (aí libera anexos).
  const initialCard = init.mode === "edit" ? init.card : null;
  const columnId = init.mode === "create" ? init.columnId : "";
  const [saved, setSaved] = useState<CardDTO | null>(initialCard);
  const cardId = saved?.id ?? null;

  const [title, setTitle] = useState(initialCard?.title ?? "");
  const [desc, setDesc] = useState(initialCard?.description ?? "");
  const [due, setDue] = useState(initialCard?.dueAt ? initialCard.dueAt.slice(0, 10) : "");
  const [glpiId, setGlpiId] = useState(initialCard?.glpiId != null ? String(initialCard.glpiId) : "");
  const [labelIds, setLabelIds] = useState<string[]>(initialCard?.labels.map((l) => l.id) ?? []);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>(initialCard?.attachments ?? []);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(LABEL_SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isCreate = !cardId;

  function toggleLabel(id: string) {
    const next = labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id];
    setLabelIds(next);
    if (cardId) run(() => setCardLabelsAction(cardId, next)); // em create só guarda local
  }

  async function create() {
    const t = title.trim();
    if (!t) { emitToast({ variant: "error", title: "Informe o título" }); return; }
    setBusy(true);
    const gid = glpiId.trim() ? Number(glpiId.trim()) : null;
    const kind = gid && Number.isInteger(gid) ? "glpi" : "interna";
    const r = await createCardAction({
      columnId,
      title: t,
      description: desc || null,
      dueAt: due || null,
      glpiId: kind === "glpi" ? gid : null,
      kind,
      labelIds,
    });
    setBusy(false);
    if (!r.ok || !r.id) { emitToast({ variant: "error", title: "Falha", sub: r.error }); return; }
    emitToast({ variant: "success", title: "Cartão criado" });
    // Vira "edit" para permitir anexos, sem fechar o modal.
    setSaved({
      id: r.id,
      title: t,
      description: desc || null,
      kind,
      glpiId: kind === "glpi" ? gid : null,
      dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : null,
      order: 0,
      labels: allLabels.filter((l) => labelIds.includes(l.id)),
      attachments: [],
      glpi: null,
    });
    refresh();
  }

  function save() {
    if (!cardId) return;
    const gid = glpiId.trim() ? Number(glpiId.trim()) : null;
    run(
      () =>
        updateCardAction(cardId, {
          title,
          description: desc,
          dueAt: due || null,
          glpiId: gid && Number.isInteger(gid) ? gid : null,
          kind: gid && Number.isInteger(gid) ? "glpi" : "interna",
        }),
      "Cartão salvo",
    );
    onClose();
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || !cardId) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("cardId", cardId);
      form.set("file", file);
      const r = await uploadAttachmentAction(form);
      if (!r.ok || !r.attachment) emitToast({ variant: "error", title: "Falha no anexo", sub: r.error });
      else setAttachments((prev) => [...prev, r.attachment!]);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    run(() => deleteAttachmentAction(id));
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)", zIndex: 300, display: "grid", placeItems: "start center", padding: "6vh 16px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 580, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                {isCreate ? "Novo cartão" : "Editar cartão"}
              </div>
              <input
                className="input"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do cartão…"
                style={{ fontSize: 16, fontWeight: 700 }}
              />
            </div>
            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 20, lineHeight: 1 }} onClick={onClose} aria-label="Fechar">×</button>
          </div>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Etiquetas */}
          <div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Etiquetas</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {allLabels.map((l) => {
                const on = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: l.color, padding: "3px 10px", borderRadius: 999, border: "none", cursor: "pointer", opacity: on ? 1 : 0.35, transition: "opacity .12s" }}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
            <div className="row gap8" style={{ marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className="input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nova etiqueta" style={{ flex: "1 1 140px", fontSize: 12.5, padding: "5px 8px" }} />
              <div className="row" style={{ gap: 4 }}>
                {LABEL_SWATCHES.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} title={c} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: newColor === c ? "2px solid var(--ink)" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: "5px 10px" }}
                disabled={!newLabel.trim()}
                onClick={() => { run(() => createLabelAction(newLabel.trim(), newColor)); setNewLabel(""); }}
              >
                <Icon name="plus" size={13} /> Criar
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Descrição</div>
            <textarea className="input" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalhes da demanda…" style={{ resize: "vertical" }} />
          </div>

          {/* Prazo + GLPI */}
          <div className="row gap12" style={{ flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label>Prazo</label>
              <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label>Chamado GLPI (nº)</label>
              <input className="input" inputMode="numeric" value={glpiId} onChange={(e) => setGlpiId(e.target.value)} placeholder="ex.: 36130" />
            </div>
          </div>

          {/* Anexos */}
          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Anexos</div>
              <span className="muted" style={{ fontSize: 10.5 }}>máx. 20 MB</span>
            </div>
            {isCreate ? (
              <div className="muted" style={{ fontSize: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "10px 12px", border: "1px dashed var(--line)" }}>
                Crie o cartão para anexar arquivos.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {attachments.map((a) => {
                  const img = a.mime.startsWith("image/");
                  return (
                    <div key={a.id} className="row between" style={{ gap: 8, background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "7px 10px", border: "1px solid var(--line)" }}>
                      <a href={`/marketing/quadro/anexo/${a.id}`} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 9, minWidth: 0, flex: 1, textDecoration: "none", color: "var(--ink)" }}>
                        {img ? (
                          <img src={`/marketing/quadro/anexo/${a.id}`} alt="" style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6, flex: "0 0 auto" }} />
                        ) : (
                          <span style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--surface-3)", borderRadius: 6, flex: "0 0 auto", color: "var(--muted)" }}><Icon name="paperclip" size={15} /></span>
                        )}
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.filename}</span>
                          <span className="muted" style={{ fontSize: 11 }}>{fmtSize(a.size)}</span>
                        </span>
                      </a>
                      <button className="btn btn-ghost" style={{ padding: "3px 7px", color: "var(--st-risk)" }} onClick={() => removeAttachment(a.id)} aria-label="Remover anexo"><Icon name="trash" size={14} /></button>
                    </div>
                  );
                })}
                <input ref={fileRef} type="file" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
                <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "8px 10px", border: "1px dashed var(--line)" }} disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Icon name="paperclip" size={14} /> {busy ? "Enviando…" : "Anexar arquivo"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="row between" style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--surface-2)" }}>
          {isCreate ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy || !title.trim()} onClick={create}>
                <Icon name="plus" size={14} /> Criar cartão
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ color: "var(--st-risk)" }} onClick={() => { run(() => deleteCardAction(cardId!)); onClose(); }}>
                <Icon name="trash" size={14} /> Excluir
              </button>
              <div className="row gap8">
                <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
                <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Salvar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
