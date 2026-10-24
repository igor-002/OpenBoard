import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validaChaveArquivoTxt } from "@/lib/arquivo-txt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// O script do PC confirma que gravou a versão na pasta. Body: { versao, host }.
export async function POST(req: NextRequest) {
  const chave = validaChaveArquivoTxt(req);
  if (!chave.ok) return NextResponse.json({ error: chave.error }, { status: chave.status });

  const body = (await req.json().catch(() => null)) as { versao?: unknown; host?: unknown } | null;
  const versao = typeof body?.versao === "string" ? body.versao : null;
  if (!versao) return NextResponse.json({ error: "versao obrigatória" }, { status: 400 });
  const host = typeof body?.host === "string" ? body.host.slice(0, 100) : null;

  const r = await db.arquivoTxt.updateMany({ where: { id: versao }, data: { aplicadoEm: new Date(), aplicadoPor: host } });
  if (r.count === 0) return NextResponse.json({ error: "versão não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
