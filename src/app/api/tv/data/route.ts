import { NextResponse } from "next/server";
import { resolveTvWorkspace, getTvData } from "@/server/tv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// JSON do painel de TV. Protegido por token (?key=). Usado pelo refetch do cliente.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const ws = await resolveTvWorkspace(key);
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getTvData(ws);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
