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

      <div className="row gap8" style={{ marginBottom: "var(--gap)", flexWrap: "wrap" }}>
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
      </div>

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
    </>
  );
}
