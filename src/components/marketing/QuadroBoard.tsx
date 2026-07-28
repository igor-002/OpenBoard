"use client";

// Quadro de Demandas do Marketing (Kanban tipo Trello). Colunas próprias (não são
// status do GLPI). Card interno OU linkado a um chamado GLPI. Drag-and-drop nativo
// (desktop), etiquetas coloridas, prazo, anexos. Criar/editar card num modal rico.
import { useState, useTransition, useRef, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  searchGlpiTicketsAction,
  createColumnAction,
  renameColumnAction,
  deleteColumnAction,
  moveColumnAction,
  reorderColumnAction,
  type GlpiHit,
} from "@/app/(marketing)/marketing/quadro/actions";
import { updateStatusAction } from "@/app/(marketing)/marketing/demandas/actions";

// Colunas por status do GLPI (2 e 3 = "Em atendimento") — usadas na visão "Status GLPI".
const GLPI_STATUS_COLS: { key: string; label: string; ids: number[] }[] = [
  { key: "novo", label: "Novo", ids: [1] },
  { key: "atend", label: "Em atendimento", ids: [2, 3] },
  { key: "pendente", label: "Pendente", ids: [4] },
  { key: "solucionado", label: "Solucionado", ids: [5] },
  { key: "fechado", label: "Fechado", ids: [6] },
];
const glpiColOf = (statusId: number) => GLPI_STATUS_COLS.find((c) => c.ids.includes(statusId))?.key ?? "novo";

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
  // Chegou por link de notificação (?card=<id>) → abre o card direto (init lazy, sem efeito).
  const [modal, setModal] = useState<ModalState | null>(() => {
    if (!openCardId) return null;
    const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);
    return card ? { mode: "edit", card } : null;
  });
  // Visão do board: "flow" = fluxo do time (colunas próprias) | "glpi" = agrupado por status GLPI.
  const [boardView, setBoardView] = useState<"flow" | "glpi">("flow");
  // Card sendo arrastado (origem) + posição de inserção ao vivo (coluna + índice na lista exibida).
  const [drag, setDrag] = useState<{ id: string; colId: string; index: number } | null>(null);
  const [over, setOver] = useState<{ colId: string; index: number } | null>(null);
  // Arraste de COLUNA (reordenar): id da coluna arrastada + alvo (antes/depois).
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [colOver, setColOver] = useState<{ id: string; before: boolean } | null>(null);

  // Filtros (client-side): etiquetas selecionadas + responsável GLPI.
  const [fLabels, setFLabels] = useState<Set<string>>(new Set());
  const [fAssignee, setFAssignee] = useState("");
  const assignees = useMemo(() => {
    const s = new Set<string>();
    for (const col of board.columns)
      for (const c of col.cards)
        if (c.glpi?.assignees) for (const a of c.glpi.assignees.split(",").map((x) => x.trim())) if (a) s.add(a);
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [board]);
  const filtering = fLabels.size > 0 || fAssignee !== "";
  function matches(c: CardDTO): boolean {
    const labelOk = fLabels.size === 0 || c.labels.some((l) => fLabels.has(l.id));
    const assigneeOk = !fAssignee || (c.glpi?.assignees ?? "").split(",").map((x) => x.trim()).includes(fAssignee);
    return labelOk && assigneeOk;
  }
  function toggleFLabel(id: string) {
    setFLabels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      const r = await action();
      if (!r.ok) emitToast({ variant: "error", title: "Falha", sub: r.error });
      else if (okMsg) emitToast({ variant: "success", title: okMsg });
      router.refresh();
    });
  }

  // `endIndex` = fim da coluna (fallback quando o cursor não está sobre nenhum card).
  function drop(toColumnId: string, endIndex: number) {
    const d = drag;
    const o = over;
    setDrag(null);
    setOver(null);
    if (!d) return;
    // Índice de inserção na lista exibida (inclui o card arrastado).
    let index = o && o.colId === toColumnId ? o.index : endIndex;
    // moveCard indexa entre os "outros" cards (exclui o arrastado): compensa quando
    // ele sai de uma posição acima do destino na mesma coluna.
    if (d.colId === toColumnId && d.index < index) index -= 1;
    if (d.colId === toColumnId && index === d.index) return; // soltou no mesmo lugar
    // Aviso do movimento (título do card + coluna destino).
    const fromCol = board.columns.find((c) => c.id === d.colId);
    const toCol = board.columns.find((c) => c.id === toColumnId);
    const card = fromCol?.cards.find((c) => c.id === d.id);
    const title = card ? (card.title.length > 40 ? card.title.slice(0, 40) + "…" : card.title) : "Cartão";
    const sameCol = d.colId === toColumnId;
    emitToast({
      variant: "success",
      title: sameCol ? "Cartão reordenado" : "Cartão movido",
      sub: sameCol ? `“${title}” em ${toCol?.name ?? ""}` : `“${title}” → ${toCol?.name ?? ""}`,
    });
    run(() => moveCardAction(d.id, toColumnId, index));
  }

  return (
    <>
      {/* Controles: filtros (etiqueta/responsável) + toggle de visão (fluxo × status GLPI) */}
      <div className="row gap8" style={{ flexWrap: "wrap", alignItems: "center", marginBottom: "var(--gap)" }}>
        {(board.labels.length > 0 || assignees.length > 0) && (
          <>
            <span className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <Icon name="filter" size={13} /> Filtrar
            </span>
            {board.labels.map((l) => {
              const on = fLabels.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggleFLabel(l.id)}
                  style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: l.color, padding: "3px 10px", borderRadius: 999, border: on ? "2px solid var(--ink)" : "2px solid transparent", cursor: "pointer", opacity: on ? 1 : 0.4, transition: "opacity .12s" }}
                >
                  {l.name}
                </button>
              );
            })}
            {assignees.length > 0 && (
              <select className="input" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} style={{ padding: "4px 8px", fontSize: 12.5, width: "auto" }}>
                <option value="">Responsável: todos</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
            {filtering && (
              <button className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => { setFLabels(new Set()); setFAssignee(""); }}>
                Limpar ✕
              </button>
            )}
          </>
        )}
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button className={boardView === "flow" ? "on" : ""} onClick={() => setBoardView("flow")}>
            <Icon name="kanban" size={14} /> Fluxo do time
          </button>
          <button className={boardView === "glpi" ? "on" : ""} onClick={() => setBoardView("glpi")}>
            <Icon name="inbox" size={14} /> Status GLPI
          </button>
        </div>
      </div>

      {boardView === "glpi" ? (
        <GlpiStatusView
          board={board}
          matches={matches}
          filtering={filtering}
          onOpenCard={(card) => setModal({ mode: "edit", card })}
          onWrote={() => router.refresh()}
        />
      ) : (

      <div style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
        {board.columns.map((col, colIdx) => {
          const isOver = over?.colId === col.id && !dragColId;
          const colTarget = dragColId && dragColId !== col.id && colOver?.id === col.id;
          const visibleCount = filtering ? col.cards.filter(matches).length : col.cards.length;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragColId) {
                  const r = e.currentTarget.getBoundingClientRect();
                  const before = e.clientX < r.left + r.width / 2;
                  if (colOver?.id !== col.id || colOver?.before !== before) setColOver({ id: col.id, before });
                  return;
                }
                setOver({ colId: col.id, index: col.cards.length });
              }}
              onDragLeave={(e) => { if (e.currentTarget === e.target && over?.colId === col.id) setOver(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragColId) {
                  const from = dragColId;
                  const co = colOver;
                  setDragColId(null);
                  setColOver(null);
                  if (from !== col.id) {
                    const before = co && co.id === col.id ? co.before : true;
                    emitToast({ variant: "success", title: "Coluna reordenada", sub: col.name });
                    run(() => reorderColumnAction(from, col.id, before));
                  }
                  return;
                }
                drop(col.id, col.cards.length);
              }}
              style={{
                flex: "0 0 292px",
                minWidth: 292,
                background: "var(--surface-2)",
                borderRadius: "var(--r-lg, 12px)",
                border: "1px solid var(--line)",
                outline: isOver ? "2px dashed var(--primary)" : "none",
                outlineOffset: 2,
                boxShadow: colTarget ? (colOver?.before ? "inset 4px 0 0 var(--primary)" : "inset -4px 0 0 var(--primary)") : undefined,
                opacity: dragColId === col.id ? 0.5 : 1,
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 190px)",
              }}
            >
              <ColumnHeader
                name={col.name}
                badge={filtering ? `${visibleCount}/${col.cards.length}` : String(col.cards.length)}
                isFirst={colIdx === 0}
                isLast={colIdx === board.columns.length - 1}
                onRename={(name) => run(() => renameColumnAction(col.id, name), "Coluna renomeada")}
                onMove={(dir) => run(() => moveColumnAction(col.id, dir))}
                onDelete={() => run(() => deleteColumnAction(col.id), "Coluna removida")}
                onDragStart={() => setDragColId(col.id)}
                onDragEnd={() => { setDragColId(null); setColOver(null); }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, overflowY: "auto", flex: 1 }}>
                {col.cards.map((c, i) => {
                  if (filtering && !matches(c)) return null;
                  return (
                    <Fragment key={c.id}>
                      {isOver && over?.index === i && <DropLine />}
                      <CardTile
                        card={c}
                        dragging={drag?.id === c.id}
                        onDragStart={() => setDrag({ id: c.id, colId: col.id, index: i })}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        onOver={(before) => setOver({ colId: col.id, index: before ? i : i + 1 })}
                        onOpen={() => setModal({ mode: "edit", card: c })}
                      />
                    </Fragment>
                  );
                })}
                {isOver && over?.index === col.cards.length && col.cards.length > 0 && <DropLine />}
                {visibleCount === 0 && (
                  <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: "10px 0", opacity: 0.6 }}>{isOver ? "Soltar aqui" : filtering ? "Nada no filtro" : "Sem cartões"}</div>
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
        <AddColumn onCreate={(name) => run(() => createColumnAction(name), "Coluna criada")} />
      </div>
      )}

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

// ── Visão "Status GLPI": mesmos cards, agrupados por status do chamado ─────────
// Só cards vinculados ao GLPI (com espelho). Arrastar entre colunas escreve o
// status no GLPI (updateStatusAction) — override otimista + revert em erro.
// Cards internos ficam na visão "Fluxo do time".
function GlpiStatusView({
  board,
  matches,
  filtering,
  onOpenCard,
  onWrote,
}: {
  board: BoardDTO;
  matches: (c: CardDTO) => boolean;
  filtering: boolean;
  onOpenCard: (card: CardDTO) => void;
  onWrote: () => void;
}) {
  const [pending, start] = useTransition();
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const allCards = board.columns.flatMap((c) => c.cards);
  const glpiCards = allCards.filter((c) => c.kind === "glpi" && c.glpi && c.glpiId != null && (!filtering || matches(c)));
  const internalCount = allCards.filter((c) => c.kind !== "glpi" || !c.glpi).length;

  const effStatus = (c: CardDTO) => overrides[c.glpiId!] ?? c.glpi!.statusId;
  const byCol = new Map<string, CardDTO[]>();
  for (const col of GLPI_STATUS_COLS) byCol.set(col.key, []);
  for (const c of glpiCards) byCol.get(glpiColOf(effStatus(c)))!.push(c);

  function drop(col: (typeof GLPI_STATUS_COLS)[number]) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (id == null) return;
    if (col.key === "novo") return; // "Novo" não é destino válido
    const card = glpiCards.find((c) => c.glpiId === id);
    if (!card) return;
    if (glpiColOf(effStatus(card)) === col.key) return;
    const target = col.ids[0];
    const prev = effStatus(card);
    setOverrides((o) => ({ ...o, [id]: target })); // otimista
    emitToast({ variant: "info", title: `Movendo chamado #${id}…`, sub: `→ ${col.label}` });
    start(async () => {
      const r = await updateStatusAction(id, target);
      if (!r.ok) {
        setOverrides((o) => ({ ...o, [id]: prev }));
        emitToast({ variant: "error", title: `Chamado #${id} — falha ao mover`, sub: r.error });
      } else {
        emitToast({ variant: "success", title: `Chamado #${id} movido`, sub: `agora em ${col.label}` });
        onWrote();
      }
    });
  }

  if (glpiCards.length === 0) {
    return (
      <div className="card card-pad muted">
        Nenhum cartão vinculado ao GLPI{filtering ? " neste filtro" : ""}.
        {internalCount > 0 && ` ${internalCount} cartões internos ficam na visão “Fluxo do time”.`}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", paddingBottom: 12, alignItems: "flex-start", opacity: pending ? 0.75 : 1 }}>
        {GLPI_STATUS_COLS.map((col) => {
          const items = byCol.get(col.key) ?? [];
          const accent = statusColors(col.ids[0]);
          const noDrop = col.key === "novo";
          const isOver = overCol === col.key && !noDrop;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (noDrop) { e.dataTransfer.dropEffect = "none"; return; }
                e.dataTransfer.dropEffect = "move";
                if (overCol !== col.key) setOverCol(col.key);
              }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); drop(col); }}
              style={{ flex: "0 0 280px", minWidth: 280, background: "var(--surface-2)", borderRadius: "var(--r-lg, 12px)", border: "1px solid var(--line)", outline: isOver ? `2px dashed ${accent.color}` : "none", outlineOffset: 2, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 190px)" }}
            >
              <div className="row between" style={{ padding: "11px 13px", borderBottom: `2px solid ${accent.color}` }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{col.label}</span>
                <span className="badge" style={{ color: accent.color, background: accent.bg, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, overflowY: "auto", flex: 1 }}>
                {items.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: "10px 0", opacity: 0.6 }}>{isOver ? "Soltar aqui" : "—"}</div>
                ) : (
                  items.map((c) => (
                    <GlpiStatusCard
                      key={c.id}
                      card={c}
                      dragging={dragId === c.glpiId}
                      onDragStart={() => setDragId(c.glpiId!)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onOpen={() => onOpenCard(c)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        <Icon name="inbox" size={12} /> Arraste um cartão GLPI entre as colunas pra mudar o status no GLPI.
        {internalCount > 0 && ` · ${internalCount} cartões internos ficam na visão “Fluxo do time”.`}
      </p>
    </>
  );
}

function GlpiStatusCard({
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
  const st = card.glpi ? statusColors(card.glpi.statusId) : null;
  const due = dueMeta(card.dueAt);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(card.glpiId)); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="card"
      style={{ padding: 11, paddingLeft: 13, borderLeft: `4px solid ${st?.color ?? "var(--c3)"}`, cursor: "grab", opacity: dragging ? 0.5 : 1, transition: "box-shadow .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md, 0 4px 14px rgba(0,0,0,.12))"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
    >
      {card.labels.length > 0 && (
        <div className="row" style={{ gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
          {card.labels.map((l) => (
            <span key={l.id} title={l.name} style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: l.color, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.3 }}>{l.name}</span>
          ))}
        </div>
      )}
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.35 }}>
        <span className="muted" style={{ fontWeight: 700 }}>#{card.glpiId} · </span>{card.title}
      </div>
      {due && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 7 }}>
          <span className="badge" style={{ fontSize: 10, color: due.color, background: due.bg, fontWeight: 700 }}><Icon name="clock" size={10} /> {due.label}</span>
        </div>
      )}
      {card.glpi?.assignees && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>→ {card.glpi.assignees}</div>}
    </div>
  );
}

// ── Header da coluna: nome + badge + menu (renomear / mover / excluir) ─────────
function ColumnHeader({
  name,
  badge,
  isFirst,
  isLast,
  onRename,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  name: string;
  badge: string;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [val, setVal] = useState(name);

  function commit() {
    const t = val.trim();
    setEditing(false);
    if (t && t !== name) onRename(t);
    else setVal(name);
  }

  if (editing) {
    return (
      <div className="row gap8" style={{ padding: "9px 11px", borderBottom: "1px solid var(--line)" }}>
        <input
          className="input"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(name); setEditing(false); } }}
          onBlur={commit}
          style={{ fontSize: 13, fontWeight: 700, padding: "4px 8px" }}
        />
      </div>
    );
  }

  return (
    <div
      className="row between"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("application/x-column", name); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      style={{ padding: "11px 13px", borderBottom: "1px solid var(--line)", position: "relative", cursor: "grab" }}
      title="Arraste para reordenar a coluna"
    >
      <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)", letterSpacing: 0.2 }}>{name}</span>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--muted)", fontWeight: 800, minWidth: 22, textAlign: "center" }}>{badge}</span>
        <button className="btn btn-ghost" style={{ padding: "2px 6px", lineHeight: 1 }} onClick={() => setMenu((m) => !m)} aria-label="Opções da coluna">
          <Icon name="more" size={16} />
        </button>
      </div>
      {menu && (
        <>
          <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "100%", right: 8, zIndex: 41, background: "var(--surface, #fff)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md, 0 6px 20px rgba(0,0,0,.15))", minWidth: 160, overflow: "hidden" }}>
            <MenuItem label="Renomear" icon="check" onClick={() => { setMenu(false); setVal(name); setEditing(true); }} />
            {!isFirst && <MenuItem label="Mover para esquerda" icon="chevLeft" onClick={() => { setMenu(false); onMove(-1); }} />}
            {!isLast && <MenuItem label="Mover para direita" icon="chevRight" onClick={() => { setMenu(false); onMove(1); }} />}
            <MenuItem label="Excluir coluna" icon="trash" danger onClick={() => { setMenu(false); setConfirming(true); }} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        danger
        title={`Excluir a coluna “${name}”?`}
        message="A coluna precisa estar vazia. Cartões nela impedem a exclusão."
        confirmLabel="Excluir coluna"
        onConfirm={() => { setConfirming(false); onDelete(); }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function MenuItem({ label, icon, onClick, danger }: { label: string; icon: IconName; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="row"
      style={{ width: "100%", gap: 9, padding: "8px 11px", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: danger ? "var(--st-risk)" : "var(--ink)", textAlign: "left" }}
    >
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}

// ── Botão/entrada de "Adicionar coluna" no fim do quadro ───────────────────────
function AddColumn({ onCreate }: { onCreate: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");

  function commit() {
    const t = val.trim();
    if (t) onCreate(t);
    setVal("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        className="btn btn-ghost"
        onClick={() => setAdding(true)}
        style={{ flex: "0 0 220px", minWidth: 220, justifyContent: "flex-start", padding: "11px 13px", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: "var(--r-lg, 12px)", background: "transparent", alignSelf: "flex-start" }}
      >
        <Icon name="plus" size={15} /> Adicionar coluna
      </button>
    );
  }
  return (
    <div style={{ flex: "0 0 260px", minWidth: 260, background: "var(--surface-2)", borderRadius: "var(--r-lg, 12px)", border: "1px solid var(--line)", padding: 10 }}>
      <input
        className="input"
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(""); setAdding(false); } }}
        placeholder="Nome da coluna…"
        style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}
      />
      <div className="row gap8">
        <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={commit} disabled={!val.trim()}>Adicionar</button>
        <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => { setVal(""); setAdding(false); }}>Cancelar</button>
      </div>
    </div>
  );
}

// Linha de inserção mostrada entre cards durante o arraste.
function DropLine() {
  return <div style={{ height: 3, background: "var(--primary)", borderRadius: 2, margin: "-1px 2px", boxShadow: "0 0 0 1px color-mix(in srgb, var(--primary) 40%, transparent)" }} />;
}

// ── Card no quadro ─────────────────────────────────────────────────────────────
function CardTile({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onOver,
  onOpen,
}: {
  card: CardDTO;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOver: (before: boolean) => void;
  onOpen: () => void;
}) {
  const due = dueMeta(card.dueAt);
  const st = card.glpi ? statusColors(card.glpi.statusId) : null;
  // Marcação de card GLPI: faixa colorida na esquerda (cor do status, ou azul GLPI padrão).
  const glpiAccent = card.kind === "glpi" ? st?.color ?? "var(--c3)" : null;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation(); // impede o handler da coluna de sobrescrever com "fim"
        e.dataTransfer.dropEffect = "move";
        const r = e.currentTarget.getBoundingClientRect();
        onOver(e.clientY < r.top + r.height / 2);
      }}
      onClick={onOpen}
      className="card"
      style={{ padding: 11, paddingLeft: glpiAccent ? 13 : 11, borderLeft: glpiAccent ? `4px solid ${glpiAccent}` : undefined, cursor: "grab", opacity: dragging ? 0.5 : 1, transition: "box-shadow .15s, transform .15s" }}
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    <>
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
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label>Chamado GLPI</label>
              <GlpiPicker value={glpiId} onChange={setGlpiId} />
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
                          // eslint-disable-next-line @next/next/no-img-element -- rota autenticada por cookie; o otimizador do next/image busca no servidor e não levaria a sessão
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
              <button className="btn btn-ghost" style={{ color: "var(--st-risk)" }} onClick={() => setConfirmDelete(true)}>
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
    <ConfirmDialog
      open={confirmDelete}
      danger
      title="Excluir este cartão?"
      message={initialCard?.title ? `“${initialCard.title}” será removido do quadro.` : "O cartão será removido do quadro."}
      confirmLabel="Excluir cartão"
      onConfirm={() => { setConfirmDelete(false); if (cardId) run(() => deleteCardAction(cardId)); onClose(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

// ── Autocomplete de chamado GLPI (busca no espelho local) ──────────────────────
// Aceita nº direto (vira glpiId na hora) OU busca por título e escolhe na lista.
function GlpiPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [label, setLabel] = useState(value ? `#${value}` : "");
  const [results, setResults] = useState<GlpiHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(term: string) {
    if (term.trim().length < 2) { setResults([]); return; }
    searchGlpiTicketsAction(term).then((r) => { setResults(r); setOpen(true); }).catch(() => {});
  }
  function onInput(v: string) {
    setLabel(v);
    const t = v.trim();
    const n = Number(t);
    onChange(Number.isInteger(n) && n > 0 ? t : ""); // nº puro linka direto; texto livre só linka ao escolher
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(t), 250);
  }
  function pick(h: GlpiHit) {
    onChange(String(h.id));
    setLabel(`#${h.id} · ${h.name}`);
    setResults([]);
    setOpen(false);
  }
  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={label}
        placeholder="nº ou título do chamado…"
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--surface, #fff)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", marginTop: 4, maxHeight: 220, overflowY: "auto", boxShadow: "var(--shadow-md, 0 6px 20px rgba(0,0,0,.15))" }}>
          {results.map((h) => (
            <button
              key={h.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // evita blur antes do click
              onClick={() => pick(h)}
              className="row"
              style={{ width: "100%", textAlign: "left", gap: 8, padding: "7px 10px", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", alignItems: "center" }}
            >
              <span className="muted" style={{ fontWeight: 700, fontSize: 12, flex: "0 0 auto" }}>#{h.id}</span>
              <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
              {h.statusName && <span className="muted" style={{ fontSize: 10.5, flex: "0 0 auto" }}>{h.statusName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
