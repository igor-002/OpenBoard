import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validaChaveArquivoTxt } from "@/lib/arquivo-txt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Bytes da versão mais nova, pro script do PC gravar na pasta. A versão vai no
// header X-Versao; o script manda ?versao=<a que já tem> e recebe 304 sem corpo
// se nada mudou.
export async function GET(req: NextRequest) {
  const chave = validaChaveArquivoTxt(req);
  if (!chave.ok) return NextResponse.json({ error: chave.error }, { status: chave.status });

  const meta = await db.arquivoTxt.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!meta) return new NextResponse(null, { status: 204 });
  if (req.nextUrl.searchParams.get("versao") === meta.id) {
    return new NextResponse(null, { status: 304, headers: { "X-Versao": meta.id } });
  }
  const atual = await db.arquivoTxt.findUniqueOrThrow({ where: { id: meta.id }, select: { data: true } });
  return new NextResponse(new Uint8Array(atual.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Versao": meta.id,
    },
  });
}
