// PDF do relatório de Demandas GLPI (@react-pdf/renderer). Renderizado na rota
// GET /api/marketing/relatorios. Cores = hex do tema (CSS vars não existem aqui).
// Baseado em ProdutividadePdf (relatório de Projetos).
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { GlpiActivityReport } from "@/server/glpi/report";

const C = {
  primary: "#f2691f",
  done: "#16a34a",
  risk: "#e5484d",
  blue: "#2d6ff2",
  purple: "#7a5ae0",
  ink: "#16181d",
  ink2: "#3f4450",
  muted: "#6b7280",
  line: "#e5e7eb",
  surface: "#f5f6f8",
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: C.ink2 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: C.primary },
  sub: { fontSize: 9, color: C.muted, marginTop: 3 },
  kpiRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  kpi: { flex: 1, backgroundColor: C.surface, borderRadius: 6, padding: 8 },
  kpiVal: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.ink },
  kpiLbl: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 3, marginBottom: 2 },
  thCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3, alignItems: "center" },
  barTrack: { height: 5, backgroundColor: C.surface, borderRadius: 2.5, flexDirection: "row", overflow: "hidden" },
  foot: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
});

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (d: Date) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Kpi({ val, lbl }: { val: string; lbl: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiVal}>{val}</Text>
      <Text style={s.kpiLbl}>{lbl}</Text>
    </View>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={s.barTrack}>
      <View style={{ width: `${Math.min(100, Math.max(pct, 0))}%`, backgroundColor: color, borderRadius: 2.5 }} />
    </View>
  );
}

export function DemandasGlpiPdf({ r, from, to, geradoEm }: { r: GlpiActivityReport; from: Date; to: Date; geradoEm: Date }) {
  const k = r.kpis;
  const maxDia = Math.max(...r.porDia.map((d) => Math.max(d.abertas, d.solucionadas)), 1);
  const maxCat = Math.max(...r.porCategoria.map((c) => c.value), 1);
  const maxPessoa = Math.max(...r.porPessoa.map((m) => Math.max(m.abertasNoPeriodo, m.solucionadasNoPeriodo)), 1);

  return (
    <Document title={`Relatório de Demandas GLPI — ${fmtDate(from)} a ${fmtDate(to)}`} author="OpenBoard">
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Text style={s.h1}>Relatório de Demandas</Text>
            <Text style={s.sub}>Marketing (GLPI) · período {fmtDate(from)} — {fmtDate(to)}</Text>
          </View>
          <Text style={{ fontSize: 8, color: C.muted }}>gerado em {fmtDT(geradoEm)}</Text>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <Kpi val={String(k.abertasNoPeriodo)} lbl="Abertas no período" />
          <Kpi val={`${k.solucionadasNoPeriodo}${k.taxaSolucaoPct != null ? ` (${k.taxaSolucaoPct}%)` : ""}`} lbl="Solucionadas (% das abertas)" />
          <Kpi val={k.tempoMedianoH != null ? `${k.tempoMedianoH}h` : "—"} lbl="Tempo até solução (mediana)" />
          <Kpi val={String(k.abertasAgora)} lbl="Abertas agora" />
          <Kpi val={String(k.paradasAgora)} lbl="Paradas (>=3d sem mov.)" />
        </View>

        {/* Por dia/semana */}
        <Text style={s.h2}>Atividade no período (abertas x solucionadas)</Text>
        <View style={s.th}>
          <Text style={[s.thCell, { width: 70 }]}>Data</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Abertas</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Solucionadas</Text>
          <Text style={[s.thCell, { width: 70, textAlign: "right" }]}>Ab. / Sol.</Text>
        </View>
        {r.porDia.map((d) => (
          <View key={d.label} style={s.tr}>
            <Text style={{ width: 70 }}>{d.label}</Text>
            <View style={{ flex: 1, marginRight: 6 }}><Bar pct={(d.abertas / maxDia) * 100} color={C.blue} /></View>
            <View style={{ flex: 1, marginRight: 6 }}><Bar pct={(d.solucionadas / maxDia) * 100} color={C.done} /></View>
            <Text style={{ width: 70, textAlign: "right" }}>{d.abertas} / {d.solucionadas}</Text>
          </View>
        ))}

        {/* Por categoria */}
        {r.porCategoria.length > 0 && (
          <>
            <Text style={s.h2}>Por categoria (abertas no período)</Text>
            {r.porCategoria.map((c) => (
              <View key={c.label} style={s.tr}>
                <Text style={{ width: 150 }}>{c.label}</Text>
                <View style={{ flex: 1, marginRight: 8 }}><Bar pct={(c.value / maxCat) * 100} color={C.primary} /></View>
                <Text style={{ width: 40, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{c.value}</Text>
              </View>
            ))}
          </>
        )}

        <View style={s.foot} fixed>
          <Text>OpenBoard — relatório de demandas (GLPI)</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        {/* Por pessoa */}
        <Text style={s.h2}>Por pessoa</Text>
        <View style={s.th}>
          <Text style={[s.thCell, { width: 110 }]}>Pessoa</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Solucionadas</Text>
          <Text style={[s.thCell, { width: 44, textAlign: "right" }]}>Abertas</Text>
          <Text style={[s.thCell, { width: 52, textAlign: "right" }]}>Solucion.</Text>
          <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>T. mediana</Text>
          <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>Ab. agora</Text>
          <Text style={[s.thCell, { width: 48, textAlign: "right" }]}>Paradas</Text>
        </View>
        {r.porPessoa.map((m) => (
          <View key={m.requesterId} style={s.tr} wrap={false}>
            <Text style={{ width: 110, fontFamily: "Helvetica-Bold", color: C.ink }}>{m.name}</Text>
            <View style={{ flex: 1, marginRight: 6 }}><Bar pct={(m.solucionadasNoPeriodo / maxPessoa) * 100} color={C.done} /></View>
            <Text style={{ width: 44, textAlign: "right" }}>{m.abertasNoPeriodo}</Text>
            <Text style={{ width: 52, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.done }}>{m.solucionadasNoPeriodo}</Text>
            <Text style={{ width: 60, textAlign: "right" }}>{m.tempoMedianoH != null ? `${m.tempoMedianoH}h` : "—"}</Text>
            <Text style={{ width: 60, textAlign: "right" }}>{m.abertasAgora}</Text>
            <Text style={{ width: 48, textAlign: "right", color: m.paradasAgora ? C.risk : C.ink2 }}>{m.paradasAgora}</Text>
          </View>
        ))}

        {/* Solucionadas detalhe */}
        <Text style={s.h2}>Solucionadas no período — detalhe ({r.solucionadas.length})</Text>
        {r.solucionadas.length === 0 && <Text style={{ color: C.muted, marginTop: 4 }}>Nenhum chamado solucionado no período.</Text>}
        <View style={s.th}>
          <Text style={[s.thCell, { flex: 1 }]}>Chamado</Text>
          <Text style={[s.thCell, { width: 90 }]}>Pessoa</Text>
          <Text style={[s.thCell, { width: 90 }]}>Categoria</Text>
          <Text style={[s.thCell, { width: 70 }]}>Solucionado</Text>
          <Text style={[s.thCell, { width: 40, textAlign: "right" }]}>Tempo</Text>
        </View>
        {r.solucionadas.map((t) => (
          <View key={t.glpiId} style={s.tr} wrap={false}>
            <Text style={{ flex: 1, paddingRight: 6 }}>#{t.glpiId} · {t.name}</Text>
            <Text style={{ width: 90 }}>{t.requesterName}</Text>
            <Text style={{ width: 90, color: C.muted }}>{t.categoryName ?? "—"}</Text>
            <Text style={{ width: 70 }}>{fmtDate(new Date(t.dateSolve))}</Text>
            <Text style={{ width: 40, textAlign: "right" }}>{t.resolutionH != null ? `${t.resolutionH}h` : "—"}</Text>
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>OpenBoard — relatório de demandas (GLPI)</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDemandasGlpiPdf(args: { r: GlpiActivityReport; from: Date; to: Date; geradoEm: Date }): Promise<Buffer> {
  return renderToBuffer(<DemandasGlpiPdf {...args} />);
}
