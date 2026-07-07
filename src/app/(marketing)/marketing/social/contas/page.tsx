import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ContasManager } from "@/components/marketing/ContasManager";

export default async function ContasInstagramPage() {
  await requireUser();
  const companies = await db.marketingCompany.findMany({
    orderBy: { name: "asc" },
    include: { accounts: { orderBy: { username: "asc" } } },
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Contas Instagram</h1>
          <p className="page-sub">
            Cadastre empresas e conecte contas do Instagram (token de longa duração) para o
            sync automático de métricas.
          </p>
        </div>
      </div>
      <ContasManager
        companies={companies.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          accounts: c.accounts.map((a) => ({
            id: a.id,
            username: a.username,
            displayName: a.displayName,
            active: a.active,
            hasToken: !!a.accessToken,
            tokenExpiresAt: a.tokenExpiresAt?.toISOString() ?? null,
            lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}
