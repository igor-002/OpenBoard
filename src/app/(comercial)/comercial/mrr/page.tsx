import { requireUser } from "@/lib/auth";
import {
  getRelatorioRanking,
  getMetaTime,
  getMetasVendedorMap,
  getVendedoresCRM,
  periodoMesAno,
  diasUteis,
} from "@/server/comercial/queries";
import { MetasManager } from "@/components/comercial/MetasManager";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default async function MrrMetasPage() {
  const user = await requireUser();
  const { mes, ano } = periodoMesAno(0); // mês atual
  const [ranking, metaTime, metasVend, vendedores] = await Promise.all([
    getRelatorioRanking(0),
    getMetaTime(mes, ano),
    getMetasVendedorMap(mes, ano),
    getVendedoresCRM(),
  ]);

  const ativosMap = new Map(ranking.map((r) => [r.vendedorIxcId, r.ativos]));
  const ativosTotalMes = ranking.reduce((s, r) => s + r.ativos, 0);
  const mrrAtivadoMesCents = ranking.reduce((s, r) => s + r.mrrCents, 0);
  const du = diasUteis(mes, ano); // run-rate: projeção pelo ritmo de dias úteis

  const vendRows = vendedores
    .filter((v) => v.ativo)
    .map((v) => ({ ixcId: v.ixcId, nome: v.nome, ativos: ativosMap.get(v.ixcId) ?? 0, meta: metasVend.get(v.ixcId) ?? 0 }))
    .sort((a, b) => b.ativos - a.ativos);

  return (
    <MetasManager
      isAdmin={user.role === "admin"}
      mes={mes}
      ano={ano}
      mesLabel={MESES[mes - 1]}
      ativosTotal={ativosTotalMes}
      metaContratos={metaTime?.metaContratos ?? 0}
      metaMrrCents={metaTime?.metaMrrCents ?? 0}
      vendedores={vendRows}
      mrrAtivadoMesCents={mrrAtivadoMesCents}
      diasUteisTotal={du.total}
      diasUteisPassados={du.passados}
    />
  );
}
