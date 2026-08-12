import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasTool } from "@/lib/permissions";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; imagemId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !hasTool(user, "comercial.cadastros")) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const { id, imagemId } = await ctx.params;
  const imagem = await db.solicitacaoCadastroImagem.findUnique({ where: { id: imagemId } });
  if (!imagem || imagem.solicitacaoId !== id) {
    return NextResponse.json({ ok: false, error: "Imagem não encontrada." }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.has("download") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(imagem.data), {
    headers: {
      "Content-Type": imagem.mime,
      "Content-Disposition": `${disposition}; filename="${imagem.nome}"; filename*=UTF-8''${encodeURIComponent(imagem.nome)}`,
      "Content-Length": String(imagem.tamanho),
      "Cache-Control": "private, no-store",
    },
  });
}
