import { NextResponse, type NextRequest } from "next/server";
import { getComercialTvData } from "@/server/comercial/tv";
import { validateTvAccess } from "@/lib/tv-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// JSON do painel de TV comercial. Exige ?key=TV_TOKEN (mesmo token da página kiosk).
export async function GET(req: NextRequest) {
  if (!(await validateTvAccess(req.nextUrl.searchParams.get("key"), "comercial"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const data = await getComercialTvData();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
