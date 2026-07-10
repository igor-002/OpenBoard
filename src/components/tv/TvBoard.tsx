"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { TvData, TvProject, TvTaskDue, TvMilestone, TvActivity, TvRisk, TvAssignee, TvFeatured, TvNote, TvGanttBar } from "@/server/tv";
import type { ProjectStatus, Priority, AvatarUser } from "@/lib/types";
import { brl } from "@/lib/format";

/* ---------- mapas de cor (tokens --tv-*) ---------- */
const STATUS: Record<ProjectStatus, { label: string; c: string; bg: string }> = {
  progress: { label: "Em andamento", c: "var(--info)", bg: "var(--info-bg)" },
  done: { label: "Concluído", c: "var(--ok)", bg: "var(--ok-bg)" },
  review: { label: "Em revisão", c: "var(--viol)", bg: "var(--viol-bg)" },
  planned: { label: "Planejado", c: "var(--tv-muted)", bg: "rgba(126,138,153,.14)" },
};
const PRI: Record<Priority, { l: string; c: string; bg: string }> = {
  high: { l: "Alta", c: "var(--crit)", bg: "var(--crit-bg)" },
  med: { l: "Média", c: "var(--warn)", bg: "var(--warn-bg)" },
  low: { l: "Baixa", c: "var(--ok)", bg: "var(--ok-bg)" },
};

/* ---------- helpers ---------- */
function urgency(days: number | null): { c: string; bg: string; lbl: string } {
  if (days === null) return { c: "var(--tv-muted)", bg: "rgba(126,138,153,.14)", lbl: "Sem prazo" };
  if (days < 0) return { c: "var(--crit)", bg: "var(--crit-bg)", lbl: `${Math.abs(days)}d atrasado` };
  if (days <= 3) return { c: "var(--crit)", bg: "var(--crit-bg)", lbl: `${days}d restantes` };
  if (days <= 10) return { c: "var(--warn)", bg: "var(--warn-bg)", lbl: `${days}d restantes` };
  return { c: "var(--ok)", bg: "var(--ok-bg)", lbl: `${days}d restantes` };
}
function fmtClock(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(d: Date) {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function dayMonth(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
// "now" vem de data.generatedAt (server) — determinístico, evita mismatch de hidratação.
function relTime(iso: string, nowMs: number) {
  const m = Math.floor((nowMs - +new Date(iso)) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/* ---------- componentes compartilhados ---------- */
function Av({ u, size = 38 }: { u: AvatarUser; size?: number }) {
  return (
    <span className="tv-av" style={{ width: size, height: size, background: u.color, fontSize: size * 0.38 }} title={u.name}>
      {u.initials}
    </span>
  );
}
function AvRow({ users, size = 36, max = 4 }: { users: AvatarUser[]; size?: number; max?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="tv-avrow">
      {shown.map((u, i) => <Av key={i} u={u} size={size} />)}
      {extra > 0 && (
        <span className="tv-av" style={{ width: size, height: size, marginLeft: -8, background: "var(--tv-panel-2)", color: "var(--tv-muted)", fontSize: size * 0.34 }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
function Bar({ value, color, h = 9 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="tv-bar" style={{ height: h }}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color || "var(--tv-accent)" }} />
    </div>
  );
}
function Status({ status }: { status: ProjectStatus }) {
  const m = STATUS[status];
  return <span className="tv-badge" style={{ color: m.c, background: m.bg }}><span className="bd" style={{ background: m.c }} />{m.label}</span>;
}
function Panel({
  icon, color = "var(--tv-accent)", title, sub, right, children, style, className = "",
}: {
  icon: IconName; color?: string; title: string; sub?: string; right?: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties; className?: string;
}) {
  return (
    <section className={`tv-panel ${className}`} style={style}>
      <div className="tv-panel-h">
        <span className="ic" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Icon name={icon} size={20} /></span>
        <div>
          <h3>{title}</h3>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right && <div className="right">{right}</div>}
      </div>
      {children}
    </section>
  );
}
function KPI({ icon, color = "var(--tv-accent)", label, value, unit, foot }: {
  icon: IconName; color?: string; label: string; value: string | number; unit?: string; foot: string;
}) {
  return (
    <div className="tv-kpi" style={{ color }}>
      <div className="top">
        <span className="lab">{label}</span>
        <span className="ico" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Icon name={icon} size={23} /></span>
      </div>
      <div className="val">{value}{unit && <small> {unit}</small>}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}

/* ============ SLIDE 1 — PANORAMA ============ */
function SlidePanorama({ d }: { d: TvData; now: Date }) {
  const k = d.kpis;
  const statusOrder: ProjectStatus[] = ["progress", "review", "planned", "done"];
  const sc = statusOrder.map((s) => ({ s, n: d.statusCounts.find((x) => x.status === s)?.n ?? 0 }));
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "188px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="briefcase" color="var(--tv-accent)" label="Projetos ativos" value={k.projetosAtivos} foot={`de ${k.projetosTotal} no portfólio`} />
        <KPI icon="trendUp" color="var(--info)" label="Progresso médio" value={k.progressoMedio} unit="%" foot="dos projetos ativos" />
        <KPI icon="alert" color="var(--crit)" label="Projetos em risco" value={k.projetosRisco} foot="precisam de atenção" />
        <KPI icon="clock" color="var(--warn)" label="Tarefas atrasadas" value={k.tarefasAtrasadas} foot="prazo vencido" />
      </div>

      <div className="tv-grid" style={{ gridTemplateColumns: "1.65fr 1fr", gridTemplateRows: "none" }}>
        <Panel icon="folder" title="Projetos em andamento" sub="Progresso e prazos" right={`${d.projects.length} ativos`}>
          <div className="tv-list">
            {d.projects.slice(0, 6).map((p) => {
              const u = urgency(p.daysLeft);
              return (
                <div className="tv-row" key={p.id}>
                  <span style={{ width: 46, height: 46, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${STATUS[p.status].c} 16%, transparent)`, color: STATUS[p.status].c }}><Icon name="folder" size={23} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 13.5, color: "var(--tv-muted)", fontWeight: 600, marginTop: 2 }}>{p.client} · {p.tasksDone}/{p.tasksTotal} tarefas</div>
                  </div>
                  <div style={{ width: 190, flex: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "var(--tv-muted)", fontWeight: 700 }}>Progresso</span>
                      <b className="tnum" style={{ fontSize: 14 }}>{p.progress}%</b>
                    </div>
                    <Bar value={p.progress} color={p.risk ? "var(--crit)" : "var(--tv-accent)"} />
                  </div>
                  <span className="tv-badge tnum" style={{ color: u.c, background: u.bg, width: 140, justifyContent: "center", flex: "none" }}><Icon name="calendar" size={14} />{u.lbl}</span>
                  <div style={{ width: 132, display: "flex", justifyContent: "flex-end", flex: "none" }}><AvRow users={p.members} size={36} max={4} /></div>
                </div>
              );
            })}
            {d.projects.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 17, padding: "20px 4px" }}>Nenhum projeto ativo.</div>}
          </div>
        </Panel>

        <div className="tv-grid" style={{ gridTemplateRows: "auto 1fr", gap: 22 }}>
          <Panel icon="chart" color="var(--info)" title="Distribuição por status">
            <div style={{ display: "flex", height: 18, borderRadius: 999, overflow: "hidden", gap: 3, marginBottom: 18 }}>
              {sc.map((x) => x.n > 0 && <div key={x.s} style={{ flex: x.n, background: STATUS[x.s].c }} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
              {sc.map((x) => (
                <div key={x.s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: STATUS[x.s].c, flex: "none" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--tv-ink-2)", flex: 1 }}>{STATUS[x.s].label}</span>
                  <b className="tnum" style={{ fontSize: 18 }}>{x.n}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon="alert" color="var(--crit)" title="Atenção necessária" sub="Projetos sinalizados em risco">
            <div className="tv-list">
              {d.riskProjects.map((p: TvRisk) => {
                const u = urgency(p.daysLeft);
                return (
                  <div className="tv-row" key={p.id} style={{ gap: 14 }}>
                    <span className="dotpulse" style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--crit)", flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: "var(--tv-muted)", fontWeight: 600, marginTop: 2 }}>{p.client} · {p.spentPct}% do orçamento usado</div>
                    </div>
                    <span className="tv-badge tnum" style={{ color: u.c, background: u.bg }}>{u.lbl}</span>
                  </div>
                );
              })}
              {d.riskProjects.length === 0 && <div style={{ color: "var(--ok)", fontSize: 17, fontWeight: 700, padding: "16px 4px" }}>✓ Nenhum projeto em risco.</div>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ============ SLIDE 2 — PRAZOS & TAREFAS ============ */
function SlidePrazos({ d }: { d: TvData; now: Date }) {
  return (
    <div className="tv-grid" style={{ gridTemplateColumns: "1.6fr 1fr", gridTemplateRows: "none" }}>
      <Panel icon="calendar" title="Prazos de entrega" sub="Ordenados por urgência" right={`${d.deadlines.length} projetos`}>
        <div className="tv-list">
          {d.deadlines.slice(0, 8).map((p: TvProject) => {
            const u = urgency(p.status === "done" ? null : p.daysLeft);
            const crit = p.status !== "done" && p.daysLeft !== null && p.daysLeft <= 10;
            const bigNum = p.status === "done" ? "✓" : p.daysLeft === null ? "—" : Math.abs(p.daysLeft);
            return (
              <div className="tv-row" key={p.id} style={{ gap: 18, background: crit ? `color-mix(in srgb, ${u.c} 7%, transparent)` : "transparent", borderRadius: 10, paddingLeft: 12, paddingRight: 12 }}>
                <div style={{ width: 74, textAlign: "center", flex: "none" }}>
                  <div className="tnum" style={{ fontSize: 32, fontWeight: 800, color: p.status === "done" ? "var(--ok)" : u.c, lineHeight: 0.95, letterSpacing: "-1px" }}>{bigNum}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tv-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginTop: 3 }}>
                    {p.status === "done" ? "entregue" : p.daysLeft !== null && p.daysLeft < 0 ? "dias atraso" : "dias"}
                  </div>
                </div>
                <div style={{ width: 2, alignSelf: "stretch", background: u.c, opacity: 0.5, borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17.5, fontWeight: 800, letterSpacing: "-.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "var(--tv-muted)", fontWeight: 600, marginTop: 3 }}>{p.client} · {p.dueDate ? `entrega ${dayMonth(p.dueDate)}` : "sem prazo"}</div>
                </div>
                <div style={{ width: 150 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="tnum" style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 700 }}>{p.tasksDone}/{p.tasksTotal}</span>
                    <b className="tnum" style={{ fontSize: 13 }}>{p.progress}%</b>
                  </div>
                  <Bar value={p.progress} color={p.status === "done" ? "var(--ok)" : u.c} h={7} />
                </div>
                <Status status={p.status} />
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="tv-grid" style={{ gridTemplateRows: "1fr 1fr", gap: 22 }}>
        <Panel icon="clock" color="var(--warn)" title="Tarefas a vencer" sub="Prazos mais próximos">
          <div className="tv-list">
            {d.tasksByDue.slice(0, 5).map((t: TvTaskDue) => {
              const u = urgency(t.daysLeft);
              const late = t.daysLeft < 0;
              return (
                <div className="tv-row" key={t.id} style={{ gap: 14, padding: "11px 4px" }}>
                  <div style={{ width: 54, textAlign: "center", flex: "none" }}>
                    <div className="tnum" style={{ fontSize: 24, fontWeight: 800, color: u.c, lineHeight: 1 }}>{late ? "!" : t.daysLeft}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tv-muted)", textTransform: "uppercase", marginTop: 2 }}>{late ? "atraso" : "dias"}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 600, marginTop: 3 }}>{t.project}</div>
                  </div>
                  <span className="tv-badge" style={{ color: PRI[t.priority].c, background: PRI[t.priority].bg, fontSize: 11.5, padding: "3px 9px" }}>{PRI[t.priority].l}</span>
                  {t.assignee ? <Av u={t.assignee} size={34} /> : <span style={{ width: 34 }} />}
                </div>
              );
            })}
            {d.tasksByDue.length === 0 && <div style={{ color: "var(--ok)", fontSize: 16, fontWeight: 700, padding: "14px 4px" }}>✓ Nenhuma tarefa com prazo aberto.</div>}
          </div>
        </Panel>

        <Panel icon="flag" color="var(--viol)" title="Próximos marcos" sub="Entregas-chave previstas">
          <div className="tv-list">
            {d.milestones.slice(0, 5).map((m: TvMilestone) => (
              <div className="tv-row" key={m.id} style={{ gap: 14, padding: "12px 4px" }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "3px solid var(--viol)", background: m.state === "todo" ? "transparent" : "var(--viol)", flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 600, marginTop: 2 }}>{m.project}</div>
                </div>
                <span className="tv-badge tnum" style={{ color: "var(--tv-ink-2)", background: "var(--tv-panel-2)" }}><Icon name="calendar" size={13} />{dayMonth(m.date)}</span>
              </div>
            ))}
            {d.milestones.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 16, padding: "14px 4px" }}>Nenhum marco próximo.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============ SLIDE 3 — QUADRO & ATIVIDADE ============ */
function SlideAtividade({ d }: { d: TvData; now: Date }) {
  const k = d.kpis;
  const nowMs = +new Date(d.generatedAt);
  const maxKan = Math.max(1, ...d.kanban.map((c) => c.n));
  const COLC: Record<string, string> = { todo: "var(--tv-muted)", doing: "var(--info)", review: "var(--viol)", done: "var(--ok)" };
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "188px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="checkCircle" color="var(--ok)" label="Tarefas concluídas" value={k.tarefasDone} foot={`de ${k.tarefasTotal} no total`} />
        <KPI icon="kanban" color="var(--tv-accent)" label="Tarefas em aberto" value={k.tarefasAbertas} foot="em andamento" />
        <KPI icon="flag" color="var(--viol)" label="Projetos concluídos" value={k.projetosConcluidos} foot={`de ${k.projetosTotal} no portfólio`} />
        <KPI icon="users" color="var(--info)" label="Membros do time" value={k.membros} foot="no workspace" />
      </div>

      <div className="tv-grid" style={{ gridTemplateColumns: "1fr 1.1fr", gridTemplateRows: "none" }}>
        <Panel icon="kanban" title="Resumo do quadro" sub="Tarefas por coluna">
          <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", flex: 1 }}>
            {d.kanban.map((c) => (
              <div key={c.column}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--tv-ink-2)" }}>{c.label}</span>
                  <b className="tnum" style={{ fontSize: 22, color: COLC[c.column] }}>{c.n}</b>
                </div>
                <Bar value={(c.n / maxKan) * 100} color={COLC[c.column]} h={12} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon="bell" title="Atividade recente" sub="Últimos projetos e tarefas criados">
          <div className="tv-list">
            {d.recent.map((a: TvActivity) => (
              <div className="tv-row" key={a.id} style={{ gap: 14, padding: "13px 4px" }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, flex: "none", display: "grid", placeItems: "center", background: a.kind === "project" ? "color-mix(in srgb, var(--tv-accent) 16%, transparent)" : "color-mix(in srgb, var(--info) 16%, transparent)", color: a.kind === "project" ? "var(--tv-accent)" : "var(--info)" }}>
                  <Icon name={a.kind === "project" ? "folder" : "kanban"} size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.text}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 600, marginTop: 2 }}>{a.actor ? `${a.actor} · ` : ""}{relTime(a.at, nowMs)}</div>
                </div>
              </div>
            ))}
            {d.recent.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 16, padding: "14px 4px" }}>Sem atividade recente.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============ SLIDE — CRONOGRAMA (Gantt) ============ */
const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function SlideCronograma({ d }: { d: TvData; now: Date }) {
  const g = d.gantt;
  const bars = g.bars.slice(0, 9);
  return (
    <Panel icon="timeline" title={`Cronograma ${g.year}`} sub="Início → prazo de cada projeto" right="linha laranja = hoje" style={{ height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", marginBottom: 12 }}>
        <div />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)" }}>
          {MES.map((m) => <span key={m} style={{ fontSize: 12, fontWeight: 700, color: "var(--tv-muted)", textAlign: "center" }}>{m}</span>)}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "space-evenly", minHeight: 0 }}>
        {g.today !== null && (
          <div style={{ position: "absolute", top: -4, bottom: -4, left: `calc(260px + (100% - 260px) * ${g.today / 12})`, width: 2, background: "var(--tv-accent)", opacity: 0.8, zIndex: 2 }}>
            <span style={{ position: "absolute", top: -2, left: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--tv-accent)" }} />
          </div>
        )}
        {bars.map((b: TvGanttBar) => {
          const c = STATUS[b.status].c;
          return (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "260px 1fr", alignItems: "center", gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "var(--tv-muted)", fontWeight: 600 }}>{STATUS[b.status].label} · {b.progress}%</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", height: 30, background: "var(--tv-panel-2)", borderRadius: 8 }}>
                <div style={{ gridColumn: `${b.startCol + 1} / span ${b.span}`, background: `color-mix(in srgb, ${c} 28%, transparent)`, border: `1px solid ${c}`, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center" }}>
                  <div style={{ width: `${b.progress}%`, height: "100%", background: c, opacity: 0.9, borderRadius: 7 }} />
                </div>
              </div>
            </div>
          );
        })}
        {bars.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 17 }}>Nenhum projeto no período.</div>}
      </div>
    </Panel>
  );
}

/* Lista que rola sozinha (vertical) quando o conteúdo passa da altura; senão fica fixa. */
function AutoScroll<T>({ items, dep, gap = 14, render }: { items: T[]; dep: number; gap?: number; render: (it: T) => React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(false);
  const [dur, setDur] = useState(24);
  useEffect(() => {
    const w = wrap.current, i = inner.current;
    if (!w || !i) return;
    const over = i.scrollHeight / (scroll ? 2 : 1) - w.clientHeight;
    const s = over > 14;
    setScroll(s);
    if (s) setDur(Math.max(14, (i.scrollHeight / (scroll ? 2 : 1)) / 32));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  // Só fade na BORDA DE BAIXO (saída) e apenas quando rola — topo limpo, sem sombra no 1º item.
  const mask = scroll ? "linear-gradient(180deg,#000 0,#000 88%,transparent)" : "none";
  return (
    <div ref={wrap} style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", maskImage: mask, WebkitMaskImage: mask }}>
      <div ref={inner} className={scroll ? "tv-vscroll" : ""} style={{ display: "flex", flexDirection: "column", gap, ["--vdur" as string]: `${dur}s` } as React.CSSProperties}>
        {items.map((it, i) => <div key={"a" + i}>{render(it)}</div>)}
        {scroll && items.map((it, i) => <div key={"b" + i} aria-hidden>{render(it)}</div>)}
      </div>
    </div>
  );
}

/* ============ SLIDE — RESPONSÁVEIS + NOTAS (meia/meia) ============ */
function SlideEquipeNotas({ d }: { d: TvData; now: Date }) {
  const nowMs = +new Date(d.generatedAt);
  const people = d.assignees.slice(0, 7);
  const max = Math.max(1, ...people.map((p) => p.open));
  const noteRow = (n: TvNote) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <Av u={n.author} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15.5, fontWeight: 800 }}>{n.author.name}</span>
          <span className="tv-tag" style={{ fontSize: 11, color: n.kind === "note" ? "var(--tv-accent-2)" : "var(--info)" }}>{n.kind === "note" ? "nota" : "comentário"} · {n.context}</span>
          <span style={{ fontSize: 12, color: "var(--tv-muted)", fontWeight: 600 }}>{relTime(n.at, nowMs)}</span>
        </div>
        <div style={{ fontSize: 14.5, color: "var(--tv-ink-2)", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>
      </div>
    </div>
  );
  return (
    <div className="tv-grid" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "none" }}>
      <Panel icon="users" title="Tarefas por responsável" sub="Abertas (não concluídas) por pessoa" right={`${d.assignees.length}`}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
          {people.map((p: TvAssignee) => {
            const over = p.open >= 6;
            const c = over ? "var(--crit)" : p.open >= 3 ? "var(--warn)" : "var(--ok)";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Av u={{ name: p.name, initials: p.initials, color: p.color }} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.jobTitle}</div>
                </div>
                <div style={{ width: 100, flex: "none" }}><Bar value={(p.open / max) * 100} color={c} h={10} /></div>
                <div style={{ width: 84, textAlign: "right", flex: "none" }}>
                  <b className="tnum" style={{ fontSize: 22, color: c }}>{p.open}</b>
                  <span style={{ fontSize: 12, color: "var(--tv-muted)", fontWeight: 600 }}> ab.</span>
                </div>
              </div>
            );
          })}
          {people.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 16 }}>Ninguém com tarefas abertas.</div>}
        </div>
      </Panel>

      <Panel icon="msg" title="Notas & comentários" sub="Rolagem automática" right={`${d.notesFeed.length}`}>
        {d.notesFeed.length === 0
          ? <div style={{ color: "var(--tv-muted)", fontSize: 16, flex: 1, display: "grid", placeItems: "center" }}>Sem notas ou comentários ainda.</div>
          : <AutoScroll items={d.notesFeed} dep={d.notesFeed.length} render={noteRow} />}
      </Panel>
    </div>
  );
}

/* ============ SLIDE — PROJETO EM DESTAQUE (rotativo) ============ */
const KAN_LABEL: [keyof TvFeatured["kanban"], string, string][] = [
  ["todo", "A fazer", "var(--tv-muted)"],
  ["doing", "Em progresso", "var(--info)"],
  ["review", "Em revisão", "var(--viol)"],
  ["done", "Concluído", "var(--ok)"],
];
function SlideDestaque({ d, now }: { d: TvData; now: Date }) {
  const list = d.featured;
  if (list.length === 0) {
    return <Panel icon="star" title="Projeto em destaque" style={{ height: "100%" }}><div style={{ color: "var(--tv-muted)", fontSize: 18 }}>Nenhum projeto ativo.</div></Panel>;
  }
  const p = list[Math.floor(now.getTime() / 15000) % list.length];
  return (
    <div className="tv-grid" style={{ gridTemplateColumns: "1.15fr 1fr", gridTemplateRows: "none" }}>
      <Panel icon="star" title="Projeto em destaque" sub={`Rodando ${(list.findIndex((x) => x.id === p.id) + 1)} de ${list.length}`}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ marginBottom: 6 }}><Status status={p.status} /></div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.05 }}>{p.name}</div>
          <div style={{ fontSize: 16, color: "var(--tv-muted)", fontWeight: 600, marginTop: 6 }}>{p.client}</div>
          <div style={{ marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
              <span className="tnum" style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-3px", color: "var(--tv-accent)", lineHeight: 0.9 }}>{p.progress}%</span>
              <span style={{ fontSize: 17, color: "var(--tv-muted)", fontWeight: 700 }}>concluído · {p.tasksDone}/{p.tasksTotal} tarefas</span>
            </div>
            <Bar value={p.progress} color="var(--tv-accent)" h={14} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 22 }}>
              {KAN_LABEL.map(([k, label, c]) => (
                <div key={k} style={{ background: "var(--tv-panel-2)", border: "1px solid var(--tv-line)", borderRadius: 12, padding: "14px 16px" }}>
                  <div className="tnum" style={{ fontSize: 28, fontWeight: 800, color: c }}>{p.kanban[k]}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 700, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="tv-grid" style={{ gridTemplateRows: "1fr 1fr", gap: 22 }}>
        <Panel icon="users" color="var(--info)" title="Equipe" right={`${p.members.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "center" }}>
            {p.members.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Av u={m} size={42} />
                <span style={{ fontSize: 17, fontWeight: 700 }}>{m.name}</span>
              </div>
            ))}
            {p.members.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 15 }}>Sem membros.</div>}
          </div>
        </Panel>
        <Panel icon="flag" color="var(--viol)" title="Marcos" right={`${p.milestones.length}`}>
          <div className="tv-list">
            {p.milestones.map((m, i) => (
              <div className="tv-row" key={i} style={{ gap: 14, padding: "12px 4px" }}>
                <span style={{ width: 13, height: 13, borderRadius: "50%", border: "3px solid var(--viol)", background: m.state === "todo" ? "transparent" : "var(--viol)", flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                <span className="tv-badge tnum" style={{ color: "var(--tv-ink-2)", background: "var(--tv-panel-2)" }}><Icon name="calendar" size={13} />{dayMonth(m.date)}</span>
              </div>
            ))}
            {p.milestones.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 15, padding: "10px 4px" }}>Nenhum marco cadastrado.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============ SLIDE — COMERCIAL (IXC) ============ */
function SlideComercial({ d }: { d: TvData; now: Date }) {
  const c = d.comercial;
  if (!c) return <Panel icon="briefcase" title="Comercial" style={{ height: "100%" }}><div style={{ color: "var(--tv-muted)", fontSize: 18 }}>Integração IXC não configurada.</div></Panel>;
  const maxMrr = Math.max(1, ...c.ranking.map((r) => r.mrrCents));
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "188px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="briefcase" color="var(--ok)" label="Contratos ativos (carteira)" value={c.ativosCarteira} foot="base ativa no IXC" />
        <KPI icon="checkCircle" color="var(--tv-accent)" label="Ativados no mês" value={c.ativadosMes} foot={`${brl(c.mrrAtivadosMesCents)} em MRR`} />
        <KPI icon="target" color="var(--info)" label="Pipeline (aguardando)" value={c.pipeline} foot={`${brl(c.mrrPipelineCents)} em potencial`} />
        <KPI icon="users" color="var(--viol)" label="Vendedores no ranking" value={c.ranking.length} foot="com contratos no mês" />
      </div>

      <Panel icon="trendUp" title="Ranking de vendedores" sub="Ativados e MRR no mês" right={`${c.ranking.length}`}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
          {c.ranking.map((r, i) => (
            <div key={r.nome} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="tnum" style={{ width: 38, fontSize: 22, fontWeight: 800, color: i === 0 ? "var(--tv-accent)" : "var(--tv-muted)", flex: "none" }}>{i + 1}º</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                <div style={{ width: "100%", marginTop: 6 }}><Bar value={(r.mrrCents / maxMrr) * 100} color="var(--ok)" h={9} /></div>
              </div>
              <div style={{ width: 110, textAlign: "right", flex: "none" }}>
                <b className="tnum" style={{ fontSize: 19 }}>{brl(r.mrrCents)}</b>
                <div style={{ fontSize: 12.5, color: "var(--tv-muted)", fontWeight: 600 }}>{r.ativos} ativos</div>
              </div>
            </div>
          ))}
          {c.ranking.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 16 }}>Sem contratos no mês.</div>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- carrossel + shell ---------- */
const BASE_SLIDES = [
  { key: "panorama", kicker: "PAINEL 01", name: "Panorama geral", Comp: SlidePanorama },
  { key: "prazos", kicker: "PAINEL 02", name: "Prazos & tarefas", Comp: SlidePrazos },
  { key: "cronograma", kicker: "PAINEL 03", name: "Cronograma", Comp: SlideCronograma },
  { key: "destaque", kicker: "PAINEL 04", name: "Projeto em destaque", Comp: SlideDestaque },
  { key: "atividade", kicker: "PAINEL 05", name: "Quadro & atividade", Comp: SlideAtividade },
  { key: "equipe", kicker: "PAINEL 06", name: "Responsáveis & notas", Comp: SlideEquipeNotas },
] as const;
type Slide = { key: string; kicker: string; name: string; Comp: (p: { d: TvData; now: Date }) => React.ReactNode };
const COMERCIAL_SLIDE: Slide = { key: "comercial", kicker: "PAINEL 07", name: "Comercial (IXC)", Comp: SlideComercial };
const INTERVAL = 15000;
const REFRESH_MS = 30000;

export function TvBoard({ initial, tvKey }: { initial: TvData; tvKey: string }) {
  const [data, setData] = useState<TvData>(initial);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const canvasRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const footFillRef = useRef<HTMLElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  // Inclui o painel comercial só quando há dados de IXC.
  const slides = useMemo<Slide[]>(() => (data.comercial ? [...BASE_SLIDES, COMERCIAL_SLIDE] : [...BASE_SLIDES]), [data.comercial]);
  const slidesLenRef = useRef(slides.length);
  useEffect(() => { slidesLenRef.current = slides.length; }, [slides.length]);

  // opções via URL (?screen= fixa inicial, ?rotate=0 congela)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("screen");
    const i = s ? slides.findIndex((x) => x.key === s) : -1;
    if (i >= 0) setIdx(i);
    if (p.get("rotate") === "0" || p.get("rotate") === "false") setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // escala o canvas 1920x1080 pra caber na viewport (letterbox)
  useEffect(() => {
    const fit = () => {
      const el = canvasRef.current;
      if (!el) return;
      // preenche 100% da tela (sem barra preta). Em TV 16:9 sx==sy (sem distorção);
      // fora de 16:9 estica de leve, mas não sobra preto.
      const sx = window.innerWidth / 1920;
      const sy = window.innerHeight / 1080;
      el.style.transform = `translate(-50%, -50%) scale(${sx}, ${sy})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // refetch periódico
  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/tv/data?key=${encodeURIComponent(tvKey)}`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch { /* mantém dados atuais */ }
  }, [tvKey]);
  useEffect(() => {
    const t = setInterval(refetch, REFRESH_MS);
    return () => clearInterval(t);
  }, [refetch]);

  useEffect(() => { pausedRef.current = paused; if (paused && countRef.current) countRef.current.textContent = "pausado"; }, [paused]);

  // Carrossel (rAF): anima a barra/contador via REFS (sem setState por frame, pra não
  // re-renderizar tudo 60×/s e travar). setIdx só uma vez por slide (no fim do tempo).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    startRef.current = performance.now();
    const setBars = (p: number) => {
      if (footFillRef.current) footFillRef.current.style.width = `${(p * 100).toFixed(2)}%`;
    };
    const tick = (t: number) => {
      if (!pausedRef.current) {
        const p = Math.min(1, (t - startRef.current) / INTERVAL);
        setBars(p);
        if (countRef.current) countRef.current.textContent = `próximo em ${Math.max(0, Math.ceil((1 - p) * (INTERVAL / 1000)))}s`;
        if (p >= 1) { startRef.current = t; setBars(0); setIdx((i) => (i + 1) % slidesLenRef.current); }
      } else {
        // congela: empurra o início junto com o tempo → (t - start) constante
        startRef.current += t - last;
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goto = useCallback((i: number) => {
    const n = slidesLenRef.current;
    setIdx(((i % n) + n) % n);
    startRef.current = performance.now();
    if (footFillRef.current) footFillRef.current.style.width = "0%";
  }, []);

  // teclado: ← → navega, espaço pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goto(idx + 1);
      else if (e.key === "ArrowLeft") goto(idx - 1);
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, goto]);

  const safeIdx = idx < slides.length ? idx : 0; // mantém índice válido se a lista mudar
  const cur = slides[safeIdx];

  return (
    <div className="tv-root">
      <div className="tv-stage">
        <div className="tv-canvas" ref={canvasRef}>
          {/* Top bar */}
          <div className="tv-top">
            <div className="tv-logo"><Icon name="layers" size={30} /></div>
            <div className="tv-brand">OpenBoard<small>Painel operacional · Workspace {data.workspaceName}</small></div>
            <div className="tv-slide-name">
              <div className="k">{cur.kicker}</div>
              <div className="t">{cur.name}</div>
            </div>
            <div className="tv-live">
              <span className="tv-pill"><span className="tv-dotlive" /> AO VIVO</span>
              <div className="tv-clock">
                <div className="t tnum" suppressHydrationWarning>{fmtClock(now)}</div>
                <div className="d" suppressHydrationWarning>{fmtDate(now)}</div>
              </div>
            </div>
          </div>

          {/* Slides */}
          <div className="tv-body">
            {slides.map((s, i) => {
              const S = s.Comp;
              return (
                <div key={s.key} className={`tv-slide ${i === safeIdx ? "on" : ""}`} aria-hidden={i !== safeIdx}>
                  {i === safeIdx && <S d={data} now={now} />}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="tv-foot">
            <span className="lbl">{String(safeIdx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
            <div className="tv-prog"><i ref={footFillRef} style={{ width: "0%" }} /></div>
            <span className="lbl" ref={countRef} style={{ minWidth: 110, textAlign: "right" }}>próximo em 15s</span>
            <button className="tv-pause" onClick={() => setPaused((p) => !p)} title="Pausar (espaço)">
              <Icon name={paused ? "play" : "pause"} size={20} />
            </button>
            <div className="tv-dots">
              {slides.map((s, i) => <button key={s.key} className={i === safeIdx ? "on" : ""} onClick={() => goto(i)} title={s.name} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
