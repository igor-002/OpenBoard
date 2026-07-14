import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CampaignsManager } from "@/components/marketing/CampaignsManager";

export default async function CampanhasPage() {
  await requireUser();
  const campaigns = await db.linkCampaign.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { links: true } } },
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-sub">
            Agrupe links curtos por campanha (ex.: panfletagem de julho, cartaz da loja).
          </p>
        </div>
      </div>
      <CampaignsManager
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          links: c._count.links,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
