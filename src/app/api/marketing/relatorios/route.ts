// GET /api/marketing/relatorios?from=YYYY-MM-DD&to=YYYY-MM-DD (ou ?preset=)
// Baixa o PDF do relatório de Demandas GLPI do período. Auth: sessão (módulo
// Marketing não tem RBAC — qualquer usuário logado, igual às páginas).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolvePeriodo } from "@/server/relatorios";
import { getGlpiActivityReport } from "@/server/glpi/report";
import { glpiConfigured } from "@/server/glpi/queries";
import { renderDemandasGlpiPdf } from "@/server/pdf/DemandasGlpiPdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  if (!glpiConfigured()) return NextResponse.json({ ok: false, error: "GLPI não configurado." }, { status: 400 });

  const q = req.nextUrl.searchParams;
  const { from, to } = resolvePeriodo({
    preset: q.get("preset") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  });

  const report = await getGlpiActivityReport(from, to);
  const buffer = await renderDemandasGlpiPdf({ r: report, from, to, geradoEm: new Date() });

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const filename = `demandas_${iso(from)}_a_${iso(to)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
