// GET /marketing/quadro/anexo/[id] — baixa/abre um anexo do card do quadro.
// Único lugar que lê a coluna `data` (bytea) do MktCardAttachment.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";
import { getAttachmentBytes } from "@/server/marketing/board";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !hasModule(user, "marketing")) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const a = await getAttachmentBytes(id);
  if (!a) return NextResponse.json({ ok: false, error: "Anexo não encontrado." }, { status: 404 });

  return new NextResponse(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `inline; filename="${a.filename}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "Content-Length": String(a.data.length),
      "Cache-Control": "private, no-store",
    },
  });
}
