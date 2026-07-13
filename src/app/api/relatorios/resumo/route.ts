// GET /api/relatorios/resumo?from=YYYY-MM-DD&to=YYYY-MM-DD (ou ?preset=)
// PDF simples estilo "resumo da semana": projeto → pessoa → concluído/andamento/fila.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";
import { getResumoSemana, resolvePeriodo } from "@/server/relatorios";
import { renderResumoSemanaPdf } from "@/server/pdf/ResumoSemanaPdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasModule(user, "gestao")) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const { from, to } = resolvePeriodo({
    preset: q.get("preset") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  });

  const resumo = await getResumoSemana(user.workspaceId, from, to);
  const buffer = await renderResumoSemanaPdf(resumo);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const filename = `resumo_${iso(from)}_a_${iso(to)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
