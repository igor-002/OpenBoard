// Relatórios do funil de Leads. Server-only.
// Tudo calculado do banco (Lead + LeadStageEvent) — nenhum número inventado.
// Tempo em fila: Lead.stageChangedAt (estágio atual) + LeadStageEvent (histórico).
import "server-only";
import { db } from "@/lib/db";
import { LEAD_STAGES, LEAD_STAGE_PROB, type LeadStage } from "@/lib/leads";

const DAY = 86_400_000;
const ATIVOS: LeadStage[] = ["contato", "proposta"];
// funil de conversão (perdido fica fora — é saída, não etapa)
const FUNIL: LeadStage[] = ["contato", "proposta", "ganho"];

export type LeadsStats = {
  kpis: {
    ativos: number;
    valorAbertoCents: number;
    ganhos30d: number;
    valorGanho30dCents: number;
    perdidos30d: number;
    taxaConversao: number | null; // ganho / (ganho + perdido), histórico todo
    cicloMedioDias: number | null; // entrada no funil → ganho
    paradosMais7d: number; // ativos há +7 dias no mesmo estágio
    forecastCents: number; // Σ valorEstimado × prob do estágio (leads ativos)
  };
  porEstagio: { id: LeadStage; label: string; c: string; count: number; valorCents: number; mediaDias: number | null; maxDias: number | null }[];
  funil: { id: LeadStage; label: string; c: string; reached: number; pct: number }[];
  tempoMedioEstagio: { id: LeadStage; label: string; c: string; mediaDias: number | null; amostras: number }[];
  aging: { id: string; nome: string; empresa: string | null; stage: LeadStage; dias: number; assignedUserName: string | null; valorCents: number; semContatoDias: number }[];
  porResponsavel: { name: string; ativos: number; ganhos: number; perdidos: number; valorAbertoCents: number; conversao: number | null }[];
  porOrigem: { origem: string; total: number; ativos: number; ganhos: number; perdidos: number; valorGanhoCents: number; conversao: number | null }[];
  entradaSemanas: { label: string; novos: number; ganhos: number }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getLeadsStats(): Promise<LeadsStats> {
  const now = Date.now();
  const [leads, events] = await Promise.all([
    db.lead.findMany(),
    db.leadStageEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const uids = [...new Set(leads.map((l) => l.assignedUserId).filter((x): x is string => !!x))];
  const users = uids.length ? await db.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.name]));

  const stageOf = (s: string): LeadStage => (LEAD_STAGES.some((x) => x.id === s) ? (s as LeadStage) : "contato");
  const isAtivo = (s: string) => (ATIVOS as string[]).includes(s);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const ativos = leads.filter((l) => isAtivo(l.stage));
  const ganhos = leads.filter((l) => l.stage === "ganho");
  const perdidos = leads.filter((l) => l.stage === "perdido");
  const d30 = now - 30 * DAY;
  const ganhos30 = ganhos.filter((l) => l.stageChangedAt.getTime() >= d30);
  const fechados = ganhos.length + perdidos.length;

  // ciclo médio: evento de entrada (fromStage null) → evento toStage=ganho, por lead
  const entradaPorLead = new Map<string, number>();
  const ganhoPorLead = new Map<string, number>();
  for (const e of events) {
    if (e.fromStage === null && !entradaPorLead.has(e.leadId)) entradaPorLead.set(e.leadId, e.createdAt.getTime());
    if (e.toStage === "ganho") ganhoPorLead.set(e.leadId, e.createdAt.getTime()); // último ganho vale
  }
  const ciclos: number[] = [];
  for (const [leadId, t] of ganhoPorLead) {
    const ini = entradaPorLead.get(leadId);
    if (ini != null && t > ini) ciclos.push((t - ini) / DAY);
  }

  // ── Por estágio (foto atual): contagem, valor, tempo na fila ────────────────
  const porEstagio = LEAD_STAGES.map((s) => {
    const list = leads.filter((l) => stageOf(l.stage) === s.id);
    const dias = list.map((l) => (now - l.stageChangedAt.getTime()) / DAY);
    return {
      id: s.id, label: s.label, c: s.c,
      count: list.length,
      valorCents: list.reduce((a, l) => a + l.valorEstimadoCents, 0),
      mediaDias: dias.length ? round1(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
      maxDias: dias.length ? round1(Math.max(...dias)) : null,
    };
  });

  // ── Funil de conversão: quantos leads chegaram a cada etapa ─────────────────
  const reachedSet = new Map<LeadStage, Set<string>>(FUNIL.map((s) => [s, new Set<string>()]));
  for (const e of events) {
    const s = e.toStage as LeadStage;
    reachedSet.get(s)?.add(e.leadId);
  }
  for (const l of leads) {
    reachedSet.get("contato")?.add(l.id); // todo lead entra por "contato"
    reachedSet.get(stageOf(l.stage))?.add(l.id); // cobre leads sem histórico completo
  }
  const base = reachedSet.get("contato")!.size || 1;
  const funil = FUNIL.map((id) => {
    const meta = LEAD_STAGES.find((s) => s.id === id)!;
    const reached = reachedSet.get(id)!.size;
    return { id, label: meta.label, c: meta.c, reached, pct: Math.round((reached / base) * 100) };
  });

  // ── Tempo médio por estágio (histórico): intervalo entre eventos ────────────
  // duração no estágio X = evento(toStage=X) → próximo evento do lead;
  // estágio atual de lead ativo conta como intervalo aberto (até agora).
  const eventosPorLead = new Map<string, typeof events>();
  for (const e of events) {
    const arr = eventosPorLead.get(e.leadId) ?? [];
    arr.push(e);
    eventosPorLead.set(e.leadId, arr);
  }
  const duracoes = new Map<LeadStage, number[]>(LEAD_STAGES.map((s) => [s.id, []]));
  for (const [leadId, evs] of eventosPorLead) {
    const lead = leads.find((l) => l.id === leadId);
    for (let i = 0; i < evs.length; i++) {
      const s = evs[i].toStage as LeadStage;
      if (!duracoes.has(s)) continue;
      const fim = i < evs.length - 1 ? evs[i + 1].createdAt.getTime() : lead && isAtivo(lead.stage) ? now : null;
      if (fim != null && fim > evs[i].createdAt.getTime()) duracoes.get(s)!.push((fim - evs[i].createdAt.getTime()) / DAY);
    }
  }
  const tempoMedioEstagio = LEAD_STAGES.filter((s) => s.id !== "ganho" && s.id !== "perdido").map((s) => {
    const ds = duracoes.get(s.id)!;
    return { id: s.id, label: s.label, c: s.c, mediaDias: ds.length ? round1(ds.reduce((a, b) => a + b, 0) / ds.length) : null, amostras: ds.length };
  });

  // ── Aging: ativos há mais tempo parados no estágio atual ───────────────────
  const aging = ativos
    .map((l) => ({
      id: l.id, nome: l.nome, empresa: l.empresa, stage: stageOf(l.stage),
      dias: round1((now - l.stageChangedAt.getTime()) / DAY),
      assignedUserName: l.assignedUserId ? uMap.get(l.assignedUserId) ?? null : null,
      valorCents: l.valorEstimadoCents,
      semContatoDias: round1((now - l.lastContactAt.getTime()) / DAY),
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 15);

  // ── Por responsável ─────────────────────────────────────────────────────────
  const porUser = new Map<string, { name: string; ativos: number; ganhos: number; perdidos: number; valorAbertoCents: number }>();
  for (const l of leads) {
    const name = l.assignedUserId ? uMap.get(l.assignedUserId) ?? "—" : "Sem responsável";
    const r = porUser.get(name) ?? { name, ativos: 0, ganhos: 0, perdidos: 0, valorAbertoCents: 0 };
    if (isAtivo(l.stage)) { r.ativos++; r.valorAbertoCents += l.valorEstimadoCents; }
    if (l.stage === "ganho") r.ganhos++;
    if (l.stage === "perdido") r.perdidos++;
    porUser.set(name, r);
  }
  const porResponsavel = [...porUser.values()]
    .map((r) => ({ ...r, conversao: r.ganhos + r.perdidos > 0 ? Math.round((r.ganhos / (r.ganhos + r.perdidos)) * 100) : null }))
    .sort((a, b) => b.ativos + b.ganhos - (a.ativos + a.ganhos));

  // ── Por origem (com valor ganho + conversão = ROI por canal) ────────────────
  const porOrig = new Map<string, { origem: string; total: number; ativos: number; ganhos: number; perdidos: number; valorGanhoCents: number }>();
  for (const l of leads) {
    const key = l.origem?.trim() || "sem origem";
    const r = porOrig.get(key) ?? { origem: key, total: 0, ativos: 0, ganhos: 0, perdidos: 0, valorGanhoCents: 0 };
    r.total++;
    if (isAtivo(l.stage)) r.ativos++;
    if (l.stage === "ganho") { r.ganhos++; r.valorGanhoCents += l.valorEstimadoCents; }
    if (l.stage === "perdido") r.perdidos++;
    porOrig.set(key, r);
  }
  const porOrigem = [...porOrig.values()]
    .map((r) => ({ ...r, conversao: r.ganhos + r.perdidos > 0 ? Math.round((r.ganhos / (r.ganhos + r.perdidos)) * 100) : null }))
    .sort((a, b) => b.total - a.total);

  // ── Entrada por semana (últimas 8) ──────────────────────────────────────────
  const weekStart = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    return d.getTime() - dow * DAY;
  };
  const thisWeek = weekStart(now);
  const entradaSemanas = Array.from({ length: 8 }, (_, i) => {
    const ini = thisWeek - (7 - i) * 7 * DAY;
    const fim = ini + 7 * DAY;
    const d = new Date(ini);
    return {
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      novos: leads.filter((l) => l.createdAt.getTime() >= ini && l.createdAt.getTime() < fim).length,
      ganhos: events.filter((e) => e.toStage === "ganho" && e.createdAt.getTime() >= ini && e.createdAt.getTime() < fim).length,
    };
  });

  return {
    kpis: {
      ativos: ativos.length,
      valorAbertoCents: ativos.reduce((a, l) => a + l.valorEstimadoCents, 0),
      ganhos30d: ganhos30.length,
      valorGanho30dCents: ganhos30.reduce((a, l) => a + l.valorEstimadoCents, 0),
      perdidos30d: perdidos.filter((l) => l.stageChangedAt.getTime() >= d30).length,
      taxaConversao: fechados > 0 ? Math.round((ganhos.length / fechados) * 100) : null,
      cicloMedioDias: ciclos.length ? round1(ciclos.reduce((a, b) => a + b, 0) / ciclos.length) : null,
      paradosMais7d: ativos.filter((l) => now - l.stageChangedAt.getTime() > 7 * DAY).length,
      forecastCents: Math.round(ativos.reduce((a, l) => a + l.valorEstimadoCents * (LEAD_STAGE_PROB[stageOf(l.stage)] ?? 0), 0)),
    },
    porEstagio, funil, tempoMedioEstagio, aging, porResponsavel, porOrigem, entradaSemanas,
  };
}
