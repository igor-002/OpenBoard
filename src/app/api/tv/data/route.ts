import { NextResponse } from "next/server";
import { resolveTvWorkspace, getTvData } from "@/server/tv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// JSON do painel de TV. Acesso livre (sem token). Usado pelo refetch do cliente.
export async function GET() {
  const ws = await resolveTvWorkspace();
  if (!ws) return NextResponse.json({ error: "no workspace" }, { status: 404 });

  const data = await getTvData(ws);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
