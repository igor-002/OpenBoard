import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getShortLinkDetail } from "@/server/marketing/short-links";
import { LinkDetail } from "@/components/marketing/LinkDetail";

export default async function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const detail = await getShortLinkDetail(id);
  if (!detail) notFound();

  return (
    <LinkDetail
      link={detail.link}
      stats={detail.stats}
      daily={detail.daily}
      byDevice={detail.byDevice}
      byRegion={detail.byRegion}
      byCountry={detail.byCountry}
      recent={detail.recent}
    />
  );
}
