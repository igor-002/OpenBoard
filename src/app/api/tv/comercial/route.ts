import { NextResponse } from "next/server";
import { getComercialTvData } from "@/server/comercial/tv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// JSON do painel de TV comercial. Acesso livre (prefixo /api/tv é público no proxy).
// Usado pelo refetch periódico do cliente.
export async function GET() {
  const data = await getComercialTvData();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
