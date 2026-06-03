import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getTimelineData } from "@/server/timeline";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { AvatarStack } from "@/components/ui/Avatar";
import { MONTHS, STATUS_META } from "@/lib/meta";
import { fullLabel, dayLabel } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";

const FILTERS: [ProjectStatus | "all", string][] = [
  ["all", "Todos"],
  ["progress", "Em andamento"],
  ["review", "Em revisão"],
  ["planned", "Planejados"],
  ["done", "Concluídos"],
];

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const year = Number(sp.year) || new Date().getFullYear();
  const status = (sp.status as ProjectStatus | "all") || "all";

  const data = await getTimelineData(user.workspaceId, year);
  const bars = status === "all" ? data.bars : data.bars.filter((b) => b.status === status);

  const qs = (y: number, s: string) => `?year=${y}&status=${s}`;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Cronograma</h1>
          <p className="page-sub">Visão anual de todos os projetos</p>
        </div>
        <div className="row gap12">
          {/* navegação de ano */}
          <div className="seg">
            <Link href={qs(year - 1, status)} className="" style={{ padding: "6px 10px" }}><Icon name="chevLeft" size={15} /></Link>
            <span className="on" style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}>{year}</span>
            <Link href={qs(year + 1, status)} className="" style={{ padding: "6px 10px" }}><Icon name="chevRight" size={15} /></Link>
          </div>
        </div>
      </div>

      {/* filtro por status */}
      <div className="seg" style={{ marginBottom: 18 }}>
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={qs(year, k)} className={status === k ? "on" : ""}>{l}</Link>
        ))}
      </div>

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 980 }}>
            {/* header meses */}
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", borderBottom: "1px solid var(--line)" }}>
              <div style={{ padding: "14px 20px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted-2)" }}>Projeto</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)" }}>
                {MONTHS.map((m) => (
                  <div key={m} style={{ padding: "14px 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--muted)", borderLeft: "1px solid var(--line)" }}>{m}</div>
                ))}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              {data.today !== null && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(220px + (100% - 220px) * ${data.today / 12})`, width: 2, background: "var(--primary)", zIndex: 3 }}>
                  <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap" }}>Hoje</span>
                </div>
              )}

              {bars.length === 0 ? (
                <div className="muted" style={{ padding: 40, textAlign: "center" }}>Nenhum projeto neste filtro/ano.</div>
              ) : (
                bars.map((b) => {
                  const period = b.dueDate ? `${dayLabel(b.startDate)} → ${fullLabel(b.dueDate)}` : `Início ${fullLabel(b.startDate)} · sem prazo`;
                  const tip = `${b.name}\n${STATUS_META[b.status].label} · ${b.progress}%\n${period}`;
                  return (
                    <Link
                      key={b.id}
                      href={`/projects/${b.id}`}
                      title={tip}
                      style={{ display: "grid", gridTemplateColumns: "220px 1fr", borderTop: "1px solid var(--line)", minHeight: 56, alignItems: "center", padding: 0 }}
                      className="proj-row"
                    >
                      <div style={{ padding: "0 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", position: "relative", height: "100%" }}>
                        {MONTHS.map((m, j) => (
                          <div key={j} style={{ borderLeft: "1px solid var(--line)" }} />
                        ))}
                        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: `${(b.startCol / 12) * 100}%`, width: `${(b.span / 12) * 100}%`, padding: "0 6px", height: 34, background: `color-mix(in srgb, ${b.color} 14%, var(--surface))`, border: `1.5px solid ${b.color}`, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: b.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.progress}%</span>
                          <AvatarStack users={b.members} size={22} max={3} />
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
