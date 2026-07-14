// Fonte de dados do encurtador (lista + detalhe com analytics). Fica fora dos
// componentes: páginas só chamam e renderizam (regra de pureza do render —
// Date.now aqui é legítimo, é dado do banco derivado no fetch).
import "server-only";
import { db } from "@/lib/db";
import { shortBaseUrl } from "@/lib/short/config";

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function listShortLinks() {
  const [links, campaigns, base] = await Promise.all([
    db.shortLink.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { clicks: { where: { isBot: false } } } },
      },
    }),
    db.linkCampaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    shortBaseUrl(),
  ]);
  const now = Date.now();
  return {
    base,
    campaigns,
    links: links.map((l) => ({
      id: l.id,
      slug: l.slug,
      shortUrl: `${base}/r/${l.slug}`,
      destination: l.destination,
      title: l.title,
      kind: l.kind,
      waPhone: l.waPhone,
      waMessage: l.waMessage,
      tags: l.tags,
      active: l.active,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      expired: l.expiresAt !== null && l.expiresAt.getTime() < now,
      campaignId: l.campaign?.id ?? null,
      campaignName: l.campaign?.name ?? null,
      qrColor: l.qrColor,
      qrBgColor: l.qrBgColor,
      qrLogo: l.qrLogo,
      clicks: l._count.clicks,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export async function getShortLinkDetail(id: string) {
  const link = await db.shortLink.findUnique({
    where: { id },
    include: { campaign: { select: { name: true } } },
  });
  if (!link) return null;

  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since30 = new Date(now - 29 * DAY_MS); // 30 dias incluindo hoje
  const real = { linkId: id, isBot: false } as const;

  const [base, total, last7, botCount, byDevice, byRegion, byCountry, recent, recentDays] =
    await Promise.all([
      shortBaseUrl(),
      db.linkClick.count({ where: real }),
      db.linkClick.count({ where: { ...real, createdAt: { gte: since7 } } }),
      db.linkClick.count({ where: { linkId: id, isBot: true } }),
      db.linkClick.groupBy({ by: ["deviceType"], where: real, _count: { _all: true } }),
      db.linkClick.groupBy({ by: ["region"], where: real, _count: { _all: true } }),
      db.linkClick.groupBy({ by: ["country"], where: real, _count: { _all: true } }),
      db.linkClick.findMany({ where: { linkId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.linkClick.findMany({
        where: { ...real, createdAt: { gte: since30 } },
        select: { createdAt: true },
      }),
    ]);

  // Série diária dos últimos 30 dias (dias sem clique = 0).
  const perDay = new Map<string, number>();
  for (const c of recentDays) {
    const k = dayKey(c.createdAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const daily: { day: string; label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    daily.push({
      day: dayKey(d),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: perDay.get(dayKey(d)) ?? 0,
    });
  }

  const sortCount = <T extends { _count: { _all: number } }>(rows: T[]) =>
    [...rows].sort((a, b) => b._count._all - a._count._all);

  return {
    link: {
      id: link.id,
      slug: link.slug,
      shortUrl: `${base}/r/${link.slug}`,
      destination: link.destination,
      title: link.title,
      kind: link.kind,
      active: link.active,
      expired: link.expiresAt !== null && link.expiresAt.getTime() < now,
      campaignName: link.campaign?.name ?? null,
      tags: link.tags,
      createdAt: link.createdAt.toISOString(),
    },
    stats: { total, last7, botCount },
    daily,
    byDevice: sortCount(byDevice).map((r) => ({
      label: r.deviceType ?? "desconhecido",
      value: r._count._all,
    })),
    byRegion: sortCount(byRegion)
      .filter((r) => r.region)
      .map((r) => ({ label: r.region as string, value: r._count._all })),
    byCountry: sortCount(byCountry)
      .filter((r) => r.country)
      .map((r) => ({ label: r.country as string, value: r._count._all })),
    recent: recent.map((c) => ({
      id: c.id,
      at: c.createdAt.toISOString(),
      city: c.city,
      region: c.region,
      country: c.country,
      deviceType: c.deviceType,
      os: c.os,
      browser: c.browser,
      referrer: c.referrer,
      isBot: c.isBot,
    })),
  };
}
