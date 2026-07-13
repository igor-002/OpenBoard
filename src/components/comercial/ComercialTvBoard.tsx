"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { brl } from "@/lib/format";
import type { ComercialTvData } from "@/server/comercial/tv";
import { withBasePath } from "@/lib/basePath";

/* ---------- helpers visuais (mesma linguagem do /tv) ---------- */
function fmtClock(d: Date) { return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function fmtDate(d: Date) { const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }); return s.charAt(0).toUpperCase() + s.slice(1); }

const LEAD_COR: Record<string, string> = {
  contato: "var(--warn)", proposta: "var(--tv-accent)", ganho: "var(--ok)", perdido: "var(--crit)",
};

function Panel({ icon, color = "var(--tv-accent)", title, sub, right, children, style }: {
  icon: IconName; color?: string; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section className="tv-panel" style={style}>
      <div className="tv-panel-h">
        <span className="ic" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Icon name={icon} size={20} /></span>
        <div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
        {right && <div className="right">{right}</div>}
      </div>
      {children}
    </section>
  );
}
function KPI({ icon, color = "var(--tv-accent)", label, value, foot }: { icon: IconName; color?: string; label: string; value: string | number; foot: string }) {
  return (
    <div className="tv-kpi" style={{ color }}>
      <div className="top"><span className="lab">{label}</span><span className="ico" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Icon name={icon} size={23} /></span></div>
      <div className="val" style={{ fontWeight: 900 }}>{value}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}
function Bar({ value, color, h = 9 }: { value: number; color?: string; h?: number }) {
  return <div className="tv-bar" style={{ height: h }}><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color || "var(--tv-accent)" }} /></div>;
}

// Anel de progresso (gauge) em SVG — preenche o painel com um número grande no centro.
function Gauge({ pct, color, size = 300, stroke = 30, center, foot }: { pct: number; color: string; size?: number; stroke?: number; center: React.ReactNode; foot?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tv-panel-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${filled} ${circ - filled}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>{center}{foot && <div style={{ fontSize: 16, color: "var(--tv-muted)", fontWeight: 700, marginTop: 6 }}>{foot}</div>}</div>
      </div>
    </div>
  );
}

/* ============ SLIDE 1 — PANORAMA DO MÊS ============ */
function SlidePanorama({ d }: { d: ComercialTvData }) {
  const k = d.kpis;
  const totalPipe = k.ativadosMes + k.pipeline;
  const conversao = totalPipe > 0 ? Math.round((k.ativadosMes / totalPipe) * 100) : 0;
  const maxMrr = Math.max(1, ...d.ranking.map((r) => r.mrrCents));
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "210px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="briefcase" color="var(--tv-accent)" label="Vendas no mês" value={k.vendasMes} foot="contratos vendidos (cadastro)" />
        <KPI icon="checkCircle" color="var(--ok)" label="Ativações no mês" value={k.ativadosMes} foot={`${brl(k.mrrAtivadosMesCents)} em MRR novo${k.ativacoesOutroMes > 0 ? ` · ${k.ativacoesOutroMes} de outro mês` : ""}`} />
        <KPI icon="target" color="var(--info)" label="Pipeline (aguardando)" value={k.pipeline} foot={`${brl(k.mrrPipelineCents)} em potencial`} />
        <KPI icon="wallet" color="var(--viol)" label="Ticket médio" value={brl(k.ticketMedioCents)} foot={`MRR por contrato · ${conversao}% conv.`} />
      </div>
      <Panel icon="trendUp" title="Ranking de vendedores" sub="MRR novo e contratos ativados no mês" right={`${d.ranking.length} no mês`}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
          {d.ranking.map((r, i) => (
            <div key={r.nome} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span className="tnum" style={{ width: 44, fontSize: 26, fontWeight: 800, color: i === 0 ? "var(--tv-accent)" : i === 1 ? "var(--tv-ink-2)" : "var(--tv-muted)", flex: "none" }}>{i + 1}º</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 7 }}>{r.nome}</div>
                <Bar value={(r.mrrCents / maxMrr) * 100} color={i === 0 ? "var(--tv-accent)" : "var(--ok)"} h={13} />
              </div>
              <div style={{ width: 190, textAlign: "right", flex: "none" }}>
                <b className="tnum" style={{ fontSize: 26, fontWeight: 900 }}>{brl(r.mrrCents)}</b>
                <div style={{ fontSize: 14, color: "var(--tv-muted)", fontWeight: 800 }}>{r.ativos} ativos · {r.conversao}% conv.</div>
              </div>
            </div>
          ))}
          {d.ranking.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 18 }}>Sem contratos no mês.</div>}
        </div>
      </Panel>
    </div>
  );
}

/* ============ SLIDE 2 — META, FORECAST & ATIVAÇÃO ============ */
function SlideMeta({ d }: { d: ComercialTvData }) {
  const meta = d.meta;
  const t = d.tempoAtivacao;
  const pct = meta?.pct ?? 0;
  const cor = pct >= 100 ? "var(--ok)" : pct >= 50 ? "var(--warn)" : "var(--tv-accent)";
  const du = d.diasUteis;
  return (
    <div className="tv-grid" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "none" }}>
      <Panel icon="target" title="Meta do time" sub={meta ? "Contratos ativados no mês" : "Sem meta cadastrada"}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {meta ? (
            <Gauge
              pct={pct} color={cor} size={400} stroke={38}
              center={<>
                <div className="tnum" style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-5px", color: cor, lineHeight: 0.9 }}>{pct}%</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--tv-ink-2)", marginTop: 8 }}>{meta.ativos} / {meta.metaContratos}</div>
              </>}
              foot="contratos da meta"
            />
          ) : <div style={{ color: "var(--tv-muted)", fontSize: 20 }}>Cadastre a meta em MRR &amp; Metas.</div>}
        </div>
      </Panel>
      <div className="tv-grid" style={{ gridTemplateRows: "1fr 1fr", gap: 22 }}>
        <Panel icon="trendUp" color="var(--info)" title="Forecast de MRR" sub={d.forecastCents != null ? "Projeção pro fim do mês (ritmo atual)" : "Disponível só no mês atual"}>
          {d.forecastCents != null ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 18 }}>
              <div className="tnum" style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-3px", color: "var(--info)", lineHeight: 0.9 }}>{brl(d.forecastCents)}</div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 16, color: "var(--tv-muted)", fontWeight: 700 }}>Dias úteis do mês</span>
                  <b className="tnum" style={{ fontSize: 18 }}>{du.passados}/{du.total}</b>
                </div>
                <Bar value={du.total > 0 ? (du.passados / du.total) * 100 : 0} color="var(--info)" h={13} />
              </div>
              <div style={{ fontSize: 17, color: "var(--tv-ink-2)", fontWeight: 600 }}>
                Hoje: <b>{brl(d.kpis.mrrAtivadosMesCents)}</b> em {d.kpis.ativadosMes} ativações{d.forecastAtivacoes != null ? ` · ritmo projeta ${d.forecastAtivacoes} contratos` : ""}
              </div>
            </div>
          ) : <div style={{ color: "var(--tv-muted)", fontSize: 18, display: "grid", placeItems: "center", flex: 1 }}>—</div>}
        </Panel>
        <Panel icon="clock" color="var(--warn)" title="Tempo de ativação" sub={t ? `Do cadastro à ativação · ${t.n} contratos` : "Do cadastro à ativação"}>
          {t ? (
            <div style={{ display: "flex", justifyContent: "space-around", flex: 1, alignItems: "center" }}>
              {[["Média", t.mediaDias, "var(--tv-ink)"], ["Mais rápido", t.melhorDias, "var(--ok)"], ["Mais lento", t.piorDias, "var(--crit)"]].map(([lab, val, c]) => (
                <div key={lab as string} style={{ textAlign: "center" }}>
                  <div className="tnum" style={{ fontSize: 60, fontWeight: 800, color: c as string, lineHeight: 1 }}>{val as number}</div>
                  <div style={{ fontSize: 15, color: "var(--tv-muted)", fontWeight: 700, marginTop: 4 }}>{lab as string}</div>
                  <div style={{ fontSize: 12.5, color: "var(--tv-muted-2)", fontWeight: 600 }}>dias</div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: "var(--tv-muted)", fontSize: 18, display: "grid", placeItems: "center", flex: 1 }}>Sem ativações no período.</div>}
        </Panel>
      </div>
    </div>
  );
}

/* ============ SLIDE 3 — PIPELINE & ALERTAS ============ */
function SlidePipeline({ d }: { d: ComercialTvData }) {
  const cards = d.pipeline.slice(0, 7); // menos linhas, cada uma maior
  const alertas = d.alertas.slice(0, 6);
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "210px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="layers" color="var(--info)" label="Em negociação" value={d.kpis.pipeline} foot="contratos aguardando" />
        <KPI icon="wallet" color="var(--tv-accent)" label="MRR potencial" value={brl(d.kpis.mrrPipelineCents)} foot="se tudo fechar" />
        <KPI icon="alert" color="var(--crit)" label="Parados +7 dias" value={d.alertas.length} foot="precisam de cobrança" />
      </div>
      <div className="tv-grid" style={{ gridTemplateColumns: "1.4fr 1fr", gridTemplateRows: "none" }}>
        <Panel icon="layers" title="Pipeline — aguardando assinatura" sub="Mais parados no topo">
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
            {cards.map((c) => (
              <div key={c.ixcId} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ width: 90, textAlign: "center", flex: "none" }}>
                  <div className="tnum" style={{ fontSize: 40, fontWeight: 900, color: c.dias > 15 ? "var(--crit)" : "var(--warn)", lineHeight: 1 }}>{c.dias}</div>
                  <div style={{ fontSize: 12, color: "var(--tv-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px" }}>dias</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.clienteNome}</div>
                  <div style={{ fontSize: 15, color: "var(--tv-muted)", fontWeight: 700 }}>{c.vendedorNome ?? "—"}</div>
                </div>
                <b className="tnum" style={{ fontSize: 26, fontWeight: 900, flex: "none" }}>{c.mrrCents ? brl(c.mrrCents) : "—"}</b>
              </div>
            ))}
            {cards.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 18, padding: "14px 4px" }}>Pipeline vazio.</div>}
          </div>
        </Panel>
        <Panel icon="alert" color="var(--crit)" title="Cobrar fechamento" sub="Aguardando há +7 dias">
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span className="dotpulse" style={{ width: 12, height: 12, borderRadius: "50%", background: a.dias > 15 ? "var(--crit)" : "var(--warn)", flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.clienteNome}</div>
                  <div style={{ fontSize: 14, color: "var(--tv-muted)", fontWeight: 700 }}>{a.vendedorNome ?? "—"}</div>
                </div>
                <span className="tnum" style={{ fontSize: 28, fontWeight: 900, color: a.dias > 15 ? "var(--crit)" : "var(--warn)", flex: "none" }}>{a.dias}<small style={{ fontSize: 15, fontWeight: 800 }}>d</small></span>
              </div>
            ))}
            {alertas.length === 0 && <div style={{ color: "var(--ok)", fontSize: 18, fontWeight: 800, padding: "14px 4px" }}>✓ Nada parado.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============ SLIDE 4 — EVOLUÇÃO & CARTEIRA ============ */
function SlideEvolucao({ d }: { d: ComercialTvData }) {
  const maxEvo = Math.max(1, ...d.evolucao.map((m) => Math.max(m.ativos, m.aguardando)));
  const totalAtivados = d.evolucao.reduce((a, m) => a + m.ativos, 0);
  const cart = d.carteira;
  const maxCart = Math.max(1, cart.ativos, cart.pipeline, cart.bloqueados, cart.cancelados, cart.inativosD);
  const cartRows: [string, number, string][] = [
    ["Ativos", cart.ativos, "var(--ok)"], ["Pipeline", cart.pipeline, "var(--info)"],
    ["Bloqueados", cart.bloqueados, "var(--warn)"], ["Cancelados", cart.cancelados, "var(--crit)"],
    ["Inativos (D)", cart.inativosD, "var(--tv-muted)"],
  ];
  const legenda = (
    <div className="row gap16" style={{ alignItems: "center" }}>
      <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 13, height: 13, borderRadius: 4, background: "var(--ok)" }} /><span style={{ fontSize: 15, fontWeight: 800, color: "var(--tv-ink-2)" }}>Ativados</span></span>
      <span className="row gap8" style={{ alignItems: "center" }}><span style={{ width: 13, height: 13, borderRadius: 4, background: "var(--info)" }} /><span style={{ fontSize: 15, fontWeight: 800, color: "var(--tv-ink-2)" }}>Aguardando</span></span>
    </div>
  );
  return (
    <div className="tv-grid" style={{ gridTemplateColumns: "1.45fr 1fr", gridTemplateRows: "none" }}>
      <Panel icon="chart" title="Evolução de vendas" sub={`Últimos 6 meses · ${totalAtivados} ativados no período`} right={legenda}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22, flex: 1, padding: "18px 6px 0" }}>
          {d.evolucao.map((m) => (
            <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10 }}>
                {[["ativados", m.ativos, "var(--ok)"], ["aguardando", m.aguardando, "var(--info)"]].map(([key, val, c]) => (
                  <div key={key as string} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", flex: 1, maxWidth: 56 }}>
                    <span className="tnum" style={{ fontSize: 24, fontWeight: 900, color: c as string, marginBottom: 6 }}>{val as number}</span>
                    <div style={{ width: "100%", height: `${((val as number) / maxEvo) * 100}%`, background: c as string, borderRadius: "7px 7px 0 0", minHeight: (val as number) ? 5 : 0 }} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 17, color: "var(--tv-ink-2)", fontWeight: 800 }}>{m.label}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon="briefcase" color="var(--info)" title="Carteira (base total)" sub="Desativados ficam fora das vendas">
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
          {cartRows.map(([lab, val, c]) => (
            <div key={lab} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 150, fontSize: 17, fontWeight: 800, color: "var(--tv-ink-2)", flex: "none" }}>{lab}</span>
              <div style={{ flex: 1 }}><Bar value={(val / maxCart) * 100} color={c} h={14} /></div>
              <b className="tnum" style={{ fontSize: 30, fontWeight: 900, width: 110, textAlign: "right", flex: "none", color: c }}>{val.toLocaleString("pt-BR")}</b>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ============ SLIDE 5 — RANKING (tabela) ============ */
function SlideRanking({ d }: { d: ComercialTvData }) {
  return (
    <Panel icon="trendUp" title="Performance por vendedor" sub="Resultado real do IXC no mês" right={`${d.ranking.length} no mês`} style={{ height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 150px 230px 120px", gap: 12, padding: "0 8px 10px", fontSize: 13, fontWeight: 700, color: "var(--tv-muted)", textTransform: "uppercase", letterSpacing: ".5px", borderBottom: "1px solid var(--tv-line)" }}>
          <span>#</span><span>Vendedor</span><span style={{ textAlign: "right" }}>Ativos</span><span style={{ textAlign: "right" }}>Aguard.</span><span style={{ textAlign: "right" }}>MRR</span><span style={{ textAlign: "right" }}>Conv.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly" }}>
          {d.ranking.map((r, i) => (
            <div key={r.nome} style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 150px 230px 120px", gap: 12, padding: "0 8px", alignItems: "center" }}>
              <span className="tnum" style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? "var(--tv-accent)" : "var(--tv-muted)" }}>{i + 1}º</span>
              <span style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</span>
              <b className="tnum" style={{ fontSize: 20, textAlign: "right", color: "var(--ok)" }}>{r.ativos}</b>
              <span className="tnum" style={{ fontSize: 18, textAlign: "right", color: "var(--info)" }}>{r.aguardando}</span>
              <b className="tnum" style={{ fontSize: 19, textAlign: "right" }}>{brl(r.mrrCents)}</b>
              <span className="tnum" style={{ fontSize: 18, textAlign: "right", color: "var(--tv-ink-2)" }}>{r.conversao}%</span>
            </div>
          ))}
          {d.ranking.length === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 17 }}>Sem dados no mês.</div>}
        </div>
      </div>
    </Panel>
  );
}

/* ============ SLIDE 6 — FUNIL DE LEADS ============ */
function SlideLeads({ d }: { d: ComercialTvData }) {
  const maxLead = Math.max(1, ...d.leads.map((s) => s.total));
  const valorTotal = d.leads.reduce((a, s) => a + s.valorCents, 0);
  const ganhos = d.leads.find((s) => s.id === "ganho")?.total ?? 0;
  return (
    <div className="tv-grid" style={{ gridTemplateRows: "210px 1fr" }}>
      <div className="tv-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "none" }}>
        <KPI icon="target" color="var(--info)" label="Leads no funil" value={d.leadsTotal} foot="vindos do chat de atendimento" />
        <KPI icon="wallet" color="var(--tv-accent)" label="Valor estimado" value={brl(valorTotal)} foot="potencial em negociação" />
        <KPI icon="checkCircle" color="var(--ok)" label="Aprovados" value={ganhos} foot="convertidos" />
      </div>
      <Panel icon="target" title="Funil de Leads" sub="Cards no Kanban comercial (vêm do chat de atendimento)" right={`${d.leadsTotal} leads`}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-evenly", minHeight: 0 }}>
          {d.leads.map((s) => {
            const cor = LEAD_COR[s.id] ?? "var(--tv-accent)";
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ width: 220, fontSize: 24, fontWeight: 800, color: "var(--tv-ink)", flex: "none" }}>{s.label}</span>
                <div style={{ flex: 1 }}><Bar value={(s.total / maxLead) * 100} color={cor} h={26} /></div>
                <b className="tnum" style={{ fontSize: 44, fontWeight: 900, width: 90, textAlign: "right", flex: "none", color: cor, lineHeight: 1 }}>{s.total}</b>
                <span className="tnum" style={{ fontSize: 18, width: 150, textAlign: "right", color: "var(--tv-muted)", fontWeight: 800, flex: "none" }}>{s.valorCents ? brl(s.valorCents) : "—"}</span>
              </div>
            );
          })}
          {d.leadsTotal === 0 && <div style={{ color: "var(--tv-muted)", fontSize: 19, display: "grid", placeItems: "center", flex: 1 }}>Nenhum lead ainda. O chat de atendimento alimenta este funil.</div>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- carrossel + shell (mesma mecânica do /tv) ---------- */
const SLIDES = [
  { key: "panorama", kicker: "PAINEL 01", name: "Panorama comercial", Comp: SlidePanorama },
  { key: "meta", kicker: "PAINEL 02", name: "Meta, forecast & ativação", Comp: SlideMeta },
  { key: "pipeline", kicker: "PAINEL 03", name: "Pipeline & cobrança", Comp: SlidePipeline },
  { key: "evolucao", kicker: "PAINEL 04", name: "Evolução & carteira", Comp: SlideEvolucao },
  { key: "ranking", kicker: "PAINEL 05", name: "Ranking de vendedores", Comp: SlideRanking },
  { key: "leads", kicker: "PAINEL 06", name: "Funil de Leads", Comp: SlideLeads },
] as const;
const INTERVAL = 15000;
const REFRESH_MS = 30000;

export function ComercialTvBoard({ initial, tvKey }: { initial: ComercialTvData; tvKey: string }) {
  const [data, setData] = useState<ComercialTvData>(initial);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const canvasRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const footFillRef = useRef<HTMLElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("screen");
    const i = s ? SLIDES.findIndex((x) => x.key === s) : -1;
    if (i >= 0) setIdx(i);
    if (p.get("rotate") === "0" || p.get("rotate") === "false") setPaused(true);
  }, []);

  useEffect(() => {
    const fit = () => {
      const el = canvasRef.current;
      if (!el) return;
      // Escala uniforme (letterbox): em telas fora de 16:9 sobra borda preta em
      // vez de esticar/distorcer o conteúdo. TV 16:9 preenche exato.
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      el.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(withBasePath(`/api/tv/comercial?key=${encodeURIComponent(tvKey)}`), { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch { /* mantém dados atuais */ }
  }, [tvKey]);
  useEffect(() => { const t = setInterval(refetch, REFRESH_MS); return () => clearInterval(t); }, [refetch]);

  useEffect(() => { pausedRef.current = paused; if (paused && countRef.current) countRef.current.textContent = "pausado"; }, [paused]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    startRef.current = performance.now();
    const setBars = (p: number) => { if (footFillRef.current) footFillRef.current.style.width = `${(p * 100).toFixed(2)}%`; };
    const tick = (t: number) => {
      if (!pausedRef.current) {
        const p = Math.min(1, (t - startRef.current) / INTERVAL);
        setBars(p);
        if (countRef.current) countRef.current.textContent = `próximo em ${Math.max(0, Math.ceil((1 - p) * (INTERVAL / 1000)))}s`;
        if (p >= 1) { startRef.current = t; setBars(0); setIdx((i) => (i + 1) % SLIDES.length); }
      } else {
        startRef.current += t - last;
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goto = useCallback((i: number) => {
    setIdx(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
    startRef.current = performance.now();
    if (footFillRef.current) footFillRef.current.style.width = "0%";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goto(idx + 1);
      else if (e.key === "ArrowLeft") goto(idx - 1);
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, goto]);

  const cur = SLIDES[idx];

  if (!data.configured) {
    return (
      <div className="tv-root"><div className="tv-stage"><div className="tv-canvas" ref={canvasRef}>
        <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--tv-muted)", fontSize: 22 }}>Integração IXC não configurada.</div>
      </div></div></div>
    );
  }

  return (
    <div className="tv-root">
      <div className="tv-stage">
        <div className="tv-canvas" ref={canvasRef}>
          <div className="tv-top">
            <div className="tv-logo"><Icon name="briefcase" size={30} /></div>
            <div className="tv-brand">Comercial<small>Painel comercial · IXC · {data.mesLabel}</small></div>
            <div className="tv-slide-name"><div className="k">{cur.kicker}</div><div className="t">{cur.name}</div></div>
            <div className="tv-live">
              <span className="tv-pill"><span className="tv-dotlive" /> AO VIVO</span>
              <div className="tv-clock">
                <div className="t tnum" suppressHydrationWarning>{fmtClock(now)}</div>
                <div className="d" suppressHydrationWarning>{fmtDate(now)}</div>
              </div>
            </div>
          </div>

          <div className="tv-body">
            {SLIDES.map((s, i) => {
              const S = s.Comp;
              return <div key={s.key} className={`tv-slide ${i === idx ? "on" : ""}`} aria-hidden={i !== idx}>{i === idx && <S d={data} />}</div>;
            })}
          </div>

          <div className="tv-foot">
            <span className="lbl">{String(idx + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}</span>
            <div className="tv-prog"><i ref={footFillRef} style={{ width: "0%" }} /></div>
            <span className="lbl" ref={countRef} style={{ minWidth: 110, textAlign: "right" }}>próximo em 15s</span>
            <button className="tv-pause" onClick={() => setPaused((p) => !p)} title="Pausar (espaço)"><Icon name={paused ? "play" : "pause"} size={20} /></button>
            <div className="tv-dots">{SLIDES.map((s, i) => <button key={s.key} className={i === idx ? "on" : ""} onClick={() => goto(i)} title={s.name} />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
