// Leituras do espelho comercial (DB local). Server-only.
import "server-only";
import { db } from "@/lib/db";
import { ixcConfigured } from "@/lib/ixc";
import { effectiveProgress } from "@/server/projects";

export type ComercialOverview = {
  configured: boolean;
  vendedores: number;
  contratos: number;
  clientes: number;
  ativos: number; // status 'A'
  pipeline: number; // 'AA' | 'P'
  mrrAtivoCents: number; // MRR dos contratos ativos
  lastSync: {
    kind: string;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    processed: number;
    errors: number;
    fatalError: string | null;
  } | null;
};

export async function getComercialOverview(): Promise<ComercialOverview> {
  const ativoIds = await activeVendedorIxcIds(); // gate: só vendedores ativos no CRM
  const g = { vendedorIxcId: { in: ativoIds } };
  const [vendedores, contratos, clientes, ativos, pipeline, mrr, lastSync] = await Promise.all([
    db.vendedor.count({ where: { ativo: true } }),
    db.contrato.count({ where: g }),
    db.ixcCliente.count(),
    db.contrato.count({ where: { ...g, status: "A" } }),
    db.contrato.count({ where: { ...g, status: { in: ["AA", "P"] } } }),
    db.contrato.aggregate({ where: { ...g, status: "A" }, _sum: { mrrCents: true } }),
    db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return {
    configured: ixcConfigured(),
    vendedores,
    contratos,
    clientes,
    ativos,
    pipeline,
    mrrAtivoCents: mrr._sum.mrrCents ?? 0,
    lastSync,
  };
}

export function getRecentSyncRuns(take = 10) {
  return db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take });
}

// ── Dashboard: status dos contratos por mês (replica SalesTracker §1) ─────────
// Data de referência por status (handoff IXC §7): A → dataAtivacao; AA/P → dataCadastro.
const ST_ATIVO = ["A"];
const ST_AGUARD = ["AA", "P"];
const ST_CANCEL = ["C", "CN", "CA"];
const ST_BLOQ = ["B", "CM"];

export type StatusMes = {
  mes: number;
  ano: number;
  label: string;
  ativos: number;
  valorAtivosCents: number;
  aguardando: number;
  valorAguardandoCents: number;
  cancelados: number;
  bloqueados: number;
  parados30d: number; // AA/P parados há +30 dias
};

function monthRange(mes: number, ano: number) {
  // Boundaries em UTC: as datas do IXC são wall-clock (sem fuso) e ficam armazenadas
  // como naive-UTC. Usar new Date(ano,mes,1) (fuso local da máquina) desloca a borda
  // e derruba contratos cadastrados em 'AAAA-MM-01 00:00' (bug de virada de mês).
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1)); // exclusivo
  return { inicio, fim };
}

type ExtraWhere = { vendedorIxcId?: string; filial?: string };

// Gate central: só vendedores "Ativo no CRM" (Vendedores §3) aparecem nas telas.
// Cacheado por request-ish (chamado várias vezes; barato).
async function activeVendedorIxcIds(): Promise<string[]> {
  const vs = await db.vendedor.findMany({ where: { ativo: true }, select: { ixcId: true } });
  return vs.map((v) => v.ixcId);
}

// Resolve o where: aplica o gate de vendedores ativos. Se um vendedor específico
// for pedido, usa ele (assumido ativo). Senão, restringe ao conjunto de ativos.
async function resolveWhere(f: ExtraWhere): Promise<Record<string, unknown>> {
  const e: Record<string, unknown> = {};
  if (f.filial) e.filial = f.filial;
  if (f.vendedorIxcId) {
    e.vendedorIxcId = f.vendedorIxcId;
  } else {
    e.vendedorIxcId = { in: await activeVendedorIxcIds() };
  }
  return e;
}

async function statusDoMes(mes: number, ano: number, label: string, extra: ExtraWhere = {}): Promise<StatusMes> {
  const { inicio, fim } = monthRange(mes, ano);
  const trintaDias = new Date(Date.now() - 30 * 86400000);
  const x = await resolveWhere(extra);

  const [ativos, valAtivos, aguardando, valAguard, cancelados, bloqueados, parados30d] =
    await Promise.all([
      db.contrato.count({ where: { ...x, status: { in: ST_ATIVO }, dataAtivacao: { gte: inicio, lt: fim } } }),
      db.contrato.aggregate({ _sum: { mrrCents: true }, where: { ...x, status: { in: ST_ATIVO }, dataAtivacao: { gte: inicio, lt: fim } } }),
      db.contrato.count({ where: { ...x, status: { in: ST_AGUARD }, dataCadastro: { gte: inicio, lt: fim } } }),
      db.contrato.aggregate({ _sum: { mrrCents: true }, where: { ...x, status: { in: ST_AGUARD }, dataCadastro: { gte: inicio, lt: fim } } }),
      db.contrato.count({ where: { ...x, status: { in: ST_CANCEL }, dataCadastro: { gte: inicio, lt: fim } } }),
      db.contrato.count({ where: { ...x, status: { in: ST_BLOQ }, dataCadastro: { gte: inicio, lt: fim } } }),
      db.contrato.count({ where: { ...x, status: { in: ST_AGUARD }, dataCadastro: { lt: trintaDias } } }),
    ]);

  return {
    mes,
    ano,
    label,
    ativos,
    valorAtivosCents: valAtivos._sum.mrrCents ?? 0,
    aguardando,
    valorAguardandoCents: valAguard._sum.mrrCents ?? 0,
    cancelados,
    bloqueados,
    parados30d,
  };
}

// ── Tempo médio de ativação (SalesTracker §5) ────────────────────────────────
// dataAtivacao − dataCadastro dos contratos ativados no período. Aproxima o
// tempo do cadastro à ativação. Retorna média/melhor/pior em dias.
export type TempoAtivacao = { mediaDias: number; melhorDias: number; piorDias: number; n: number } | null;

export async function getTempoAtivacao(periodo: number, extra: ExtraWhere = {}): Promise<TempoAtivacao> {
  const idx = Math.min(2, Math.max(0, periodo));
  const r = periodoRef(idx);
  const { inicio, fim } = monthRange(r.mes, r.ano);
  const w = await resolveWhere(extra);
  const rows = await db.contrato.findMany({
    where: { ...w, status: { in: ST_ATIVO }, dataAtivacao: { gte: inicio, lt: fim, not: null }, dataCadastro: { not: null } },
    select: { dataAtivacao: true, dataCadastro: true },
  });
  const dias = rows
    .map((c) => Math.round((+c.dataAtivacao! - +c.dataCadastro!) / 86400000))
    .filter((d) => d >= 0); // descarta inconsistências (ativação antes do cadastro)
  if (dias.length === 0) return null;
  return {
    mediaDias: Math.round(dias.reduce((a, d) => a + d, 0) / dias.length),
    melhorDias: Math.min(...dias),
    piorDias: Math.max(...dias),
    n: dias.length,
  };
}

// ── Carteira por status (visão global de churn/base inativa — handoff §7) ─────
// Conta TODA a base dos vendedores ativos no CRM, sem recorte de mês. `D` =
// desativado (base inativa acumulada), nunca somado nas métricas de venda.
export type CarteiraResumo = { ativos: number; mrrAtivoCents: number; pipeline: number; bloqueados: number; cancelados: number; inativosD: number };

export async function getCarteiraResumo(): Promise<CarteiraResumo> {
  const g = { vendedorIxcId: { in: await activeVendedorIxcIds() } };
  const [ativos, mrr, pipeline, bloqueados, cancelados, inativosD] = await Promise.all([
    db.contrato.count({ where: { ...g, status: { in: ST_ATIVO } } }),
    db.contrato.aggregate({ _sum: { mrrCents: true }, where: { ...g, status: { in: ST_ATIVO } } }),
    db.contrato.count({ where: { ...g, status: { in: ST_AGUARD } } }),
    db.contrato.count({ where: { ...g, status: { in: ST_BLOQ } } }),
    db.contrato.count({ where: { ...g, status: { in: ST_CANCEL } } }),
    db.contrato.count({ where: { ...g, status: "D" } }),
  ]);
  return { ativos, mrrAtivoCents: mrr._sum.mrrCents ?? 0, pipeline, bloqueados, cancelados, inativosD };
}

// ── Metas (time + por vendedor) ──────────────────────────────────────────────
export function getMetaTime(mes: number, ano: number) {
  return db.meta.findUnique({ where: { mes_ano: { mes, ano } } });
}

export async function getMetasVendedorMap(mes: number, ano: number): Promise<Map<string, number>> {
  const rows = await db.metaVendedor.findMany({ where: { mes, ano }, select: { vendedorIxcId: true, metaContratos: true } });
  return new Map(rows.map((r) => [r.vendedorIxcId, r.metaContratos]));
}

// mes/ano de um período rápido (0=atual,1=anterior,2=2 atrás).
export function periodoMesAno(periodo: number): { mes: number; ano: number } {
  const r = periodoRef(Math.min(2, Math.max(0, periodo)));
  return { mes: r.mes, ano: r.ano };
}

// ── Relatório Diário (apontamento manual) ────────────────────────────────────
export type Produto = { nome: string; valorCents: number };
export type DiarioRow = { leads: number; contatos: number; callsReunioes: number; vendas: number; valorCents: number; observacoes: string | null; produtos: Produto[] };

// Normaliza o campo Json `produtos` (pode vir null/forma antiga) → Produto[].
function parseProdutos(raw: unknown): Produto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === "object" ? p : null))
    .filter((p): p is Record<string, unknown> => p != null)
    .map((p) => ({ nome: String(p.nome ?? "").trim(), valorCents: Number(p.valorCents) || 0 }))
    .filter((p) => p.nome.length > 0);
}

// Dia em UTC a partir de "YYYY-MM-DD".
export function diaUTC(dataISO: string): Date {
  const [y, m, d] = dataISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function getDiarioDia(dataISO: string): Promise<Map<string, DiarioRow>> {
  const data = diaUTC(dataISO);
  const rows = await db.relatorioDiario.findMany({ where: { data } });
  return new Map(rows.map((r) => [r.vendedorIxcId, { leads: r.leads, contatos: r.contatos, callsReunioes: r.callsReunioes, vendas: r.vendas, valorCents: r.valorCents, observacoes: r.observacoes, produtos: parseProdutos(r.produtos) }]));
}

// ── Relatório de Equipe (agrega o diário num intervalo) — SalesTracker §7 ─────
export type EquipeTotais = { leads: number; contatos: number; callsReunioes: number; vendas: number; valorCents: number; dias: number; ticketCents: number; conversao: number };
export type EquipeVendedor = { vendedorIxcId: string; nome: string; leads: number; contatos: number; callsReunioes: number; vendas: number; valorCents: number; dias: number };
export type EquipeDia = { dia: string; leads: number; contatos: number; vendas: number; valorCents: number };
export type EquipeProduto = { nome: string; qtd: number; valorCents: number };

export async function getRelatorioEquipe(inicioISO: string, fimISO: string): Promise<{ totais: EquipeTotais; porVendedor: EquipeVendedor[]; porDia: EquipeDia[]; produtos: EquipeProduto[] }> {
  const inicio = diaUTC(inicioISO);
  const fim = diaUTC(fimISO);
  const fimIncl = new Date(fim.getTime() + 86400000); // inclui o dia final
  const ativoIds = await activeVendedorIxcIds();

  const [rows, vendedores] = await Promise.all([
    db.relatorioDiario.findMany({ where: { data: { gte: inicio, lt: fimIncl }, vendedorIxcId: { in: ativoIds } } }),
    db.vendedor.findMany({ select: { ixcId: true, nome: true } }),
  ]);
  const nomeMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  const totais: EquipeTotais = { leads: 0, contatos: 0, callsReunioes: 0, vendas: 0, valorCents: 0, dias: 0, ticketCents: 0, conversao: 0 };
  const vendMap = new Map<string, EquipeVendedor>();
  const diaMap = new Map<string, EquipeDia>();
  const prodMap = new Map<string, EquipeProduto>();
  const diasSet = new Set<string>();

  for (const r of rows) {
    for (const p of parseProdutos(r.produtos)) {
      const pk = p.nome.toLowerCase();
      const pe = prodMap.get(pk) ?? { nome: p.nome, qtd: 0, valorCents: 0 };
      pe.qtd += 1; pe.valorCents += p.valorCents;
      prodMap.set(pk, pe);
    }
    totais.leads += r.leads; totais.contatos += r.contatos; totais.callsReunioes += r.callsReunioes; totais.vendas += r.vendas; totais.valorCents += r.valorCents;
    diasSet.add(r.data.toISOString().slice(0, 10));

    const v = vendMap.get(r.vendedorIxcId) ?? { vendedorIxcId: r.vendedorIxcId, nome: nomeMap.get(r.vendedorIxcId) ?? `#${r.vendedorIxcId}`, leads: 0, contatos: 0, callsReunioes: 0, vendas: 0, valorCents: 0, dias: 0 };
    v.leads += r.leads; v.contatos += r.contatos; v.callsReunioes += r.callsReunioes; v.vendas += r.vendas; v.valorCents += r.valorCents; v.dias += 1;
    vendMap.set(r.vendedorIxcId, v);

    const dk = r.data.toISOString().slice(0, 10);
    const d = diaMap.get(dk) ?? { dia: dk, leads: 0, contatos: 0, vendas: 0, valorCents: 0 };
    d.leads += r.leads; d.contatos += r.contatos; d.vendas += r.vendas; d.valorCents += r.valorCents;
    diaMap.set(dk, d);
  }
  totais.dias = diasSet.size;
  totais.ticketCents = totais.vendas > 0 ? Math.round(totais.valorCents / totais.vendas) : 0;
  totais.conversao = totais.contatos > 0 ? Math.round((totais.vendas / totais.contatos) * 100) : 0;

  return {
    totais,
    porVendedor: [...vendMap.values()].sort((a, b) => b.valorCents - a.valorCents),
    porDia: [...diaMap.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
    produtos: [...prodMap.values()].sort((a, b) => b.valorCents - a.valorCents),
  };
}

// Dias úteis (seg–sex) do mês: total e já decorridos (até hoje, se for o mês corrente).
export function diasUteis(mes: number, ano: number): { total: number; passados: number } {
  const hoje = new Date();
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let total = 0, passados = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    total++;
    const dataDia = new Date(Date.UTC(ano, mes - 1, d));
    const hojeUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    if (dataDia <= hojeUTC) passados++;
  }
  return { total, passados };
}

// Referência dos 3 períodos rápidos (atual, anterior, 2 atrás).
const PERIODO_LABELS = ["Mês atual", "Mês anterior", "2 meses atrás"];
function periodoRef(idx: number) {
  const now = new Date();
  let m = now.getMonth() + 1 - idx;
  let a = now.getFullYear();
  while (m <= 0) { m += 12; a--; }
  return { mes: m, ano: a, label: PERIODO_LABELS[idx] ?? "Mês atual" };
}

// Dashboard escopado por período + vendedor + filial (Visão Geral filtrada).
export async function getDashboard(periodo: number, extra: ExtraWhere = {}): Promise<StatusMes> {
  const idx = Math.min(2, Math.max(0, periodo));
  const r = periodoRef(idx);
  return statusDoMes(r.mes, r.ano, r.label, extra);
}

// ── Relatórios Gerenciais — Ranking / Performance por Vendedor (SalesTracker §5) ─
export type RankingRow = {
  vendedorIxcId: string;
  nome: string;
  cadastrados: number;
  ativos: number;
  aguardando: number;
  cancelados: number;
  mrrCents: number;
  ticketCents: number; // mrr / ativos
  conversao: number; // ativos / (ativos+aguardando) %
};

export async function getRelatorioRanking(periodo: number, filial?: string): Promise<RankingRow[]> {
  const r = periodoRef(Math.min(2, Math.max(0, periodo)));
  const { inicio, fim } = monthRange(r.mes, r.ano);
  const fil = filial ? { filial } : {};
  const ativoIds = await activeVendedorIxcIds(); // gate: só vendedores ativos
  const base = { ...fil, vendedorIxcId: { in: ativoIds } };

  const [ativosG, aguardG, cancelG, vendedores] = await Promise.all([
    db.contrato.groupBy({
      by: ["vendedorIxcId"],
      where: { ...base, status: { in: ST_ATIVO }, dataAtivacao: { gte: inicio, lt: fim } },
      _count: { _all: true },
      _sum: { mrrCents: true },
    }),
    db.contrato.groupBy({
      by: ["vendedorIxcId"],
      where: { ...base, status: { in: ST_AGUARD }, dataCadastro: { gte: inicio, lt: fim } },
      _count: { _all: true },
    }),
    db.contrato.groupBy({
      by: ["vendedorIxcId"],
      where: { ...base, status: { in: ST_CANCEL }, dataCadastro: { gte: inicio, lt: fim } },
      _count: { _all: true },
    }),
    db.vendedor.findMany({ select: { ixcId: true, nome: true } }),
  ]);

  const nomeMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));
  const map = new Map<string, RankingRow>();
  const row = (id: string): RankingRow =>
    map.get(id) ?? { vendedorIxcId: id, nome: nomeMap.get(id) ?? `#${id}`, cadastrados: 0, ativos: 0, aguardando: 0, cancelados: 0, mrrCents: 0, ticketCents: 0, conversao: 0 };

  for (const g of ativosG) { const id = g.vendedorIxcId as string; const x = row(id); x.ativos = g._count._all; x.mrrCents = g._sum.mrrCents ?? 0; map.set(id, x); }
  for (const g of aguardG) { const id = g.vendedorIxcId as string; const x = row(id); x.aguardando = g._count._all; map.set(id, x); }
  for (const g of cancelG) { const id = g.vendedorIxcId as string; const x = row(id); x.cancelados = g._count._all; map.set(id, x); }

  for (const x of map.values()) {
    x.cadastrados = x.ativos + x.aguardando + x.cancelados;
    x.ticketCents = x.ativos > 0 ? Math.round(x.mrrCents / x.ativos) : 0;
    const pipe = x.ativos + x.aguardando;
    x.conversao = pipe > 0 ? Math.round((x.ativos / pipe) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => b.ativos - a.ativos || b.mrrCents - a.mrrCents);
}

// ── Contratos/clientes do período (lista detalhada p/ Visão Geral e Relatórios) ─
// "Ativados" = status ativo com dataAtivacao no mês (de qual data eram = dataCadastro).
// "Fechados" = qualquer contrato com dataCadastro no mês (novos negócios assinados).
export type ContratoLinha = {
  ixcId: string;
  clienteIxcId: string;
  clienteNome: string;
  vendedorNome: string | null;
  status: string;
  mrrCents: number;
  dataCadastro: Date | null;
  dataAtivacao: Date | null;
  diasAtivacao: number | null; // ativação − cadastro
};
export type ContratosPeriodo = {
  ativados: ContratoLinha[];
  fechados: ContratoLinha[];
  mrrAtivadosCents: number;
  mrrFechadosCents: number;
};

export async function getContratosDoPeriodo(periodo: number, extra: ExtraWhere = {}): Promise<ContratosPeriodo> {
  const r = periodoRef(Math.min(2, Math.max(0, periodo)));
  const { inicio, fim } = monthRange(r.mes, r.ano);
  const w = await resolveWhere(extra);

  const [ativadosRaw, fechadosRaw] = await Promise.all([
    db.contrato.findMany({ where: { ...w, status: { in: ST_ATIVO }, dataAtivacao: { gte: inicio, lt: fim } }, orderBy: { dataAtivacao: "desc" } }),
    db.contrato.findMany({ where: { ...w, dataCadastro: { gte: inicio, lt: fim } }, orderBy: { dataCadastro: "desc" } }),
  ]);

  const all = [...ativadosRaw, ...fechadosRaw];
  const clienteIds = [...new Set(all.map((c) => c.clienteIxcId))];
  const vendIds = [...new Set(all.map((c) => c.vendedorIxcId).filter((x): x is string => !!x))];
  const [clientes, vendedores] = await Promise.all([
    clienteIds.length ? db.ixcCliente.findMany({ where: { ixcId: { in: clienteIds } }, select: { ixcId: true, razao: true } }) : [],
    vendIds.length ? db.vendedor.findMany({ where: { ixcId: { in: vendIds } }, select: { ixcId: true, nome: true } }) : [],
  ]);
  const cMap = new Map(clientes.map((c) => [c.ixcId, c.razao]));
  const vMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  const toLinha = (c: (typeof all)[number]): ContratoLinha => ({
    ixcId: c.ixcId,
    clienteIxcId: c.clienteIxcId,
    clienteNome: cMap.get(c.clienteIxcId) ?? `#${c.clienteIxcId}`,
    vendedorNome: c.vendedorIxcId ? vMap.get(c.vendedorIxcId) ?? `#${c.vendedorIxcId}` : null,
    status: c.status,
    mrrCents: c.mrrCents,
    dataCadastro: c.dataCadastro,
    dataAtivacao: c.dataAtivacao,
    diasAtivacao: c.dataAtivacao && c.dataCadastro ? Math.max(0, Math.round((+c.dataAtivacao - +c.dataCadastro) / 86400000)) : null,
  });

  const ativados = ativadosRaw.map(toLinha);
  const fechados = fechadosRaw.map(toLinha);
  return {
    ativados,
    fechados,
    mrrAtivadosCents: ativados.reduce((a, c) => a + c.mrrCents, 0),
    mrrFechadosCents: fechados.reduce((a, c) => a + c.mrrCents, 0),
  };
}

// ── Evolução (últimos N meses) — para gráficos de linha/barra ─────────────────
const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type EvolucaoMes = { label: string; ativos: number; aguardando: number; mrrCents: number };

export async function getEvolucao(extra: ExtraWhere = {}, n = 6): Promise<EvolucaoMes[]> {
  const now = new Date();
  const out: EvolucaoMes[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let m = now.getMonth() + 1 - i;
    let a = now.getFullYear();
    while (m <= 0) { m += 12; a--; }
    const s = await statusDoMes(m, a, "", extra);
    out.push({ label: `${MES_CURTO[m - 1]}/${String(a).slice(2)}`, ativos: s.ativos, aguardando: s.aguardando, mrrCents: s.valorAtivosCents });
  }
  return out;
}

// ── Distribuição Pessoa Física × Pessoa Jurídica (carteira ativa) ────────────
export async function getDistribuicaoPfPj(extra: ExtraWhere = {}): Promise<{ pf: number; pj: number }> {
  const w = await resolveWhere(extra);
  const contratos = await db.contrato.findMany({
    where: { ...w, status: { in: ST_ATIVO } },
    select: { clienteIxcId: true },
    distinct: ["clienteIxcId"],
  });
  const ids = contratos.map((c) => c.clienteIxcId);
  if (ids.length === 0) return { pf: 0, pj: 0 };
  const clientes = await db.ixcCliente.findMany({ where: { ixcId: { in: ids } }, select: { cnpjCpf: true } });
  let pf = 0, pj = 0;
  for (const c of clientes) {
    const d = (c.cnpjCpf ?? "").replace(/\D/g, "");
    if (d.length >= 12) pj++;
    else if (d.length > 0) pf++; // CPF (até 11 dígitos)
  }
  return { pf, pj };
}

// Opções dos filtros do dashboard (vendedores + filiais conhecidas).
const FILIAL_NOMES: Record<string, string> = {
  "1": "Open IT Solutions",
  "2": "Open IT Group",
  "6": "Open Developer",
};
export async function getDashboardFiltroOpcoes(): Promise<{ vendedores: { ixcId: string; nome: string }[]; filiais: { value: string; label: string }[] }> {
  const [vendedores, filGroups] = await Promise.all([
    db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { ixcId: true, nome: true } }),
    db.contrato.groupBy({ by: ["filial"], _count: true }),
  ]);
  const filiais = filGroups
    .map((g) => g.filial)
    .filter((f): f is string => Boolean(f))
    .sort()
    .map((f) => ({ value: f, label: FILIAL_NOMES[f] ? `${FILIAL_NOMES[f]} (${f})` : `Filial ${f}` }));
  return { vendedores, filiais };
}

// Alertas: contratos AA/P parados há mais de N dias (replica Dashboard §1).
export type AlertaAA = {
  ixcId: string;
  clienteNome: string;
  vendedorNome: string | null;
  dias: number;
};

export async function getAlertasAA(minDias = 7, take = 8, extra: ExtraWhere = {}): Promise<AlertaAA[]> {
  const limite = new Date(Date.now() - minDias * 86400000);
  const contratos = await db.contrato.findMany({
    where: { ...(await resolveWhere(extra)), status: { in: ST_AGUARD }, dataCadastro: { lt: limite, not: null } },
    orderBy: { dataCadastro: "asc" },
    take,
    select: { ixcId: true, clienteIxcId: true, vendedorIxcId: true, dataCadastro: true },
  });
  if (contratos.length === 0) return [];

  // Join manual (sem FK): busca nomes de cliente e vendedor.
  const cliIds = [...new Set(contratos.map((c) => c.clienteIxcId))];
  const vendIds = [...new Set(contratos.map((c) => c.vendedorIxcId).filter(Boolean) as string[])];
  const [clientes, vendedores] = await Promise.all([
    db.ixcCliente.findMany({ where: { ixcId: { in: cliIds } }, select: { ixcId: true, razao: true } }),
    db.vendedor.findMany({ where: { ixcId: { in: vendIds } }, select: { ixcId: true, nome: true } }),
  ]);
  const cliMap = new Map(clientes.map((c) => [c.ixcId, c.razao]));
  const vendMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  return contratos.map((c) => ({
    ixcId: c.ixcId,
    clienteNome: cliMap.get(c.clienteIxcId) ?? `Cliente #${c.clienteIxcId}`,
    vendedorNome: c.vendedorIxcId ? vendMap.get(c.vendedorIxcId) ?? null : null,
    dias: c.dataCadastro ? Math.floor((Date.now() - +c.dataCadastro) / 86400000) : 0,
  }));
}

// ── Contratos (lista + filtros — replica SalesTracker §2) ────────────────────
export type ContratoFiltro = {
  q?: string; // busca cliente (razão) ou id do contrato
  status?: string;
  vendedorIxcId?: string;
  filial?: string;
  page?: number;
};

export type ContratoRow = {
  ixcId: string;
  clienteNome: string;
  uf: string | null;
  vendedorNome: string | null;
  status: string;
  mrrCents: number;
  dataAtivacao: Date | null;
  dataCadastro: Date | null;
};

const PAGE_SIZE = 50;

export async function getContratos(f: ContratoFiltro): Promise<{ rows: ContratoRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(0, f.page ?? 0);

  // Filtro por busca: casa razão do cliente OU id do contrato.
  const where: Record<string, unknown> = {};
  if (f.status) where.status = f.status;
  // Gate: vendedor específico OU restrito aos ativos no CRM.
  if (f.vendedorIxcId) where.vendedorIxcId = f.vendedorIxcId;
  else where.vendedorIxcId = { in: await activeVendedorIxcIds() };
  if (f.filial) where.filial = f.filial;
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    const clientes = await db.ixcCliente.findMany({
      where: { razao: { contains: q, mode: "insensitive" } },
      select: { ixcId: true },
      take: 500,
    });
    where.OR = [
      { clienteIxcId: { in: clientes.map((c) => c.ixcId) } },
      { ixcId: { contains: q } },
    ];
  }

  const [total, contratos] = await Promise.all([
    db.contrato.count({ where }),
    db.contrato.findMany({
      where,
      orderBy: [{ dataCadastro: { sort: "desc", nulls: "last" } }],
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { ixcId: true, clienteIxcId: true, vendedorIxcId: true, status: true, mrrCents: true, dataAtivacao: true, dataCadastro: true },
    }),
  ]);

  // Join manual de nomes (sem FK).
  const cliIds = [...new Set(contratos.map((c) => c.clienteIxcId))];
  const vendIds = [...new Set(contratos.map((c) => c.vendedorIxcId).filter(Boolean) as string[])];
  const [clientes, vendedores] = await Promise.all([
    db.ixcCliente.findMany({ where: { ixcId: { in: cliIds } }, select: { ixcId: true, razao: true, uf: true } }),
    db.vendedor.findMany({ where: { ixcId: { in: vendIds } }, select: { ixcId: true, nome: true } }),
  ]);
  const cliMap = new Map(clientes.map((c) => [c.ixcId, c]));
  const vendMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  const rows: ContratoRow[] = contratos.map((c) => ({
    ixcId: c.ixcId,
    clienteNome: cliMap.get(c.clienteIxcId)?.razao ?? `Cliente #${c.clienteIxcId}`,
    uf: cliMap.get(c.clienteIxcId)?.uf ?? null,
    vendedorNome: c.vendedorIxcId ? vendMap.get(c.vendedorIxcId) ?? null : null,
    status: c.status,
    mrrCents: c.mrrCents,
    dataAtivacao: c.dataAtivacao,
    dataCadastro: c.dataCadastro,
  }));

  return { rows, total, page, pageSize: PAGE_SIZE };
}

// Opções pros filtros (vendedores + status + filiais presentes no banco).
export async function getContratoFiltroOpcoes(): Promise<{
  vendedores: { ixcId: string; nome: string }[];
  status: string[];
  filiais: { value: string; label: string }[];
}> {
  const [vendedores, statusGroups, filGroups] = await Promise.all([
    db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { ixcId: true, nome: true } }),
    db.contrato.groupBy({ by: ["status"], _count: true }),
    db.contrato.groupBy({ by: ["filial"], _count: true }),
  ]);
  const filiais = filGroups
    .map((g) => g.filial)
    .filter((f): f is string => Boolean(f))
    .sort()
    .map((f) => ({ value: f, label: FILIAL_NOMES[f] ? `${FILIAL_NOMES[f]} (${f})` : `Filial ${f}` }));
  return {
    vendedores,
    status: statusGroups.map((s) => s.status).sort(),
    filiais,
  };
}

// ── Vendedores (governança — replica SalesTracker §3) ────────────────────────
export type VendedorRow = {
  id: string;
  ixcId: string;
  nome: string;
  ativo: boolean;
  incluirHistorico: boolean;
  userId: string | null;
  userName: string | null; // nome do User OpenBoard vinculado (A1)
};

export async function getVendedoresCRM(): Promise<VendedorRow[]> {
  const vs = await db.vendedor.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, ixcId: true, nome: true, ativo: true, incluirHistorico: true, userId: true },
  });
  // Vínculo Vendedor↔User é frouxo (sem FK) — resolve os nomes num lote.
  const userIds = [...new Set(vs.map((v) => v.userId).filter((x): x is string => !!x))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));
  return vs.map((v) => ({ ...v, userName: v.userId ? nameMap.get(v.userId) ?? null : null }));
}

// ══════════════════════════════════════════════════════════════════════════
// Cross-links OpenBoard ↔ Comercial (COMERCIAL_INTEGRATION_IDEAS.md)
// ══════════════════════════════════════════════════════════════════════════

// ── A2/C1: Clientes (lista + Cliente 360) ────────────────────────────────────
export type ClienteRow = {
  ixcId: string; razao: string; uf: string | null; cnpjCpf: string | null;
  contratos: number; ativos: number; mrrAtivoCents: number; projetos: number;
};

export async function getClientes({ q, page = 0 }: { q?: string; page?: number }): Promise<{ rows: ClienteRow[]; total: number; pageSize: number }> {
  const gate = { vendedorIxcId: { in: await activeVendedorIxcIds() } };
  const [todos, ativosG] = await Promise.all([
    db.contrato.groupBy({ by: ["clienteIxcId"], where: gate, _count: { _all: true } }),
    db.contrato.groupBy({ by: ["clienteIxcId"], where: { ...gate, status: { in: ST_ATIVO } }, _count: { _all: true }, _sum: { mrrCents: true } }),
  ]);
  const totalMap = new Map(todos.map((g) => [g.clienteIxcId, g._count._all]));
  const ativMap = new Map(ativosG.map((g) => [g.clienteIxcId, { n: g._count._all, mrr: g._sum.mrrCents ?? 0 }]));
  const ids = [...totalMap.keys()];
  const [clientes, projG] = await Promise.all([
    db.ixcCliente.findMany({ where: { ixcId: { in: ids } }, select: { ixcId: true, razao: true, uf: true, cnpjCpf: true } }),
    db.project.groupBy({ by: ["ixcClienteId"], where: { ixcClienteId: { in: ids } }, _count: { _all: true } }),
  ]);
  const projMap = new Map(projG.map((g) => [g.ixcClienteId as string, g._count._all]));
  const cliMap = new Map(clientes.map((c) => [c.ixcId, c]));
  let rows: ClienteRow[] = ids.map((id) => {
    const c = cliMap.get(id);
    const a = ativMap.get(id);
    return { ixcId: id, razao: c?.razao ?? `Cliente #${id}`, uf: c?.uf ?? null, cnpjCpf: c?.cnpjCpf ?? null, contratos: totalMap.get(id) ?? 0, ativos: a?.n ?? 0, mrrAtivoCents: a?.mrr ?? 0, projetos: projMap.get(id) ?? 0 };
  });
  if (q?.trim()) {
    const t = q.trim().toLowerCase();
    rows = rows.filter((r) => r.razao.toLowerCase().includes(t) || r.ixcId.includes(t) || (r.cnpjCpf ?? "").includes(t));
  }
  rows.sort((a, b) => b.mrrAtivoCents - a.mrrAtivoCents || b.contratos - a.contratos);
  const pageSize = 30;
  return { rows: rows.slice(page * pageSize, page * pageSize + pageSize), total: rows.length, pageSize };
}

export type Cliente360Contrato = { ixcId: string; status: string; mrrCents: number; vendedorNome: string | null; dataAtivacao: Date | null; dataCadastro: Date | null };
export type Cliente360Projeto = { id: string; name: string; status: string; progress: number; dueDate: Date | null; tasksTotal: number; tasksDone: number };
export type Cliente360 = {
  cliente: { ixcId: string; razao: string; uf: string | null; cnpjCpf: string | null } | null;
  contratos: Cliente360Contrato[];
  mrrAtivoCents: number;
  projetos: Cliente360Projeto[];
  projetosDisponiveis: { id: string; name: string }[];
};

export async function getCliente360(ixcId: string, workspaceId: string): Promise<Cliente360> {
  const [cliente, contratos, projetos, disponiveis] = await Promise.all([
    db.ixcCliente.findUnique({ where: { ixcId }, select: { ixcId: true, razao: true, uf: true, cnpjCpf: true } }),
    db.contrato.findMany({ where: { clienteIxcId: ixcId }, orderBy: { dataCadastro: "desc" }, select: { ixcId: true, status: true, mrrCents: true, vendedorIxcId: true, dataAtivacao: true, dataCadastro: true } }),
    db.project.findMany({ where: { ixcClienteId: ixcId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, manualProgress: true, dueDate: true, tasks: { select: { column: true } } } }),
    db.project.findMany({ where: { workspaceId, ixcClienteId: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true } }),
  ]);
  const vendIds = [...new Set(contratos.map((c) => c.vendedorIxcId).filter((x): x is string => !!x))];
  const vendedores = vendIds.length ? await db.vendedor.findMany({ where: { ixcId: { in: vendIds } }, select: { ixcId: true, nome: true } }) : [];
  const vendMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  return {
    cliente,
    contratos: contratos.map((c) => ({ ixcId: c.ixcId, status: c.status, mrrCents: c.mrrCents, vendedorNome: c.vendedorIxcId ? vendMap.get(c.vendedorIxcId) ?? null : null, dataAtivacao: c.dataAtivacao, dataCadastro: c.dataCadastro })),
    mrrAtivoCents: contratos.filter((c) => ST_ATIVO.includes(c.status)).reduce((a, c) => a + c.mrrCents, 0),
    projetos: projetos.map((p) => {
      const done = p.tasks.filter((t) => t.column === "done").length;
      return { id: p.id, name: p.name, status: p.status, progress: effectiveProgress(p.manualProgress, done, p.tasks.length), dueDate: p.dueDate, tasksTotal: p.tasks.length, tasksDone: done };
    }),
    projetosDisponiveis: disponiveis,
  };
}

// ── C3: Pipeline (read-only — IXC é a fonte de verdade) ───────────────────────
export type PipelineCard = { ixcId: string; clienteNome: string; vendedorNome: string | null; mrrCents: number; dias: number; status: string };
export type PipelineCol = { status: string; cards: PipelineCard[]; totalMrrCents: number; total: number };

export async function getPipeline(): Promise<PipelineCol[]> {
  const gate = { vendedorIxcId: { in: await activeVendedorIxcIds() } };
  const contratos = await db.contrato.findMany({
    where: { ...gate, status: { in: ST_AGUARD } },
    orderBy: { dataCadastro: "asc" },
    take: 300,
    select: { ixcId: true, clienteIxcId: true, vendedorIxcId: true, mrrCents: true, dataCadastro: true, status: true },
  });
  const cliIds = [...new Set(contratos.map((c) => c.clienteIxcId))];
  const vendIds = [...new Set(contratos.map((c) => c.vendedorIxcId).filter((x): x is string => !!x))];
  const [clientes, vendedores] = await Promise.all([
    db.ixcCliente.findMany({ where: { ixcId: { in: cliIds } }, select: { ixcId: true, razao: true } }),
    db.vendedor.findMany({ where: { ixcId: { in: vendIds } }, select: { ixcId: true, nome: true } }),
  ]);
  const cliMap = new Map(clientes.map((c) => [c.ixcId, c.razao]));
  const vendMap = new Map(vendedores.map((v) => [v.ixcId, v.nome]));

  const cols = new Map<string, PipelineCol>(ST_AGUARD.map((s) => [s, { status: s, cards: [], totalMrrCents: 0, total: 0 }]));
  for (const c of contratos) {
    const col = cols.get(c.status);
    if (!col) continue;
    col.cards.push({
      ixcId: c.ixcId,
      clienteNome: cliMap.get(c.clienteIxcId) ?? `Cliente #${c.clienteIxcId}`,
      vendedorNome: c.vendedorIxcId ? vendMap.get(c.vendedorIxcId) ?? null : null,
      mrrCents: c.mrrCents,
      dias: c.dataCadastro ? Math.floor((Date.now() - +c.dataCadastro) / 86400000) : 0,
      status: c.status,
    });
    col.totalMrrCents += c.mrrCents;
    col.total += 1;
  }
  return [...cols.values()];
}

// ── D1: Margem real por cliente/projeto vinculado ────────────────────────────
export type MargemRow = { projectId: string; projectName: string; clienteNome: string; mrrAtivoCents: number; horas: number; custoCents: number; margemCents: number };

export async function getMargem(workspaceId: string): Promise<{ rows: MargemRow[]; semCusto: boolean }> {
  const projetos = await db.project.findMany({ where: { workspaceId, ixcClienteId: { not: null } }, select: { id: true, name: true, ixcClienteId: true } });
  if (projetos.length === 0) return { rows: [], semCusto: true };
  const cliIds = [...new Set(projetos.map((p) => p.ixcClienteId!).filter(Boolean))];
  const [clientes, mrrG, timelogs, users] = await Promise.all([
    db.ixcCliente.findMany({ where: { ixcId: { in: cliIds } }, select: { ixcId: true, razao: true } }),
    db.contrato.groupBy({ by: ["clienteIxcId"], where: { clienteIxcId: { in: cliIds }, status: { in: ST_ATIVO } }, _sum: { mrrCents: true } }),
    db.timeLog.findMany({ where: { projectId: { in: projetos.map((p) => p.id) } }, select: { projectId: true, userId: true, durationSec: true } }),
    db.user.findMany({ where: { workspaceId }, select: { id: true, hourlyCostCents: true } }),
  ]);
  const custoH = new Map(users.map((u) => [u.id, u.hourlyCostCents]));
  const mrrMap = new Map(mrrG.map((g) => [g.clienteIxcId, g._sum.mrrCents ?? 0]));
  const cliMap = new Map(clientes.map((c) => [c.ixcId, c.razao]));
  const semCusto = users.every((u) => u.hourlyCostCents === 0);

  const agg = new Map<string, { sec: number; custo: number }>();
  for (const t of timelogs) {
    const e = agg.get(t.projectId) ?? { sec: 0, custo: 0 };
    e.sec += t.durationSec;
    e.custo += (t.durationSec / 3600) * (custoH.get(t.userId) ?? 0);
    agg.set(t.projectId, e);
  }
  const rows = projetos.map((p) => {
    const a = agg.get(p.id) ?? { sec: 0, custo: 0 };
    const mrr = mrrMap.get(p.ixcClienteId!) ?? 0;
    const custo = Math.round(a.custo);
    return { projectId: p.id, projectName: p.name, clienteNome: cliMap.get(p.ixcClienteId!) ?? "—", mrrAtivoCents: mrr, horas: a.sec / 3600, custoCents: custo, margemCents: mrr - custo };
  }).sort((a, b) => b.margemCents - a.margemCents);
  return { rows, semCusto };
}

export { ixcConfigured };
