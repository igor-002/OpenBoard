import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTicketDetail, type TimelineEntry } from "@/server/glpi/detail";
import { glpiConfigured } from "@/server/glpi/queries";
import { Icon } from "@/components/ui/Icon";
import { fullLabel, hourLabel } from "@/lib/format";
import { statusColors, PRIORITY_LABEL, staleDays, staleLevel, initialsOf, colorForName } from "@/lib/glpi-format";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
function when(iso: string | null): string {
  if (!iso) return "—";
  return `${fullLabel(new Date(iso))} · ${hourLabel(new Date(iso))}`;
}

// Avatar circular com iniciais + cor estável derivada do nome.
function Av({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: "50%",
        background: colorForName(name),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 800,
        letterSpacing: -0.3,
        boxShadow: "0 0 0 2px var(--surface)",
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

// Cor do "chip" de cada tipo de entrada na linha do tempo.
function kindTone(kind: string): { color: string; bg: string } {
  if (/solu/i.test(kind)) return { color: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (/tarefa/i.test(kind)) return { color: "var(--st-review)", bg: "var(--st-review-bg)" };
  if (/valida/i.test(kind)) return { color: "var(--c6)", bg: "color-mix(in srgb, var(--c6) 16%, #fff)" };
  return { color: "var(--st-progress)", bg: "var(--st-progress-bg)" };
}

function MetaRow({ label, value, badge }: { label: string; value: React.ReactNode; badge?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: badge ? 700 : 600, textAlign: "right", minWidth: 0 }}>{value}</span>
    </div>
  );
}

export default async function DemandaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const glpiId = Number(id);
  if (!glpiConfigured() || !Number.isInteger(glpiId)) notFound();

  const t = await getTicketDetail(glpiId);
  if (!t) notFound();

  const glpiBase = (process.env.GLPI_URL ?? "").replace(/\/$/, "");
  const sc = statusColors(t.statusId);
  const idleDays = staleDays(t.dateMod, t.dateCreation ?? new Date().toISOString());
  const stale = staleLevel(t.statusId, idleDays);
  const staleColor = stale === "risk" ? "var(--st-risk)" : "var(--st-warn, #b45309)";
  const isOpen = ![5, 6].includes(t.statusId);
  const ageDays = daysSince(t.dateCreation);
  const requester = t.requesterName || "—";
  const assignees = t.assignees ? t.assignees.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div className="page">
      {/* ── Cabeçalho em destaque ─────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--line)",
          borderLeft: `4px solid ${sc.color}`,
          background: "linear-gradient(160deg, var(--primary-tint), var(--surface) 55%)",
          boxShadow: "var(--sh-sm)",
          padding: "20px 22px",
          marginBottom: "var(--gap)",
        }}
      >
        <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/marketing/demandas" className="btn btn-ghost" style={{ padding: "3px 10px" }}>
            <Icon name="chevLeft" size={15} /> Demandas
          </Link>
          <span className="muted" style={{ fontWeight: 700 }}>#{t.glpiId}</span>
          <span className="badge" style={{ color: sc.color, background: sc.bg }}>{t.statusName || "—"}</span>
          <span className="tag">{PRIORITY_LABEL[t.priority] ?? "—"}</span>
          {stale !== "none" && (
            <span className="badge" style={{ color: staleColor, background: "color-mix(in srgb, currentColor 12%, transparent)" }}>
              <Icon name="clock" size={12} /> parada há {idleDays}d
            </span>
          )}
          {glpiBase && (
            <a
              href={`${glpiBase}/front/ticket.form.php?id=${t.glpiId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ marginLeft: "auto" }}
            >
              <Icon name="externalLink" size={15} /> Abrir no GLPI
            </a>
          )}
        </div>

        <h1 className="page-title" style={{ margin: "12px 0 14px", lineHeight: 1.2 }}>{t.name}</h1>

        <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
          <span className="row gap8" style={{ alignItems: "center" }}>
            <Av name={requester} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Abriu</span>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{requester}</span>
            </span>
          </span>
          <Icon name="chevRight" size={16} />
          <span className="row gap8" style={{ alignItems: "center" }}>
            {assignees.length ? (
              <>
                {assignees.slice(0, 3).map((a) => <Av key={a} name={a} size={30} />)}
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Atende</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{assignees.join(", ")}</span>
                </span>
              </>
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>Sem responsável atribuído</span>
            )}
          </span>
          <span className="muted" style={{ fontSize: 12.5, marginLeft: "auto" }}>
            <Icon name="calendar" size={13} /> aberto {ageDays != null ? `há ${ageDays}d` : "—"} · {t.entityName || "—"}
          </span>
        </div>
      </div>

      {/* ── Corpo ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "var(--gap)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }}>
          {/* Descrição */}
          <div className="card card-pad">
            <div className="card-head" style={{ marginBottom: 12 }}>
              <h2 className="card-title">Descrição</h2>
              <span className="tag">{t.requestType || "Chamado"}</span>
            </div>
            {t.description ? (
              <p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, color: "var(--ink-2)" }}>{t.description}</p>
            ) : (
              <span className="muted">Sem descrição.</span>
            )}
          </div>

          {/* Linha do tempo (assinatura) */}
          <div className="card card-pad">
            <div className="card-head" style={{ marginBottom: 16 }}>
              <h2 className="card-title">Linha do tempo</h2>
              <span className="card-sub" style={{ margin: 0 }}>{t.timeline.length} interação(ões)</span>
            </div>
            {t.timeline.length === 0 ? (
              <div className="muted">Nenhuma interação registrada ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {t.timeline.map((e, i) => (
                  <TimelineRow key={`${e.kind}-${e.id}-${i}`} e={e} last={i === t.timeline.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel lateral */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", position: "sticky", top: 12 }}>
          <div className="card card-pad">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <h2 className="card-title">Situação</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <MetaRow label="Status" value={<span className="badge" style={{ color: sc.color, background: sc.bg }}>{t.statusName || "—"}</span>} badge />
              <MetaRow label="Prioridade" value={PRIORITY_LABEL[t.priority] ?? "—"} />
              <MetaRow label={isOpen ? "Aberto há" : "Aberto em"} value={isOpen ? (ageDays != null ? `${ageDays} dias` : "—") : when(t.dateCreation)} />
              <MetaRow label="Última mov." value={`${idleDays}d atrás`} />
              {stale !== "none" && (
                <MetaRow label="Parada" value={<span style={{ color: staleColor }}>há {idleDays} dias</span>} badge />
              )}
              {t.dateSolve && <MetaRow label="Solucionado" value={when(t.dateSolve)} />}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <h2 className="card-title">Detalhes</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <MetaRow label="Solicitante" value={requester} />
              <MetaRow label="Responsável" value={assignees.length ? assignees.join(", ") : "—"} />
              {t.observers && <MetaRow label="Observadores" value={t.observers} />}
              <MetaRow label="Entidade" value={t.entityName || "—"} />
              {t.categoryName && <MetaRow label="Categoria" value={t.categoryName} />}
              <MetaRow label="Origem" value={t.requestType || "—"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Uma entrada da linha do tempo: nó (avatar + linha vertical) + cartão.
function TimelineRow({ e, last }: { e: TimelineEntry; last: boolean }) {
  const tone = kindTone(e.kind);
  const isSolution = /solu/i.test(e.kind);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
      <div style={{ position: "relative", flex: "0 0 34px", display: "flex", justifyContent: "center" }}>
        <Av name={e.author || "—"} size={34} />
        {!last && (
          <span style={{ position: "absolute", top: 38, bottom: -2, left: "50%", width: 2, marginLeft: -1, background: "var(--line-2)" }} />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0, flex: 1 }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderLeft: isSolution ? `3px solid var(--st-done)` : "1px solid var(--line)",
            background: isSolution ? "var(--st-done-bg)" : "var(--surface-2)",
            borderRadius: "var(--r-md)",
            padding: "10px 14px",
          }}
        >
          <div className="row gap8" style={{ alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <span className="badge" style={{ color: tone.color, background: tone.bg, padding: "2px 9px" }}>{e.kind}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{e.author || "—"}</span>
            {e.isPrivate && (
              <span className="badge" style={{ background: "var(--st-planned-bg)", color: "var(--st-planned)", padding: "2px 9px" }}>
                privado
              </span>
            )}
            <span className="muted" style={{ fontSize: 11.5, marginLeft: "auto" }}>{when(e.date)}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55, fontSize: 13.5, color: "var(--ink-2)" }}>
            {e.content || <span className="muted">—</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
