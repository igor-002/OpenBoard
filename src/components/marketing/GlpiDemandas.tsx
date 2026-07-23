"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { fullLabel, hourLabel } from "@/lib/format";
import { statusColors, PRIORITY_LABEL, staleDays, staleLevel } from "@/lib/glpi-format";
import { runGlpiSyncAction } from "@/app/(marketing)/marketing/demandas/actions";
import type { GlpiReport, StatusFilter } from "@/server/glpi/queries";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "abertos", label: "Abertos" },
  { key: "pendentes", label: "Pendentes" },
  { key: "solucionados", label: "Solucionados" },
  { key: "fechados", label: "Fechados" },
  { key: "todos", label: "Todos" },
];

// Colunas do Kanban por status GLPI (2 e 3 = "Em atendimento" juntos).
const KANBAN_COLS: { key: string; label: string; ids: number[] }[] = [
  { key: "novo", label: "Novo", ids: [1] },
  { key: "atend", label: "Em atendimento", ids: [2, 3] },
  { key: "pendente", label: "Pendente", ids: [4] },
  { key: "solucionado", label: "Solucionado", ids: [5] },
  { key: "fechado", label: "Fechado", ids: [6] },
];

export function GlpiDemandas({
  report,
  requesterId,
  status,
  glpiBase,
  isAdmin,
}: {
  report: GlpiReport;
  requesterId: number | null;
  status: StatusFilter;
  glpiBase: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<"lista" | "kanban">("lista");

  function navigate(nextUser: number | null, nextStatus: StatusFilter) {
    const p = new URLSearchParams();
    if (nextUser) p.set("user", String(nextUser));
    if (nextStatus !== "abertos") p.set("status", nextStatus);
    const qs = p.toString();
    router.push(`/marketing/demandas${qs ? `?${qs}` : ""}`);
  }

  function sync() {
    setMsg(null);
    start(async () => {
      const r = await runGlpiSyncAction();
      setMsg(r.ok ? { ok: true, text: "Sincronizado." } : { ok: false, text: r.error || "Falha no sync." });
      if (r.ok) router.refresh();
    });
  }

  const { users, stats, tickets, lastSync } = report;

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)", flexWrap: "wrap" }}>
        <div className="row gap8" style={{ flexWrap: "wrap" }}>
          <button
            className={`btn ${requesterId === null ? "btn-primary" : "btn-ghost"}`}
            style={{ padding: "4px 12px", fontSize: 12.5 }}
            onClick={() => navigate(null, status)}
          >
            Todos
          </button>
          {users.map((u) => (
            <button
              key={u.requesterId}
              className={`btn ${requesterId === u.requesterId ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "4px 12px", fontSize: 12.5 }}
              onClick={() => navigate(u.requesterId, status)}
            >
              {u.name} <span className="muted" style={{ marginLeft: 4 }}>{u.abertos}</span>
            </button>
          ))}
        </div>
        <div className="row gap12" style={{ marginLeft: "auto", alignItems: "center" }}>
          {lastSync?.finishedAt && (
            <span className="muted" style={{ fontSize: 12 }}>
              Última sync: {hourLabel(new Date(lastSync.finishedAt))} · {lastSync.processed} chamados
            </span>
          )}
          {isAdmin && (
            <button className="btn btn-ghost" onClick={sync} disabled={pending}>
              <Icon name="zap" size={15} /> {pending ? "Sincronizando…" : "Sincronizar"}
            </button>
          )}
          {msg && (
            <span style={{ color: msg.ok ? "var(--st-done)" : "var(--st-risk)", fontWeight: 600, fontSize: 12.5 }}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <StatCard icon="inbox" label="Total" value={stats.total} foot="demandas no espelho" />
        <StatCard icon="clock" label="Abertos" value={stats.abertos} accent="var(--c3)" foot="novo / em atend. / pendente" />
        <StatCard icon="alert" label="Pendentes" value={stats.pendentes} accent="var(--st-risk)" foot="aguardando" />
        <StatCard icon="checkCircle" label="Solucionados" value={stats.solucionados} accent="var(--c4)" foot="status Solucionado" />
        <StatCard
          icon="timeline"
          label="Tempo até solução"
          value={stats.medianResolutionH ?? "—"}
          suffix={stats.medianResolutionH ? "h" : undefined}
          accent="var(--c5)"
          foot="mediana (tempo corrido)"
        />
      </div>

      <div className="row gap8" style={{ marginBottom: "var(--gap)", flexWrap: "wrap", alignItems: "center" }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            className={`btn ${s.key === status ? "btn-primary" : "btn-ghost"}`}
            style={{ padding: "3px 12px", fontSize: 12.5 }}
            onClick={() => navigate(requesterId, s.key)}
          >
            {s.label}
          </button>
        ))}
        {/* Toggle Lista / Kanban */}
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button className={view === "lista" ? "on" : ""} onClick={() => setView("lista")}>
            <Icon name="inbox" size={14} /> Lista
          </button>
          <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}>
            <Icon name="kanban" size={14} /> Kanban
          </button>
        </div>
      </div>

      {view === "lista" ? (
        <Card title="Chamados" sub={`${tickets.length} exibidos`} pad={false}>
          {tickets.length === 0 ? (
            <div className="card-pad muted">Nenhum chamado neste filtro.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>#</th>
                    <th style={{ textAlign: "left" }}>Título</th>
                    <th style={{ textAlign: "left" }}>Solicitante</th>
                    <th style={{ textAlign: "left" }}>Responsável</th>
                    <th style={{ textAlign: "left" }}>Status</th>
                    <th style={{ textAlign: "left" }}>Prioridade</th>
                    <th style={{ textAlign: "left" }}>Aberto em</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const sc = statusColors(t.statusId);
                    const days = staleDays(t.dateMod, t.dateCreation);
                    const stale = staleLevel(t.statusId, days);
                    const staleColor = stale === "risk" ? "var(--st-risk)" : "var(--st-warn, #b45309)";
                    return (
                      <tr key={t.glpiId}>
                        <td className="muted" style={{ width: 56 }}>{t.glpiId}</td>
                        <td style={{ maxWidth: 360 }}>
                          <Link href={`/marketing/demandas/${t.glpiId}`} style={{ fontWeight: 600 }}>{t.name}</Link>
                          {stale !== "none" && (
                            <span
                              className="badge"
                              style={{ marginLeft: 8, color: staleColor, background: "color-mix(in srgb, currentColor 12%, transparent)" }}
                              title={`Sem movimentação há ${days} dias`}
                            >
                              <Icon name="clock" size={11} /> parada {days}d
                            </span>
                          )}
                        </td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{t.requesterName}</td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{t.assignees || "—"}</td>
                        <td>
                          <span className="badge" style={{ color: sc.color, background: sc.bg }}>{t.statusName || "—"}</span>
                        </td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{PRIORITY_LABEL[t.priority] ?? "—"}</td>
                        <td className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                          {fullLabel(new Date(t.dateCreation))}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link
                            href={`/marketing/demandas/${t.glpiId}`}
                            className="btn btn-ghost"
                            style={{ padding: "2px 8px" }}
                            title="Ver detalhes"
                          >
                            <Icon name="chevRight" size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <KanbanBoard tickets={tickets} />
      )}
    </>
  );
}

// ── Kanban: colunas por status GLPI (read-only; card → detalhe) ───────────────
function KanbanBoard({ tickets }: { tickets: GlpiReport["tickets"] }) {
  const colOf = (statusId: number) => KANBAN_COLS.find((c) => c.ids.includes(statusId))?.key ?? "novo";
  const byCol = new Map<string, GlpiReport["tickets"]>();
  for (const c of KANBAN_COLS) byCol.set(c.key, []);
  for (const t of tickets) byCol.get(colOf(t.statusId))!.push(t);

  if (tickets.length === 0) {
    return <div className="card card-pad muted">Nenhum chamado neste filtro.</div>;
  }

  return (
    <div style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
      {KANBAN_COLS.map((col) => {
        const items = byCol.get(col.key) ?? [];
        const accent = statusColors(col.ids[0]);
        return (
          <div key={col.key} style={{ flex: "0 0 268px", minWidth: 268 }}>
            <div
              className="row between"
              style={{ padding: "8px 10px", borderRadius: "var(--r-md) var(--r-md) 0 0", background: "var(--surface-2)", borderBottom: `2px solid ${accent.color}` }}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{col.label}</span>
              <span className="badge" style={{ color: accent.color, background: accent.bg, fontWeight: 800 }}>{items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 4px", minHeight: 40 }}>
              {items.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: "12px 0" }}>—</div>
              ) : (
                items.map((t) => {
                  const days = staleDays(t.dateMod, t.dateCreation);
                  const stale = staleLevel(t.statusId, days);
                  const staleColor = stale === "risk" ? "var(--st-risk)" : "var(--st-warn, #b45309)";
                  return (
                    <Link
                      key={t.glpiId}
                      href={`/marketing/demandas/${t.glpiId}`}
                      className="card"
                      style={{ display: "block", padding: 10, textDecoration: "none", color: "inherit" }}
                    >
                      <div className="row between" style={{ alignItems: "center", marginBottom: 4 }}>
                        <span className="muted" style={{ fontSize: 11.5 }}>#{t.glpiId}</span>
                        {stale !== "none" && (
                          <span className="badge" style={{ color: staleColor, background: "color-mix(in srgb, currentColor 12%, transparent)", fontSize: 10.5 }} title={`Sem movimentação há ${days} dias`}>
                            <Icon name="clock" size={10} /> {days}d
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", lineHeight: 1.35, marginBottom: 6 }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span>{t.requesterName}</span>
                        <span>{t.assignees ? `→ ${t.assignees}` : "sem responsável"} · {PRIORITY_LABEL[t.priority] ?? "—"}</span>
                        <span>{fullLabel(new Date(t.dateCreation))}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
