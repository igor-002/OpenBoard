// Dados do painel de TV comercial (kiosk /tv/comercial). Server-only.
// Agrega as queries comerciais já existentes num único payload pros slides.
import "server-only";
import {
  getComercialOverview, getDashboard, getRelatorioRanking, getEvolucao, getMetaTime,
  getTempoAtivacao, getCarteiraResumo, getPipeline, getAlertasAA, periodoMesAno, diasUteis,
  ixcConfigured,
} from "@/server/comercial/queries";
import { getLeadsBoard } from "@/server/comercial/leads";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type ComercialTvData = {
  configured: boolean;
  generatedAt: string;
  mesLabel: string;
  // Único valor escondido: MRR ativo da CARTEIRA (base toda) — decisão 2026-07-08.
  // MRR do mês, pipeline e forecast são normais.
  kpis: {
    contratosAtivosCarteira: number;
    vendasMes: number; // vendidos no mês (data de cadastro)
    ativadosMes: number;
    ativacoesOutroMes: number; // ativações de vendas de meses anteriores
    mrrAtivadosMesCents: number;
    ticketMedioCents: number;
    pipeline: number;
    mrrPipelineCents: number;
    canceladosMes: number;
  };
  ranking: { nome: string; ativos: number; aguardando: number; mrrCents: number; conversao: number }[];
  evolucao: { label: string; ativos: number; aguardando: number; mrrCents: number }[];
  meta: { metaContratos: number; ativos: number; pct: number | null } | null;
  forecastCents: number | null;
  forecastAtivacoes: number | null;
  diasUteis: { passados: number; total: number };
  tempoAtivacao: { mediaDias: number; melhorDias: number; piorDias: number; n: number } | null;
  carteira: { ativos: number; pipeline: number; bloqueados: number; cancelados: number; inativosD: number };
  pipeline: { ixcId: string; clienteNome: string; vendedorNome: string | null; mrrCents: number; dias: number; status: string }[];
  alertas: { clienteNome: string; vendedorNome: string | null; dias: number }[];
  leads: { id: string; label: string; c: string; total: number; valorCents: number }[];
  leadsTotal: number;
};

export async function getComercialTvData(): Promise<ComercialTvData> {
  const { mes, ano } = periodoMesAno(0);
  const [overview, d, ranking, evolucao, metaTime, tempoAtiv, carteira, pipelineCols, alertas, leadsBoard] = await Promise.all([
    getComercialOverview(),
    getDashboard(0),
    getRelatorioRanking(0),
    getEvolucao({}, 6),
    getMetaTime(mes, ano),
    getTempoAtivacao(0),
    getCarteiraResumo(),
    getPipeline(),
    getAlertasAA(7, 12),
    getLeadsBoard(),
  ]);

  const du = diasUteis(mes, ano);
  const metaContratos = metaTime?.metaContratos ?? 0;
  // Forecast pelo ritmo de dias úteis: MRR + ativações projetadas.
  const forecastCents = du.passados > 0 ? Math.round((d.valorAtivosCents / du.passados) * du.total) : null;
  const forecastAtivacoes = du.passados > 0 ? Math.round((d.ativos / du.passados) * du.total) : null;

  // achata as colunas de pipeline em cards ordenados por dias parado (mais críticos no topo)
  const pipelineCards = pipelineCols.flatMap((c) => c.cards).sort((a, b) => b.dias - a.dias).slice(0, 12);

  return {
    configured: overview.configured,
    generatedAt: new Date().toISOString(),
    mesLabel: `${MESES[mes - 1]} ${ano}`,
    kpis: {
      contratosAtivosCarteira: overview.ativos,
      vendasMes: d.vendas,
      ativadosMes: d.ativos,
      ativacoesOutroMes: d.ativacoesOutroPeriodo,
      mrrAtivadosMesCents: d.valorAtivosCents,
      ticketMedioCents: d.ativos > 0 ? Math.round(d.valorAtivosCents / d.ativos) : 0,
      pipeline: d.aguardando,
      mrrPipelineCents: d.valorAguardandoCents,
      canceladosMes: d.cancelados,
    },
    ranking: ranking.slice(0, 8).map((r) => ({ nome: r.nome, ativos: r.ativos, aguardando: r.aguardando, mrrCents: r.mrrCents, conversao: r.conversao })),
    evolucao,
    meta: metaContratos > 0 ? { metaContratos, ativos: d.ativos, pct: Math.round((d.ativos / metaContratos) * 100) } : null,
    forecastCents,
    forecastAtivacoes,
    diasUteis: { passados: du.passados, total: du.total },
    tempoAtivacao: tempoAtiv,
    carteira: { ativos: carteira.ativos, pipeline: carteira.pipeline, bloqueados: carteira.bloqueados, cancelados: carteira.cancelados, inativosD: carteira.inativosD },
    pipeline: pipelineCards,
    alertas: alertas.map((a) => ({ clienteNome: a.clienteNome, vendedorNome: a.vendedorNome, dias: a.dias })),
    leads: leadsBoard.stages.map((s) => ({ id: s.id, label: s.label, c: s.c, total: s.total, valorCents: s.valorCents })),
    leadsTotal: leadsBoard.total,
  };
}

export { ixcConfigured };
