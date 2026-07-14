import { requireUser } from "@/lib/auth";
import { getLinksReport } from "@/server/marketing/short-links";
import { LinksReport } from "@/components/marketing/LinksReport";

const VALID_DAYS = [7, 30, 90, 0]; // 0 = tudo

export default async function LinksRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; campanha?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const dias = VALID_DAYS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const campaignId = sp.campanha || null;

  const report = await getLinksReport({ days: dias, campaignId });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatório de Cliques</h1>
          <p className="page-sub">
            De onde vêm os acessos dos seus links curtos: origem, campanha, dispositivo e região.
            Scans de QR não têm origem de rede — aparecem como &quot;QR / direto&quot;.
          </p>
        </div>
      </div>
      <LinksReport dias={dias} campaignId={campaignId} report={report} />
    </div>
  );
}
