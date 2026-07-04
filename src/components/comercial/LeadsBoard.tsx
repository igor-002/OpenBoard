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
import { createLeadManual, moveLeadStage, assignLead, deleteLead, updateLeadValor } from "@/app/(comercial)/comercial/leads/actions";

type UserOpt = { id: string; name: string };

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}
// cor estável por nome (hue) pro avatar do responsável
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return dd < 30 ? `${dd}d` : `${Math.floor(dd / 30)}mês`;
}

// Lead "parado": há mais de 7 dias na mesma fila (só estágios ativos).
function isStale(c: LeadCard): boolean {
  if (c.stage === "ganho" || c.stage === "perdido") return false;
  return Date.now() - new Date(c.stageChangedAt).getTime() > 7 * 86_400_000;
}

// Tempo na fila atual + tom de alerta (verde <2d, âmbar 2–7d, vermelho >7d).
// Ganho/perdido não alertam — são estágios finais.
function stageAge(c: LeadCard): { label: string; fg: string; bg: string; stale: boolean } {
  const days = (Date.now() - new Date(c.stageChangedAt).getTime()) / 86_400_000;
  const closed = c.stage === "ganho" || c.stage === "perdido";
  const label = timeAgo(c.stageChangedAt);
  if (closed || days <= 2) return { label, fg: "var(--muted)", bg: "var(--surface-3)", stale: false };
  if (days <= 7) return { label, fg: "var(--pr-med)", bg: "var(--pr-med-bg)", stale: false };
  return { label, fg: "var(--st-risk)", bg: "var(--st-risk-bg)", stale: true };
}

type View = "kanban" | "lista" | "finalizados";

export function LeadsBoard({ board, userOpts, isAdmin }: { board: LeadsBoardData; userOpts: UserOpt[]; isAdmin: boolean }) {
  const router = useRouter();
  // estado local otimista por estágio
  const [cardsByStage, setCardsByStage] = useState<Record<string, LeadCard[]>>(() =>
    Object.fromEntries(board.stages.map((s) => [s.id, s.cards])),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<LeadCard | null>(null);
  const [view, setView] = useState<View>("kanban");
  const [dense, setDense] = useState(false);
  const [q, setQ] = useState("");
  const [fUser, setFUser] = useState("");
  const [, startMove] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // re-sincroniza o estado otimista quando o server manda um board novo
  // (padrão "adjust state during render" — evita o efeito com setState síncrono)
  const [prevBoard, setPrevBoard] = useState(board);
  if (prevBoard !== board) {
    setPrevBoard(board);
    setCardsByStage(Object.fromEntries(board.stages.map((s) => [s.id, s.cards])));
  }

  const allCards = Object.values(cardsByStage).flat();
  const activeCard = allCards.find((c) => c.id === activeId) ?? null;

  // filtro (busca + responsável) aplicado em ambas as views
  const term = q.trim().toLowerCase();
  const matches = (c: LeadCard) => {
    if (fUser && c.assignedUserId !== fUser) return false;
    if (!term) return true;
    return [c.nome, c.empresa, c.contato, c.email, c.cnpjCpf, c.origem].some((v) => (v ?? "").toLowerCase().includes(term));
  };
  const filteredByStage: Record<string, LeadCard[]> = Object.fromEntries(
    Object.entries(cardsByStage).map(([k, list]) => [k, list.filter(matches)]),
  );
  const filteredFlat = allCards.filter(matches);
  const shownTotal = filteredFlat.length;
  const filtering = !!term || !!fUser;
  const finalizados = filteredFlat.filter((c) => c.finalizadoAt != null);
  const finalizadosCount = allCards.filter((c) => c.finalizadoAt != null).length;

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
          <p className="page-sub">
            {filtering ? `${shownTotal} de ${board.total} leads` : `${board.total} leads no funil`}
            {view === "kanban" ? " · arraste entre os estágios (clique p/ abrir)" : " · clique numa linha p/ abrir"}
          </p>
        </div>
        <div className="row gap12">
          <Link href="/comercial/leads/relatorios" className="btn"><Icon name="chart" size={15} /> Relatórios</Link>
          <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Novo lead</button>
        </div>
      </div>

      <FunnelSummary cards={allCards} />

      {/* Toolbar: busca + filtro responsável + toggle de visão */}
      <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
          <Icon name="search" size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", pointerEvents: "none" }} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, empresa, contato…" style={{ paddingLeft: 36 }} />
        </div>
        <select className="input" value={fUser} onChange={(e) => setFUser(e.target.value)} style={{ width: "auto", minWidth: 170 }}>
          <option value="">Todos responsáveis</option>
          {userOpts.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="row" style={{ marginLeft: "auto", gap: 12, alignItems: "center" }}>
          {view === "kanban" && (
            <button className="btn" onClick={() => setDense((d) => !d)} title={dense ? "Cards confortáveis" : "Cards compactos"}>
              <Icon name={dense ? "grid" : "kanban"} size={15} /> {dense ? "Confortável" : "Compacto"}
            </button>
          )}
          <div style={{ display: "inline-flex", background: "var(--surface-3)", borderRadius: "var(--r-sm)", padding: 3, gap: 2 }}>
            <ViewBtn active={view === "kanban"} onClick={() => setView("kanban")} icon="kanban" label="Kanban" />
            <ViewBtn active={view === "lista"} onClick={() => setView("lista")} icon="grid" label="Lista" />
            <ViewBtn active={view === "finalizados"} onClick={() => setView("finalizados")} icon="checkCircle" label={`Finalizados${finalizadosCount > 0 ? ` (${finalizadosCount})` : ""}`} />
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        <DndContext id="leads-board" sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEAD_STAGES.length},minmax(280px,1fr))`, gap: 16, alignItems: "start", overflowX: "auto", paddingBottom: 12 }}>
            {LEAD_STAGES.map((s) => {
              const items = filteredByStage[s.id] ?? [];
              const valor = items.reduce((a, c) => a + c.valorEstimadoCents, 0);
              const paradosCol = items.filter(isStale).length;
              return (
                <Column key={s.id} id={s.id} label={s.label} color={s.c} count={items.length} valorCents={valor} parados={paradosCol} dense={dense}>
                  {items.map((c) => <DraggableCard key={c.id} c={c} color={s.c} dense={dense} dimmed={activeId === c.id} onOpen={() => setDetail(c)} />)}
                </Column>
              );
            })}
          </div>
          <DragOverlay>{activeCard ? <div style={{ cursor: "grabbing", width: 280 }}><CardBody c={activeCard} color={LEAD_STAGES.find((s) => s.id === activeCard.stage)?.c ?? "var(--muted)"} dense={dense} /></div> : null}</DragOverlay>
        </DndContext>
      ) : view === "lista" ? (
        <LeadsTable cards={filteredFlat} onOpen={(c) => setDetail(c)} />
      ) : (
        <FinalizadosTable cards={finalizados} isAdmin={isAdmin} onOpen={(c) => setDetail(c)} />
      )}

      {open && <NewLeadModal onClose={() => { setOpen(false); router.refresh(); }} />}
      {detail && <LeadDetailModal lead={detail} userOpts={userOpts} isAdmin={isAdmin} onClose={() => { setDetail(null); router.refresh(); }} />}
    </>
  );
}

// Resumo do funil: barra de distribuição por estágio + indicadores rápidos.
// Só dado real derivado dos cards (nada estimado).
function FunnelSummary({ cards }: { cards: LeadCard[] }) {
  if (!cards.length) return null;
  const ativos = cards.filter((c) => c.stage !== "ganho" && c.stage !== "perdido");
  const valorAberto = ativos.reduce((a, c) => a + c.valorEstimadoCents, 0);
  const parados = ativos.filter(isStale).length;
  const ganhos = cards.filter((c) => c.stage === "ganho").length;
  const segs = LEAD_STAGES.map((s) => ({ ...s, n: cards.filter((c) => c.stage === s.id).length })).filter((s) => s.n > 0);
  return (
    <div className="card" style={{ padding: "14px 18px", marginBottom: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 28px" }}>
      <div style={{ flex: "1 1 340px", minWidth: 260 }}>
        <div style={{ display: "flex", height: 12, borderRadius: "var(--r-pill)", overflow: "hidden", gap: 2, background: "var(--surface-3)" }}>
          {segs.map((s) => (
            <div key={s.id} title={`${s.label}: ${s.n}`} style={{ flex: `${s.n} 0 auto`, minWidth: 10, background: s.c }} />
          ))}
        </div>
        <div className="row" style={{ gap: "4px 14px", marginTop: 8, flexWrap: "wrap" }}>
          {segs.map((s) => (
            <span key={s.id} className="row gap8" style={{ alignItems: "center", fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.c }} />{s.label} <b style={{ color: "var(--ink)" }}>{s.n}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
        <MiniStat label="Em aberto" value={brl(valorAberto)} c="var(--ink)" />
        <MiniStat label="Ativos" value={String(ativos.length)} c="var(--st-progress)" />
        <MiniStat label="Ganhos" value={String(ganhos)} c="var(--st-done)" />
        <MiniStat label="Parados +7d" value={String(parados)} c={parados > 0 ? "var(--st-risk)" : "var(--muted)"} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, c }: { label: string; value: string; c: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: c, letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: "kanban" | "grid" | "checkCircle"; label: string }) {
  return (
    <button onClick={onClick} className="row gap8" style={{
      alignItems: "center", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
      padding: "6px 14px", borderRadius: "var(--r-xs)",
      background: active ? "var(--surface)" : "transparent",
      color: active ? "var(--ink)" : "var(--muted)",
      boxShadow: active ? "var(--sh-sm)" : "none",
    }}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

// ── Visão Lista (tabela densa — boa pra alto volume) ─────────────────────────
function LeadsTable({ cards, onOpen }: { cards: LeadCard[]; onOpen: (c: LeadCard) => void }) {
  const rows = [...cards].sort((a, b) => new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime());
  const th: React.CSSProperties = { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: 13.5, borderTop: "1px solid var(--line)", verticalAlign: "middle" };
  if (!rows.length) return <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nenhum lead encontrado.</div>;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-3)" }}>
              <th style={th}>Lead</th>
              <th style={th}>Estágio</th>
              <th style={{ ...th, textAlign: "right" }}>Na fila</th>
              <th style={{ ...th, textAlign: "right" }}>Valor est.</th>
              <th style={th}>Origem</th>
              <th style={th}>Responsável</th>
              <th style={th}>Contato</th>
              <th style={{ ...th, textAlign: "right" }}>Últ. contato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const st = LEAD_STAGES.find((s) => s.id === c.stage);
              const fila = stageAge(c);
              return (
                <tr key={c.id} onClick={() => onOpen(c)} style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.empresa && <div className="muted" style={{ fontSize: 12 }}>{c.empresa}</div>}
                  </td>
                  <td style={td}>
                    <span className="row gap8" style={{ alignItems: "center", fontSize: 12.5, fontWeight: 700, color: st?.c ?? "var(--muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st?.c ?? "var(--muted)" }} />{st?.label ?? c.stage}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: fila.fg, background: fila.bg, padding: "3px 9px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>{fila.label}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{c.valorEstimadoCents > 0 ? brl(c.valorEstimadoCents) : <span className="muted">—</span>}</td>
                  <td style={td}>{c.origem ? <span className="badge" style={{ color: "var(--muted)", background: "var(--surface-3)", fontSize: 11 }}>{c.origem}</span> : <span className="muted">—</span>}</td>
                  <td style={td}>
                    {c.assignedUserName ? (
                      <span className="row gap8" style={{ alignItems: "center" }}>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColor(c.assignedUserName), color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center" }}>{initials(c.assignedUserName)}</span>
                        <span style={{ fontSize: 13 }}>{c.assignedUserName}</span>
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td style={{ ...td, color: "var(--ink-2)" }}>{c.contato ?? <span className="muted">—</span>}</td>
                  <td style={{ ...td, textAlign: "right", color: "var(--muted)", whiteSpace: "nowrap" }}>{timeAgo(c.lastContactAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aba Finalizados: atendimentos encerrados no AtendAI — triagem e limpeza ──
function FinalizadosTable({ cards, isAdmin, onOpen }: { cards: LeadCard[]; isAdmin: boolean; onOpen: (c: LeadCard) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const rows = [...cards].sort((a, b) => new Date(b.finalizadoAt!).getTime() - new Date(a.finalizadoAt!).getTime());
  const th: React.CSSProperties = { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "12px 14px", fontSize: 13.5, borderTop: "1px solid var(--line)", verticalAlign: "middle" };
  function remove(id: string) {
    start(async () => { await deleteLead(id); setConfirmId(null); router.refresh(); });
  }
  if (!rows.length) {
    return <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nenhum atendimento finalizado ainda. Quando o AtendAI encerrar uma conversa, o lead aparece aqui com o histórico completo.</div>;
  }
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-3)" }}>
              <th style={th}>Lead</th>
              <th style={th}>Fila atual</th>
              <th style={{ ...th, textAlign: "right" }}>Finalizado em</th>
              <th style={{ ...th, textAlign: "right" }}>Valor est.</th>
              <th style={th}>Responsável</th>
              <th style={{ ...th, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const st = LEAD_STAGES.find((s) => s.id === c.stage);
              return (
                <tr key={c.id}>
                  <td style={{ ...td, cursor: "pointer" }} onClick={() => onOpen(c)}>
                    <div style={{ fontWeight: 700 }}>{c.nome}</div>
                    {c.empresa && <div className="muted" style={{ fontSize: 12 }}>{c.empresa}</div>}
                  </td>
                  <td style={td}>
                    <span className="row gap8" style={{ alignItems: "center", fontSize: 12.5, fontWeight: 700, color: st?.c ?? "var(--muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: st?.c ?? "var(--muted)" }} />{st?.label ?? c.stage}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {new Date(c.finalizadoAt!).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{c.valorEstimadoCents > 0 ? brl(c.valorEstimadoCents) : <span className="muted">—</span>}</td>
                  <td style={{ ...td, color: c.assignedUserName ? "var(--ink-2)" : "var(--muted)" }}>{c.assignedUserName ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/comercial/leads/${c.id}`} className="btn" style={{ padding: "5px 12px", fontSize: 12.5 }}>Conversa</Link>
                    {isAdmin && (confirmId === c.id ? (
                      <button className="btn" style={{ padding: "5px 12px", fontSize: 12.5, marginLeft: 8, color: "#fff", background: "var(--st-risk)", borderColor: "var(--st-risk)" }} disabled={pending} onClick={() => remove(c.id)}>
                        {pending ? "Excluindo…" : "Confirmar exclusão"}
                      </button>
                    ) : (
                      <button className="btn" style={{ padding: "5px 12px", fontSize: 12.5, marginLeft: 8, color: "var(--st-risk)" }} onClick={() => setConfirmId(c.id)}>Excluir</button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Column({ id, label, color, count, valorCents, parados, dense, children }: { id: string; label: string; color: string; count: number; valorCents: number; parados?: number; dense?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? `color-mix(in srgb, ${color} 6%, var(--surface-3))` : "var(--surface-3)", borderRadius: "var(--r-lg)", padding: 14, outline: isOver ? `2px dashed ${color}` : "2px dashed transparent", transition: "outline-color .12s, background-color .12s" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "2px 4px 14px", borderBottom: `2px solid ${color}`, marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <div className="row gap8" style={{ alignItems: "center" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: color }} />
            <b style={{ fontSize: 15 }}>{label}</b>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color, background: `color-mix(in srgb, ${color} 14%, var(--surface))`, padding: "2px 11px", borderRadius: "var(--r-pill)", minWidth: 26, textAlign: "center" }}>{count}</span>
        </div>
        {(valorCents > 0 || !!parados) && (
          <div className="row between" style={{ alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>{valorCents > 0 ? brl(valorCents) : ""}</span>
            {!!parados && (
              <span title={`${parados} lead(s) há mais de 7 dias nesta fila`} className="row gap8" style={{ alignItems: "center", fontSize: 11, fontWeight: 800, color: "var(--st-risk)", background: "var(--st-risk-bg)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
                <Icon name="alert" size={11} /> {parados} parado{parados > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: dense ? 6 : 12, minHeight: 48, maxHeight: "calc(100vh - 300px)", overflowY: "auto", margin: "0 -4px", padding: "0 4px 4px" }}>{children}</div>
    </div>
  );
}

function DraggableCard({ c, color, dense, dimmed, onOpen }: { c: LeadCard; color: string; dense?: boolean; dimmed: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} style={{ cursor: "grab", opacity: dimmed ? 0.4 : 1, touchAction: "none", outline: "none" }}>
      <CardBody c={c} color={color} dense={dense} />
    </div>
  );
}

function CardBody({ c, color, dense }: { c: LeadCard; color: string; dense?: boolean }) {
  const fila = stageAge(c);
  if (dense) {
    return (
      <div className="card lead-card row between" style={{ padding: "9px 12px", paddingLeft: 13, boxShadow: "var(--sh-sm)", border: "1px solid var(--line)", borderLeft: `4px solid ${color}`, borderRadius: "var(--r-sm)", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</div>
          {c.empresa && <div className="muted" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.empresa}</div>}
        </div>
        {c.valorEstimadoCents > 0 && <span style={{ fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{brl(c.valorEstimadoCents)}</span>}
        <span title={`Na fila há ${fila.label}`} style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: fila.fg, background: fila.bg, padding: "2px 7px", borderRadius: "var(--r-pill)" }}>{fila.label}</span>
        {c.assignedUserName && (
          <span title={c.assignedUserName} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: avatarColor(c.assignedUserName), color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center" }}>{initials(c.assignedUserName)}</span>
        )}
      </div>
    );
  }
  return (
    <div className="card lead-card" style={{ padding: 16, paddingLeft: 18, boxShadow: "var(--sh-sm)", border: "1px solid var(--line)", borderLeft: `4px solid ${color}`, borderRadius: "var(--r-md)" }}>
      <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.25, color: "var(--ink)" }}>{c.nome}</div>
          {c.empresa && (
            <div className="row gap8" style={{ alignItems: "center", marginTop: 4 }}>
              <Icon name="briefcase" size={13} style={{ color: "var(--muted-2)" }} />
              <span className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.empresa}</span>
            </div>
          )}
        </div>
        {c.assignedUserName && (
          <span title={c.assignedUserName} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: avatarColor(c.assignedUserName), color: "#fff", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", letterSpacing: 0.3 }}>{initials(c.assignedUserName)}</span>
        )}
      </div>

      {c.valorEstimadoCents > 0 && (
        <div style={{ marginTop: 12, fontWeight: 800, fontSize: 19, color: "var(--ink)", letterSpacing: -0.4 }}>{brl(c.valorEstimadoCents)}</div>
      )}

      <div className="row gap8" style={{ marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span title={`Entrou nesta fila há ${fila.label}`} className="badge row gap8" style={{ alignItems: "center", color: fila.fg, background: fila.bg, fontSize: 11, fontWeight: 800 }}>
          <Icon name="clock" size={11} /> {fila.label} na fila
        </span>
        {c.finalizadoAt && <span title="Atendimento encerrado no AtendAI — conversa completa disponível" className="badge row gap8" style={{ alignItems: "center", color: "var(--st-done)", background: "var(--st-done-bg)", fontSize: 11, fontWeight: 800 }}><Icon name="checkCircle" size={11} /> finalizado</span>}
        {c.origem && <span className="badge" style={{ color: "var(--muted)", background: "var(--surface-3)", fontSize: 11 }}>{c.origem}</span>}
        {c.ixcClienteId && <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)", fontSize: 11, fontWeight: 700 }}>cliente</span>}
      </div>

      <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", alignItems: "center", gap: 8 }}>
        <span className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contato ?? "—"}</span>
        <span className="row gap8 muted" title="Último contato" style={{ flexShrink: 0, alignItems: "center", fontSize: 11.5 }}>
          <Icon name="msg" size={12} /> {timeAgo(c.lastContactAt)}
        </span>
      </div>
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
  const [stage, setStage] = useState<LeadStage>(lead.stage);
  const [valor, setValor] = useState(lead.valorEstimadoCents > 0 ? String(lead.valorEstimadoCents / 100) : "");
  const [valorSalvo, setValorSalvo] = useState(false);
  function changeAssign(v: string) { setAssigned(v); start(async () => { await assignLead(lead.id, v || null); router.refresh(); }); }
  function changeStage(v: string) { setStage(v as LeadStage); start(async () => { await moveLeadStage(lead.id, v); router.refresh(); }); }
  function saveValor() {
    const n = parseFloat(valor.replace(",", ".")) || 0;
    if (Math.round(n * 100) === lead.valorEstimadoCents) return; // sem mudança
    start(async () => {
      const r = await updateLeadValor(lead.id, n);
      if (r.ok) { setValorSalvo(true); setTimeout(() => setValorSalvo(false), 2500); }
      router.refresh();
    });
  }
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
          <span className="muted">Na fila</span>
          <span>
            <span style={{ fontWeight: 700, color: LEAD_STAGES.find((s) => s.id === lead.stage)?.c }}>{LEAD_STAGES.find((s) => s.id === lead.stage)?.label ?? lead.stage}</span>
            {" "}há <b style={{ color: stageAge(lead).fg }}>{stageAge(lead).label}</b>
          </span>
          <span className="muted">Último contato</span><span>{new Date(lead.lastContactAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <Link href={`/comercial/leads/${lead.id}`} className="btn btn-primary" style={{ marginBottom: 14, width: "100%", justifyContent: "center" }}>Abrir conversa e análise IA <Icon name="chevRight" size={14} /></Link>
        {lead.ixcClienteId && <Link href={`/comercial/clientes/${lead.ixcClienteId}`} className="btn btn-ghost" style={{ marginBottom: 14 }}>Ver cliente 360 <Icon name="chevRight" size={14} /></Link>}
        {lead.observacoes && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Observações / histórico</label>
            <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap", background: "var(--surface-3)", borderRadius: "var(--r-md)", padding: 10, maxHeight: 160, overflowY: "auto" }}>{lead.observacoes}</div>
          </div>
        )}
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="valor-est">Valor estimado (R$)</label>
          <div className="row gap8" style={{ alignItems: "center" }}>
            <input
              className="input" id="valor-est" type="number" min="0" step="0.01" inputMode="decimal"
              value={valor} onChange={(e) => setValor(e.target.value)}
              onBlur={saveValor}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              disabled={pending} placeholder="0,00 — o chat não manda valor; preencha ao qualificar"
            />
            {valorSalvo && <span style={{ color: "var(--st-done)", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>✓ salvo</span>}
          </div>
        </div>
        <div className="row gap12">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="stage-sel">Fila / estágio</label>
            <select className="input" id="stage-sel" value={stage} onChange={(e) => changeStage(e.target.value)} disabled={pending}>
              {LEAD_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="assignee">Responsável</label>
            <select className="input" id="assignee" value={assigned} onChange={(e) => changeAssign(e.target.value)} disabled={pending}>
              <option value="">Sem responsável</option>
              {userOpts.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 18 }}>
          {isAdmin ? <button className="btn" style={{ color: "var(--st-risk)" }} onClick={remove} disabled={pending}><Icon name="alert" size={15} /> Excluir</button> : <span />}
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
