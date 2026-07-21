"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { fullLabel, hourLabel } from "@/lib/format";
import { runGlpiSyncAction } from "@/app/(marketing)/marketing/demandas/actions";
import type { GlpiReport, StatusFilter } from "@/server/glpi/queries";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "abertos", label: "Abertos" },
  { key: "pendentes", label: "Pendentes" },
  { key: "solucionados", label: "Solucionados" },
  { key: "fechados", label: "Fechados" },
  { key: "todos", label: "Todos" },
];

// Cor do status (GLPI: 1 Novo, 2 Em atend., 4 Pendente, 5 Solucionado, 6 Fechado).
function statusStyle(id: number): React.CSSProperties {
  if (id === 5 || id === 6) return { color: "var(--st-done)", background: "var(--st-done-bg)" };
  if (id === 4) return { color: "var(--st-risk)", background: "var(--st-risk-bg)" };
  return { color: "var(--st-progress)", background: "var(--st-progress-bg)" }; // novo / em atendimento
}

const PRIORITY_LABEL: Record<number, string> = { 1: "Muito baixa", 2: "Baixa", 3: "Média", 4: "Alta", 5: "Muito alta" };

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
          label="Tempo médio"
          value={stats.avgResolutionH ?? "—"}
          suffix={stats.avgResolutionH ? "h" : undefined}
          accent="var(--c5)"
          foot="até solução"
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
                {tickets.map((t) => (
                  <tr key={t.glpiId}>
                    <td className="muted" style={{ width: 56 }}>{t.glpiId}</td>
                    <td style={{ fontWeight: 600, maxWidth: 340 }}>{t.name}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{t.requesterName}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{t.assignees || "—"}</td>
                    <td>
                      <span className="badge" style={statusStyle(t.statusId)}>{t.statusName || "—"}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{PRIORITY_LABEL[t.priority] ?? "—"}</td>
                    <td className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {fullLabel(new Date(t.dateCreation))}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {glpiBase && (
                        <a
                          href={`${glpiBase}/front/ticket.form.php?id=${t.glpiId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost"
                          style={{ padding: "2px 8px" }}
                          title="Abrir no GLPI"
                        >
                          <Icon name="externalLink" size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
