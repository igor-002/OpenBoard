"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { Icon } from "@/components/ui/Icon";
import { useOverlayClose } from "@/components/ui/useOverlayClose";
import { brl } from "@/lib/format";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import type { LeadsBoard as LeadsBoardData, LeadCard } from "@/server/comercial/leads";
import { createLeadManual, moveLeadStage, assignLead, deleteLead } from "@/app/(comercial)/comercial/leads/actions";

type UserOpt = { id: string; name: string };

export function LeadsBoard({ board, userOpts, isAdmin }: { board: LeadsBoardData; userOpts: UserOpt[]; isAdmin: boolean }) {
  const router = useRouter();
  // estado local otimista por estágio
  const [cardsByStage, setCardsByStage] = useState<Record<string, LeadCard[]>>(() =>
    Object.fromEntries(board.stages.map((s) => [s.id, s.cards])),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<LeadCard | null>(null);
  const [, startMove] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setCardsByStage(Object.fromEntries(board.stages.map((s) => [s.id, s.cards])));
  }, [board]);

  const allCards = Object.values(cardsByStage).flat();
  const activeCard = allCards.find((c) => c.id === activeId) ?? null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const dest = e.over ? (String(e.over.id) as LeadStage) : null;
    if (!dest) return;
    const card = allCards.find((c) => c.id === id);
    if (!card || card.stage === dest) return;
    // otimista: tira da origem, põe no destino
    setCardsByStage((prev) => {
      const next: Record<string, LeadCard[]> = {};
      for (const [k, list] of Object.entries(prev)) next[k] = list.filter((c) => c.id !== id);
      next[dest] = [...(next[dest] ?? []), { ...card, stage: dest }];
      return next;
    });
    startMove(async () => { await moveLeadStage(id, dest); router.refresh(); });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-sub">{board.total} leads no funil · arraste entre os estágios (clique p/ abrir)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Novo lead</button>
      </div>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEAD_STAGES.length},minmax(220px,1fr))`, gap: 14, alignItems: "start", overflowX: "auto", paddingBottom: 8 }}>
          {LEAD_STAGES.map((s) => {
            const items = cardsByStage[s.id] ?? [];
            const valor = items.reduce((a, c) => a + c.valorEstimadoCents, 0);
            return (
              <Column key={s.id} id={s.id} label={s.label} color={s.c} count={items.length} valorCents={valor}>
                {items.map((c) => <DraggableCard key={c.id} c={c} dimmed={activeId === c.id} onOpen={() => setDetail(c)} />)}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeCard ? <div style={{ cursor: "grabbing" }}><CardBody c={activeCard} /></div> : null}</DragOverlay>
      </DndContext>

      {open && <NewLeadModal onClose={() => { setOpen(false); router.refresh(); }} />}
      {detail && <LeadDetailModal lead={detail} userOpts={userOpts} isAdmin={isAdmin} onClose={() => { setDetail(null); router.refresh(); }} />}
    </>
  );
}

function Column({ id, label, color, count, valorCents, children }: { id: string; label: string; color: string; count: number; valorCents: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ background: "var(--surface-3)", borderRadius: "var(--r-lg)", padding: 12, outline: isOver ? "2px dashed var(--primary)" : "2px dashed transparent", transition: "outline-color .12s" }}>
      <div className="row between" style={{ padding: "4px 6px 12px" }}>
        <div className="row gap8" style={{ alignItems: "center" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
          <b style={{ fontSize: 13.5 }}>{label}</b>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", background: "var(--surface)", padding: "1px 8px", borderRadius: "var(--r-pill)" }}>{count}</span>
        </div>
        {valorCents > 0 && <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{brl(valorCents)}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 40 }}>{children}</div>
    </div>
  );
}

function DraggableCard({ c, dimmed, onOpen }: { c: LeadCard; dimmed: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} style={{ cursor: "grab", opacity: dimmed ? 0.4 : 1, touchAction: "none", outline: "none" }}>
      <CardBody c={c} />
    </div>
  );
}

function CardBody({ c }: { c: LeadCard }) {
  return (
    <div className="card" style={{ padding: 12, boxShadow: "none", border: "1px solid var(--line)" }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{c.nome}</div>
      {c.empresa && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.empresa}</div>}
      <div className="row gap8" style={{ marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {c.valorEstimadoCents > 0 && <span style={{ fontWeight: 800, fontSize: 13 }}>{brl(c.valorEstimadoCents)}</span>}
        {c.origem && <span className="badge" style={{ color: "var(--muted)", background: "var(--surface-3)", fontSize: 10.5 }}>{c.origem}</span>}
        {c.ixcClienteId && <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)", fontSize: 10.5 }}>cliente</span>}
      </div>
      {(c.contato || c.assignedUserName) && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contato ?? ""}</span>
          {c.assignedUserName && <span style={{ flexShrink: 0 }}>{c.assignedUserName}</span>}
        </div>
      )}
    </div>
  );
}

function NewLeadModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createLeadManual, {});
  useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);
  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 460, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3 className="card-title" style={{ fontSize: 18 }}>Novo lead</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onClose} aria-label="Fechar"><Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field"><label htmlFor="nome">Nome*</label><input className="input" id="nome" name="nome" required autoFocus /></div>
          <div className="field"><label htmlFor="empresa">Empresa</label><input className="input" id="empresa" name="empresa" /></div>
          <div className="row gap12">
            <div className="field" style={{ flex: 1 }}><label htmlFor="cnpjCpf">CNPJ / CPF</label><input className="input" id="cnpjCpf" name="cnpjCpf" /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="contato">Contato</label><input className="input" id="contato" name="contato" placeholder="telefone/whatsapp" /></div>
          </div>
          <div className="row gap12">
            <div className="field" style={{ flex: 1 }}><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" /></div>
            <div className="field" style={{ width: 130 }}><label htmlFor="valor">Valor est. (R$)</label><input className="input" id="valor" name="valor" type="number" min="0" step="0.01" /></div>
          </div>
          <div className="field"><label htmlFor="observacoes">Observações</label><input className="input" id="observacoes" name="observacoes" /></div>
          {state.error && <div className="form-error">{state.error}</div>}
          {state.ok && state.created === false && <div className="muted" style={{ fontSize: 12 }}>Lead já existia (casado por {state.matchedBy}) — registramos o novo contato.</div>}
          <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Salvando…" : "Criar lead"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeadDetailModal({ lead, userOpts, isAdmin, onClose }: { lead: LeadCard; userOpts: UserOpt[]; isAdmin: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [assigned, setAssigned] = useState(lead.assignedUserId ?? "");
  function changeAssign(v: string) { setAssigned(v); start(async () => { await assignLead(lead.id, v || null); router.refresh(); }); }
  function remove() { start(async () => { await deleteLead(lead.id); onClose(); }); }
  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 460, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 className="card-title" style={{ fontSize: 18 }}>{lead.nome}</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onClose} aria-label="Fechar"><Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        {lead.empresa && <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{lead.empresa}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13.5, marginBottom: 16 }}>
          {lead.cnpjCpf && <><span className="muted">CNPJ/CPF</span><span>{lead.cnpjCpf}</span></>}
          {lead.contato && <><span className="muted">Contato</span><span>{lead.contato}</span></>}
          {lead.email && <><span className="muted">E-mail</span><span>{lead.email}</span></>}
          {lead.origem && <><span className="muted">Origem</span><span>{lead.origem}</span></>}
          {lead.valorEstimadoCents > 0 && <><span className="muted">Valor est.</span><span style={{ fontWeight: 700 }}>{brl(lead.valorEstimadoCents)}</span></>}
          <span className="muted">Último contato</span><span>{new Date(lead.lastContactAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {lead.ixcClienteId && <Link href={`/comercial/clientes/${lead.ixcClienteId}`} className="btn btn-ghost" style={{ marginBottom: 14 }}>Ver cliente 360 <Icon name="chevRight" size={14} /></Link>}
        {lead.observacoes && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Observações / histórico</label>
            <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap", background: "var(--surface-3)", borderRadius: "var(--r-md)", padding: 10, maxHeight: 160, overflowY: "auto" }}>{lead.observacoes}</div>
          </div>
        )}
        <div className="field">
          <label htmlFor="assignee">Responsável</label>
          <select className="input" id="assignee" value={assigned} onChange={(e) => changeAssign(e.target.value)} disabled={pending}>
            <option value="">Sem responsável</option>
            {userOpts.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="row between" style={{ marginTop: 18 }}>
          {isAdmin ? <button className="btn" style={{ color: "var(--st-risk)" }} onClick={remove} disabled={pending}><Icon name="alert" size={15} /> Excluir</button> : <span />}
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
