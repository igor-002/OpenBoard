// GET /api/comercial/leads/[id]/anexos/[anexoId] — baixa o PDF da proposta.
// Único lugar que lê a coluna `data` (bytea) do LeadAnexo.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; anexoId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !hasModule(user, "leads")) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const { id, anexoId } = await ctx.params;
  const anexo = await db.leadAnexo.findUnique({ where: { id: anexoId } });
  // confere o vínculo: o anexo tem que ser do lead da URL
  if (!anexo || anexo.leadId !== id) {
    return NextResponse.json({ ok: false, error: "Anexo não encontrado." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(anexo.data), {
    headers: {
      "Content-Type": anexo.mime,
      // inline: abre no visualizador do browser; o nome já vem sanitizado do upload
      "Content-Disposition": `inline; filename="${anexo.nome}"; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
      "Content-Length": String(anexo.tamanho),
      "Cache-Control": "private, no-store",
    },
  });
}
