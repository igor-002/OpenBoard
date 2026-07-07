import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────
// Fonte de dados de redes sociais (adapter pattern — mesma separação
// do app de origem, ver docs/HANDOFF-OPENBOARD.md §1).
//
// Os dashboards leem só daqui. A integração Instagram (server/marketing/
// instagram/sync.ts) NÃO é uma fonte alternativa: é um job de escrita que
// grava nas mesmas tabelas (histórico preservado, dashboards sem rate limit).
// ─────────────────────────────────────────────────────────────────

export type SocialMetricName =
  | "followers"
  | "reach"
  | "impressions"
  | "profile_views"
  | "engagement"
  | "posts_count";

export interface AccountInfo {
  id: string;
  username: string;
  displayName: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  accounts: AccountInfo[];
}

export interface MetricRow {
  accountId: string;
  metricName: string;
  value: number;
  period: string; // "YYYY-MM"
}

export interface MediaTypeRow {
  accountId: string;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  count: number;
  period: string;
}

export interface CompanySocialData {
  company: CompanyInfo;
  /** Períodos disponíveis, do mais antigo ao mais recente */
  months: string[];
  metrics: MetricRow[];
  mediaStats: MediaTypeRow[];
}

/** Slug reservado da visão agregada (tab "Todas as empresas"). */
export const ALL_COMPANIES_SLUG = "todas";

export async function listCompanies(): Promise<CompanyInfo[]> {
  const companies = await db.marketingCompany.findMany({
    orderBy: { name: "asc" },
    include: {
      accounts: {
        where: { active: true },
        orderBy: { username: "asc" },
      },
    },
  });
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    accounts: c.accounts.map((a) => ({
      id: a.id,
      username: a.username,
      displayName: a.displayName,
    })),
  }));
}

export async function getCompanyData(slug: string): Promise<CompanySocialData | null> {
  const company = await db.marketingCompany.findUnique({
    where: { slug },
    include: {
      accounts: { where: { active: true }, orderBy: { username: "asc" } },
    },
  });
  if (!company) return null;

  const accountIds = company.accounts.map((a) => a.id);
  const [metrics, mediaStats] = await Promise.all([
    db.accountMetricsHistory.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { period: "asc" },
    }),
    db.mediaTypeStats.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { period: "asc" },
    }),
  ]);

  const months = [...new Set(metrics.map((m) => m.period))].sort();

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      accounts: company.accounts.map((a) => ({
        id: a.id,
        username: a.username,
        displayName: a.displayName,
      })),
    },
    months,
    metrics: metrics.map((m) => ({
      accountId: m.accountId,
      metricName: m.metricName,
      value: m.value,
      period: m.period,
    })),
    mediaStats: mediaStats.map((s) => ({
      accountId: s.accountId,
      mediaType: s.mediaType,
      count: s.count,
      period: s.period,
    })),
  };
}

/** Visão agregada: todas as contas ativas de todas as empresas. */
export async function getAggregateData(): Promise<CompanySocialData> {
  const accounts = await db.instagramAccount.findMany({
    where: { active: true },
    orderBy: { username: "asc" },
  });
  const accountIds = accounts.map((a) => a.id);
  const [metrics, mediaStats] = await Promise.all([
    db.accountMetricsHistory.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { period: "asc" },
    }),
    db.mediaTypeStats.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { period: "asc" },
    }),
  ]);

  return {
    company: {
      id: ALL_COMPANIES_SLUG,
      name: "Todas as empresas",
      slug: ALL_COMPANIES_SLUG,
      accounts: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        displayName: a.displayName,
      })),
    },
    months: [...new Set(metrics.map((m) => m.period))].sort(),
    metrics: metrics.map((m) => ({
      accountId: m.accountId,
      metricName: m.metricName,
      value: m.value,
      period: m.period,
    })),
    mediaStats: mediaStats.map((s) => ({
      accountId: s.accountId,
      mediaType: s.mediaType,
      count: s.count,
      period: s.period,
    })),
  };
}
