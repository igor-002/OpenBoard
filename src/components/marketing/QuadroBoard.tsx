"use client";

// Quadro de Demandas do Marketing (Kanban tipo Trello). Colunas próprias (não são
// status do GLPI). Card interno OU linkado a um chamado GLPI. Drag-and-drop nativo
// (desktop), etiquetas coloridas, prazo. Editor do card num modal.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import { statusColors } from "@/lib/glpi-format";
import type { BoardDTO, CardDTO, LabelDTO } from "@/server/marketing/board";
import {
  createCardAction,
  updateCardAction,
  deleteCardAction,
  moveCardAction,
  setCardLabelsAction,
  createLabelAction,
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

export function QuadroBoard({ board }: { board: BoardDTO }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<CardDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

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
      <div style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {board.columns.map((col) => {
          const isOver = overCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col.id) setOverCol(col.id); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); drop(col.id, col.cards.length); }}
              style={{ flex: "0 0 288px", minWidth: 288, background: "var(--surface-2)", borderRadius: "var(--r-md)", outline: isOver ? "2px dashed var(--primary)" : "none", outlineOffset: 2 }}
            >
              <div className="row between" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{col.name}</span>
                <span className="badge" style={{ background: "var(--surface-3)", color: "var(--muted)", fontWeight: 800 }}>{col.cards.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, minHeight: 24 }}>
                {col.cards.map((c) => (
                  <CardTile
                    key={c.id}
                    card={c}
                    dragging={dragId === c.id}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onOpen={() => setEditing(c)}
                  />
                ))}
                <AddCard onAdd={(title) => run(() => createCardAction({ columnId: col.id, title }))} />
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <CardEditor
          card={editing}
          allLabels={board.labels}
          onClose={() => setEditing(null)}
          run={run}
        />
      )}
    </>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
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
      style={{ padding: 10, cursor: "grab", opacity: dragging ? 0.5 : 1 }}
    >
      {card.labels.length > 0 && (
        <div className="row" style={{ gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
          {card.labels.map((l) => (
            <span key={l.id} title={l.name} style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: l.color, padding: "1px 7px", borderRadius: 999, letterSpacing: 0.3 }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.35 }}>
        {card.kind === "glpi" && card.glpiId != null && <span className="muted" style={{ fontWeight: 700 }}>#{card.glpiId} · </span>}
        {card.title}
      </div>

      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
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
      </div>

      {card.glpi?.assignees && (
        <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>→ {card.glpi.assignees}</div>
      )}
    </div>
  );
}

// ── Adicionar card (inline) ───────────────────────────────────────────────────
function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <button className="btn btn-ghost" style={{ justifyContent: "flex-start", padding: "6px 8px", fontSize: 12.5 }} onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Adicionar cartão
      </button>
    );
  }
  const add = () => {
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle("");
    setOpen(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        className="input"
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
        placeholder="Título do cartão…"
        style={{ resize: "vertical", fontSize: 13 }}
      />
      <div className="row gap8">
        <button className="btn btn-primary" style={{ padding: "5px 12px" }} onClick={add}>Adicionar</button>
        <button className="btn btn-ghost" style={{ padding: "5px 10px" }} onClick={() => { setOpen(false); setTitle(""); }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Editor do card (modal) ────────────────────────────────────────────────────
function CardEditor({
  card,
  allLabels,
  onClose,
  run,
}: {
  card: CardDTO;
  allLabels: LabelDTO[];
  onClose: () => void;
  run: (action: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description ?? "");
  const [due, setDue] = useState(card.dueAt ? card.dueAt.slice(0, 10) : "");
  const [glpiId, setGlpiId] = useState(card.glpiId != null ? String(card.glpiId) : "");
  const [labelIds, setLabelIds] = useState<string[]>(card.labels.map((l) => l.id));
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(LABEL_SWATCHES[0]);

  function toggleLabel(id: string) {
    const next = labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id];
    setLabelIds(next);
    run(() => setCardLabelsAction(card.id, next));
  }

  function save() {
    const gid = glpiId.trim() ? Number(glpiId.trim()) : null;
    run(
      () =>
        updateCardAction(card.id, {
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

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 300, display: "grid", placeItems: "start center", padding: "6vh 16px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 560, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 16, fontWeight: 700 }}
          />
          <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={onClose}><Icon name="chevRight" size={16} /></button>
        </div>

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
                  style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: l.color, padding: "3px 10px", borderRadius: 999, border: "none", cursor: "pointer", opacity: on ? 1 : 0.35 }}
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

        <div className="row between" style={{ marginTop: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--st-risk)" }}
            onClick={() => { run(() => deleteCardAction(card.id)); onClose(); }}
          >
            <Icon name="trash" size={14} /> Excluir
          </button>
          <div className="row gap8">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
