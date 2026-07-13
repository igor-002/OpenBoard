// GET /api/relatorios/produtividade?from=YYYY-MM-DD&to=YYYY-MM-DD (ou ?preset=)
// Baixa o PDF completo de produtividade do período. Auth: sessão + módulo gestao.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasModule } from "@/lib/permissions";
import { getProdutividadeReport, resolvePeriodo } from "@/server/relatorios";
import { renderProdutividadePdf } from "@/server/pdf/ProdutividadePdf";

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

  const report = await getProdutividadeReport(user.workspaceId, from, to);
  const buffer = await renderProdutividadePdf(report);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const filename = `produtividade_${iso(from)}_a_${iso(to)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
