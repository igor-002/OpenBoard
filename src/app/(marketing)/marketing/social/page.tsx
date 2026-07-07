import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  listCompanies,
  getCompanyData,
  getAggregateData,
  ALL_COMPANIES_SLUG,
} from "@/server/marketing/social-source";
import {
  socialKpis,
  mediaTypeBreakdown,
  viewsByFollowType,
  viewsByMediaProduct,
  engagementByAccount,
  accountsTable,
  metricSeries,
} from "@/lib/marketing/social-math";
import { currentPeriod, previousPeriod, monthLong, fmtNumber } from "@/lib/marketing/format";
import { StatCard } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SocialFilterBar } from "@/components/marketing/SocialFilterBar";
import { SocialDonutCard, BarsList, EvolutionChart, PALETTE } from "@/components/marketing/SocialCharts";

export default async function RedesSociaisPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; periodo?: string; perfil?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const empresaSlug = sp.empresa || ALL_COMPANIES_SLUG;

  const [companies, data] = await Promise.all([
    listCompanies(),
    empresaSlug === ALL_COMPANIES_SLUG
      ? getAggregateData()
      : getCompanyData(empresaSlug).then((d) => d ?? getAggregateData()),
  ]);

  const months = data.months.length > 0 ? data.months : [currentPeriod()];
  const period = sp.periodo && months.includes(sp.periodo) ? sp.periodo : months[months.length - 1];
  const prevPeriod = previousPeriod(period);

  // Drill-down por perfil (?perfil=username) — restringe a visão a 1 conta só.
  const selectedAccount = sp.perfil ? data.company.accounts.find((a) => a.username === sp.perfil) : undefined;
  const accountIds = selectedAccount ? [selectedAccount.id] : data.company.accounts.map((a) => a.id);
  const usernameToId = new Map(data.company.accounts.map((a) => [a.username, a.id]));

  const kpis = socialKpis(data, accountIds, period, prevPeriod);
  const media = mediaTypeBreakdown(data, accountIds, period);
  const followBreak = viewsByFollowType(data, accountIds, period);
  const mediaBreak = viewsByMediaProduct(data, accountIds, period);
  const accounts = accountsTable(data, period, prevPeriod).filter((a) => accountIds.includes(a.id));
  const engagement = engagementByAccount(data, period).filter((e) => accountIds.includes(usernameToId.get(e.username)!));

  // Evolução de seguidores — paleta por conta é estável (índice fixo na lista
  // ordenada da empresa), não muda com o drill-down por perfil.
  const followersSeriesData = metricSeries(data, accountIds, "followers");
  const evolutionSeries = data.company.accounts
    .filter((a) => accountIds.includes(a.id))
    .map((a, i) => ({
      key: a.id,
      label: a.displayName,
      color: PALETTE[data.company.accounts.findIndex((x) => x.id === a.id) % PALETTE.length] ?? PALETTE[i % PALETTE.length],
      values: followersSeriesData.map((row) => row[a.username] as number | null),
    }));

  const qs = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (empresaSlug !== ALL_COMPANIES_SLUG) params.set("empresa", empresaSlug);
    params.set("periodo", period);
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
    return `/marketing/social?${params.toString()}`;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Redes Sociais</h1>
          <p className="page-sub">
            {selectedAccount ? `@${selectedAccount.username} · ${selectedAccount.displayName}` : data.company.name} — {monthLong(period)}
            {selectedAccount && (
              <>
                {" · "}
                <Link href={qs({})}>voltar pra visão da empresa</Link>
              </>
            )}
          </p>
        </div>
        <Link className="btn btn-ghost" href="/marketing/social/contas">
          <Icon name="grid" size={15} /> Contas Instagram
        </Link>
      </div>

      <SocialFilterBar
        companies={companies.map((c) => ({ slug: c.slug, name: c.name }))}
        empresa={empresaSlug}
        period={period}
        months={months}
      />

      {data.company.accounts.length === 0 ? (
        <div className="card card-pad muted" style={{ marginTop: "var(--gap)" }}>
          Nenhuma conta Instagram ativa nesta empresa. Conecte uma em{" "}
          <Link href="/marketing/social/contas">Contas Instagram</Link>.
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "var(--gap)", marginTop: "var(--gap)" }}>
            {kpis.map((k) => (
              <StatCard
                key={k.metric}
                icon="chart"
                label={k.label}
                value={fmtNumber(k.delta.current)}
                trend={k.delta.deltaPct != null ? Math.round(k.delta.deltaPct) : undefined}
                foot={k.missing ? "não coletado no período" : k.hint}
                accent={k.delta.direction === "down" ? "var(--st-risk)" : "var(--primary)"}
              />
            ))}
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            {months.length > 1 ? (
              <Card title="Evolução de seguidores" sub="Por perfil, mês a mês" pad>
                <EvolutionChart months={months} series={evolutionSeries} />
              </Card>
            ) : (
              // 1 mês só não tem "evolução" — linha vira ponto solto. Mostra
              // barras de seguidores; a linha assume quando houver 2+ meses.
              <Card
                title="Seguidores por conta"
                sub={`${monthLong(period)} — a evolução mês a mês aparece a partir do próximo mês`}
                pad
              >
                <BarsList
                  items={accounts
                    .filter((a) => !a.followersMissing)
                    .map((a) => ({ label: a.displayName, value: a.followers.current }))}
                />
              </Card>
            )}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
            <Card title="Engajamento por conta" sub={monthLong(period)} pad>
              <BarsList items={engagement.map((e) => ({ label: e.displayName, value: e.engagement }))} />
            </Card>
            <SocialDonutCard
              title="Tipos de mídia"
              sub={monthLong(period)}
              items={media.map((m) => ({ label: m.label, value: m.count }))}
            />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
            <SocialDonutCard
              title="Visualizações por origem"
              sub="Seguidores × não seguidores"
              items={followBreak.map((b) => ({ label: b.label, value: b.value }))}
            />
            <SocialDonutCard
              title="Visualizações por conteúdo"
              sub="Reels, Stories, Posts…"
              items={mediaBreak.map((b) => ({ label: b.label, value: b.value }))}
            />
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            <Card title="Contas" sub={monthLong(period)} pad={false}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Conta</th>
                    <th style={{ textAlign: "right" }}>Seguidores</th>
                    <th style={{ textAlign: "right" }}>Variação</th>
                    <th style={{ textAlign: "right" }}>Engajamento</th>
                    <th style={{ textAlign: "right" }}>Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {selectedAccount ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{a.displayName}</div>
                            <div className="muted" style={{ fontSize: 12 }}>@{a.username}</div>
                          </>
                        ) : (
                          <Link href={qs({ perfil: a.username })} style={{ display: "block" }}>
                            <div style={{ fontWeight: 700 }}>{a.displayName}</div>
                            <div className="muted" style={{ fontSize: 12 }}>@{a.username}</div>
                          </Link>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {a.followersMissing ? <span className="muted">—</span> : fmtNumber(a.followers.current)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {a.followers.deltaPct != null ? (
                          <span style={{ color: a.followers.direction === "down" ? "var(--st-risk)" : "var(--st-done)", fontWeight: 700 }}>
                            {a.followers.deltaPct > 0 ? "+" : ""}
                            {a.followers.deltaPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(a.engagement)}</td>
                      <td style={{ textAlign: "right" }}>{fmtNumber(a.posts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
