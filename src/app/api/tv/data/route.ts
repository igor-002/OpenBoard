import { NextResponse, type NextRequest } from "next/server";
import { resolveTvWorkspace, getTvData } from "@/server/tv";
import { validateTvAccess } from "@/lib/tv-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// JSON do painel de TV. Exige ?key=TV_TOKEN (mesmo token da página kiosk).
export async function GET(req: NextRequest) {
  if (!(await validateTvAccess(req.nextUrl.searchParams.get("key"), "projetos"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = await resolveTvWorkspace();
  if (!ws) return NextResponse.json({ error: "no workspace" }, { status: 404 });

  const data = await getTvData(ws);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
