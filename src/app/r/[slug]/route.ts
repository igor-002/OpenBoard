// Redirect público do encurtador: GET /r/:slug → 302 pro destino.
// Sem sessão (QR impresso é escaneado por qualquer um) — mesmo modelo de /tv.
// Analytics roda DEPOIS da response via after(); o scan nunca espera banco/geo.
import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cacheGet, cacheSet, type CachedLink } from "@/lib/short/slug-cache";
import { clientIp } from "@/lib/short/ip";
import { recordClick } from "@/server/marketing/clicks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function lookup(slug: string): Promise<CachedLink | null> {
  const cached = cacheGet(slug);
  if (cached.hit) return cached.link;
  const link = await db.shortLink.findUnique({
    where: { slug },
    select: { id: true, destination: true, active: true, expiresAt: true },
  });
  cacheSet(slug, link);
  return link;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const link = await lookup(slug);

  const unavailable =
    !link || !link.active || (link.expiresAt !== null && link.expiresAt.getTime() < Date.now());
  if (unavailable) {
    // Página amigável em vez de 404 seco (o QR no papel continua existindo).
    // Host vem dos headers de proxy — nextUrl atrás do nginx aponta pro bind
    // interno (0.0.0.0:3000) e o browser não chegaria lá.
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    return NextResponse.redirect(`${proto}://${host}${basePath}/r/indisponivel`, 302);
  }

  // Captura ANTES do after — a request pode não ser legível depois da response.
  const ua = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const ip = clientIp(request);
  after(() => recordClick({ linkId: link.id, ua, referer, ip }));

  return NextResponse.redirect(link.destination, 302);
}
