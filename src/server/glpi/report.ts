// Relatório de atividades das Demandas GLPI (aba "Relatório" do Marketing).
// Estilo do /reports de Projetos, mas sobre os chamados espelhados (GlpiTicket).
// Só lê o banco local — o sync é quem fala com o GLPI. Sem dado inventado.
import { db } from "@/lib/db";

// GLPI: 1 Novo, 2 Em atendimento (atribuído), 3 Em atendimento (planejado),
// 4 Pendente, 5 Solucionado, 6 Fechado. "Aberto" = ainda não solucionado/fechado.
const OPEN_STATUSES = [1, 2, 3, 4];
const DAY_MS = 86_400_000;

// Mediana em horas de durações (segundos). Mediana > média: resolutionDuration é
// tempo corrido (criação→solução) e outliers de meses distorcem a média.
function medianHours(secs: number[]): number | null {
  const v = secs.filter((s) => s > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  const med = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round((med / 3600) * 10) / 10;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inRange = (d: Date | null, from: Date, to: Date): boolean => !!d && d >= from && d <= to;

export interface GlpiReportKpis {
  abertasNoPeriodo: number; // dateCreation no período
  solucionadasNoPeriodo: number; // dateSolve no período
  taxaSolucaoPct: number | null; // solucionadas / abertas no período
  tempoMedianoH: number | null; // mediana até solução (solucionadas no período)
  abertasAgora: number; // snapshot: status ainda aberto
  paradasAgora: number; // snapshot: abertas sem movimentação ≥3 dias
}

export interface GlpiReportPessoa {
  requesterId: number;
  name: string;
  abertasNoPeriodo: number;
  solucionadasNoPeriodo: number;
  tempoMedianoH: number | null;
  abertasAgora: number;
  paradasAgora: number;
}

export interface GlpiReportDia {
  label: string;
  abertas: number;
  solucionadas: number;
}

export interface GlpiReportSolucionada {
  glpiId: number;
  name: string;
  requesterName: string;
  categoryName: string | null;
  dateSolve: string; // ISO
  resolutionH: number | null;
}

export interface GlpiActivityReport {
  kpis: GlpiReportKpis;
  porDia: GlpiReportDia[];
  porCategoria: { label: string; value: number }[];
  porPessoa: GlpiReportPessoa[];
  solucionadas: GlpiReportSolucionada[];
  lastSync: { finishedAt: string | null; ok: boolean; processed: number } | null;
}

type Row = {
  glpiId: number;
  name: string;
  statusId: number;
  requesterId: number;
  requesterName: string;
  categoryName: string | null;
  dateCreation: Date;
  dateMod: Date | null;
  dateSolve: Date | null;
  resolutionDuration: number | null;
};

// Bucket por dia (≤45 dias no intervalo) ou por semana (ISO segunda) acima disso —
// mesmo critério visual do /reports de Projetos (dia vs semana).
function bucketing(from: Date, to: Date) {
  const spanDias = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const semanal = spanDias > 45;
  const startOfWeek = (d: Date) => {
    const dow = (d.getDay() + 6) % 7; // 0 = segunda
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  };
  const keyOf = (d: Date) => iso(semanal ? startOfWeek(d) : new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  const labelOf = (key: string) => {
    const [, m, dd] = key.split("-");
    return semanal ? `sem ${dd}/${m}` : `${dd}/${m}`;
  };

  // Sequência de chaves cobrindo o intervalo (garante dias/semanas sem dado = 0).
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    const k = keyOf(new Date(t));
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return { keyOf, labelOf, keys };
}

export async function getGlpiActivityReport(from: Date, to: Date): Promise<GlpiActivityReport> {
  const rows: Row[] = await db.glpiTicket.findMany({
    where: { isDeleted: false },
    select: {
      glpiId: true,
      name: true,
      statusId: true,
      requesterId: true,
      requesterName: true,
      categoryName: true,
      dateCreation: true,
      dateMod: true,
      dateSolve: true,
      resolutionDuration: true,
    },
  });

  const now = Date.now();
  const staleDays = (r: Row) => Math.floor((now - (r.dateMod ?? r.dateCreation).getTime()) / DAY_MS);
  const isOpen = (r: Row) => OPEN_STATUSES.includes(r.statusId);
  const abertaNo = (r: Row) => inRange(r.dateCreation, from, to);
  const solvidaNo = (r: Row) => inRange(r.dateSolve, from, to);

  // ── KPIs do período ──
  const criadas = rows.filter(abertaNo);
  const resolvidas = rows.filter(solvidaNo);
  const tempoMedianoH = medianHours(resolvidas.map((r) => r.resolutionDuration ?? 0));
  const abertasAgora = rows.filter(isOpen).length;
  const paradasAgora = rows.filter((r) => isOpen(r) && staleDays(r) >= 3).length;
  const kpis: GlpiReportKpis = {
    abertasNoPeriodo: criadas.length,
    solucionadasNoPeriodo: resolvidas.length,
    taxaSolucaoPct: criadas.length > 0 ? Math.round((resolvidas.length / criadas.length) * 100) : null,
    tempoMedianoH,
    abertasAgora,
    paradasAgora,
  };

  // ── Por dia/semana ──
  const { keyOf, labelOf, keys } = bucketing(from, to);
  const abertasMap = new Map<string, number>();
  const solvMap = new Map<string, number>();
  for (const r of criadas) abertasMap.set(keyOf(r.dateCreation), (abertasMap.get(keyOf(r.dateCreation)) ?? 0) + 1);
  for (const r of resolvidas) solvMap.set(keyOf(r.dateSolve!), (solvMap.get(keyOf(r.dateSolve!)) ?? 0) + 1);
  const porDia: GlpiReportDia[] = keys.map((k) => ({
    label: labelOf(k),
    abertas: abertasMap.get(k) ?? 0,
    solucionadas: solvMap.get(k) ?? 0,
  }));

  // ── Por categoria (criadas no período) ──
  const catMap = new Map<string, number>();
  for (const r of criadas) {
    const c = r.categoryName?.trim() || "Sem categoria";
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  }
  const porCategoria = [...catMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Por pessoa ──
  const byId = new Map<number, Row[]>();
  for (const r of rows) {
    const arr = byId.get(r.requesterId) ?? [];
    arr.push(r);
    byId.set(r.requesterId, arr);
  }
  const porPessoa: GlpiReportPessoa[] = [...byId.entries()]
    .map(([requesterId, rr]) => {
      const resol = rr.filter(solvidaNo);
      const open = rr.filter(isOpen);
      return {
        requesterId,
        name: rr[0].requesterName || String(requesterId),
        abertasNoPeriodo: rr.filter(abertaNo).length,
        solucionadasNoPeriodo: resol.length,
        tempoMedianoH: medianHours(resol.map((r) => r.resolutionDuration ?? 0)),
        abertasAgora: open.length,
        paradasAgora: open.filter((r) => staleDays(r) >= 3).length,
      };
    })
    .filter((p) => p.abertasNoPeriodo > 0 || p.solucionadasNoPeriodo > 0 || p.abertasAgora > 0)
    .sort((a, b) => b.solucionadasNoPeriodo - a.solucionadasNoPeriodo || b.abertasNoPeriodo - a.abertasNoPeriodo);

  // ── Detalhe: solucionadas no período ──
  const solucionadas: GlpiReportSolucionada[] = resolvidas
    .sort((a, b) => (b.dateSolve!.getTime() - a.dateSolve!.getTime()))
    .slice(0, 100)
    .map((r) => ({
      glpiId: r.glpiId,
      name: r.name,
      requesterName: r.requesterName || String(r.requesterId),
      categoryName: r.categoryName,
      dateSolve: r.dateSolve!.toISOString(),
      resolutionH: r.resolutionDuration && r.resolutionDuration > 0 ? Math.round((r.resolutionDuration / 3600) * 10) / 10 : null,
    }));

  const lastRun = await db.glpiSyncRun.findFirst({ orderBy: { startedAt: "desc" } });
  const lastSync = lastRun
    ? { finishedAt: lastRun.finishedAt?.toISOString() ?? null, ok: !lastRun.fatalError && !!lastRun.finishedAt, processed: lastRun.processed }
    : null;

  return { kpis, porDia, porCategoria, porPessoa, solucionadas, lastSync };
}
