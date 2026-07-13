// PDF do relatório de produtividade (@react-pdf/renderer). Renderizado na rota
// GET /api/relatorios/produtividade. Cores = hex do tema (CSS vars não existem aqui).
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ProdutividadeReport } from "@/server/relatorios";
import type { TaskOrigin } from "@/lib/types";

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

const ORIGEM: Record<TaskOrigin, { label: string; c: string }> = {
  planejada: { label: "Planejada", c: C.muted },
  avulsa: { label: "Avulsa", c: C.purple },
  presencial: { label: "Presencial", c: C.blue },
};

const COL_LABEL: Record<string, string> = { todo: "A fazer", doing: "Em andamento", review: "Revisão", done: "Concluída" };

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
  right: { textAlign: "right" },
  barTrack: { height: 5, backgroundColor: C.surface, borderRadius: 2.5, flexDirection: "row", overflow: "hidden" },
  foot: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
  relato: { marginTop: 3, fontSize: 8.5, color: C.ink2, lineHeight: 1.45 },
  chip: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
});

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (d: Date) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtMin = (min: number) => {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

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

export function ProdutividadePdf({ r }: { r: ProdutividadeReport }) {
  const k = r.kpis;
  const taxa = k.criadas > 0 ? Math.round((k.concluidas / k.criadas) * 100) : null;
  const desvio = k.estimadoTotalMin > 0 ? Math.round(((k.realTotalMin - k.estimadoTotalMin) / k.estimadoTotalMin) * 100) : null;
  const maxDia = Math.max(...r.porDia.map((d) => Math.max(d.criadas, d.concluidas)), 1);
  const maxMembro = Math.max(...r.porMembro.map((m) => Math.max(m.criadas, m.concluidas)), 1);
  const totalOrigem = r.porOrigem.reduce((a, o) => a + o.criadas, 0) || 1;

  return (
    <Document title={`Relatório de produtividade — ${fmtDate(r.from)} a ${fmtDate(r.to)}`} author="OpenBoard">
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Text style={s.h1}>Relatório de produtividade</Text>
            <Text style={s.sub}>
              {r.workspaceName} · período {fmtDate(r.from)} — {fmtDate(r.to)}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: C.muted }}>gerado em {fmtDT(r.geradoEm)}</Text>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <Kpi val={String(k.criadas)} lbl="Criadas no período" />
          <Kpi val={`${k.concluidas}${taxa != null ? ` (${taxa}%)` : ""}`} lbl="Concluídas (% das criadas)" />
          <Kpi val={String(k.abertasAtuais)} lbl="Abertas agora" />
          <Kpi val={String(k.vencidasAtuais)} lbl="Vencidas agora" />
          <Kpi val={k.horasApontadas > 0 ? `${k.horasApontadas}h` : "—"} lbl="Horas apontadas" />
        </View>
        <View style={s.kpiRow}>
          <Kpi val={k.tempoMedioExecMin != null ? fmtMin(k.tempoMedioExecMin) : "—"} lbl="Tempo médio de execução" />
          <Kpi val={k.leadTimeMedioDias != null ? `${k.leadTimeMedioDias}d` : "—"} lbl="Lead time médio (criação até fim)" />
          <Kpi val={k.noPrazoPct != null ? `${k.noPrazoPct}%` : "—"} lbl="Concluídas no prazo" />
          <Kpi val={k.estimadoTotalMin > 0 ? `${fmtMin(k.estimadoTotalMin)} -> ${fmtMin(k.realTotalMin)}` : "—"} lbl="Estimado -> real (soma)" />
          <Kpi val={desvio != null ? `${desvio > 0 ? "+" : ""}${desvio}%` : "—"} lbl="Desvio de estimativa" />
        </View>

        {/* Origem */}
        <Text style={s.h2}>Origem da demanda (criadas no período)</Text>
        {r.porOrigem.map((o) => (
          <View key={o.origem} style={s.tr}>
            <Text style={[s.chip, { width: 70, color: ORIGEM[o.origem].c }]}>{ORIGEM[o.origem].label}</Text>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Bar pct={(o.criadas / totalOrigem) * 100} color={ORIGEM[o.origem].c} />
            </View>
            <Text style={{ width: 90, textAlign: "right" }}>
              {o.criadas} criada{o.criadas === 1 ? "" : "s"} ({Math.round((o.criadas / totalOrigem) * 100)}%) · {o.concluidas} concl.
            </Text>
          </View>
        ))}

        {/* Por dia/semana */}
        <Text style={s.h2}>Atividade {r.porDia[0]?.label.includes("–") ? "por semana" : "por dia"}</Text>
        <View style={s.th}>
          <Text style={[s.thCell, { width: 70 }]}>Data</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Criadas</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Concluídas</Text>
          <Text style={[s.thCell, { width: 70, textAlign: "right" }]}>Cri. / Con.</Text>
        </View>
        {r.porDia.map((d) => (
          <View key={d.iso} style={s.tr}>
            <Text style={{ width: 70 }}>{d.label}</Text>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Bar pct={(d.criadas / maxDia) * 100} color={C.primary} />
            </View>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Bar pct={(d.concluidas / maxDia) * 100} color={C.done} />
            </View>
            <Text style={{ width: 70, textAlign: "right" }}>
              {d.criadas} / {d.concluidas}
            </Text>
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>OpenBoard — relatório de produtividade</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        {/* Por pessoa */}
        <Text style={s.h2}>Produtividade por pessoa</Text>
        <View style={s.th}>
          <Text style={[s.thCell, { width: 110 }]}>Pessoa</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Concluídas</Text>
          <Text style={[s.thCell, { width: 40, textAlign: "right" }]}>Criadas</Text>
          <Text style={[s.thCell, { width: 42, textAlign: "right" }]}>Concl.</Text>
          <Text style={[s.thCell, { width: 52, textAlign: "right" }]}>T. médio</Text>
          <Text style={[s.thCell, { width: 70, textAlign: "right" }]}>{"Est. -> real"}</Text>
          <Text style={[s.thCell, { width: 44, textAlign: "right" }]}>No prazo</Text>
          <Text style={[s.thCell, { width: 40, textAlign: "right" }]}>Horas</Text>
          <Text style={[s.thCell, { width: 42, textAlign: "right" }]}>Abertas</Text>
        </View>
        {r.porMembro.map((m) => (
          <View key={m.id} style={s.tr} wrap={false}>
            <View style={{ width: 110 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{m.name}</Text>
              <Text style={{ fontSize: 7, color: C.muted }}>{m.jobTitle}</Text>
            </View>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Bar pct={(m.concluidas / maxMembro) * 100} color={C.done} />
            </View>
            <Text style={{ width: 40, textAlign: "right" }}>{m.criadas}</Text>
            <Text style={{ width: 42, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.done }}>{m.concluidas}</Text>
            <Text style={{ width: 52, textAlign: "right" }}>{m.tempoMedioMin != null ? fmtMin(m.tempoMedioMin) : "—"}</Text>
            <Text style={{ width: 70, textAlign: "right", color: m.estimadoMin > 0 && m.realMin > m.estimadoMin ? C.risk : C.ink2 }}>
              {m.estimadoMin > 0 ? `${fmtMin(m.estimadoMin)} -> ${fmtMin(m.realMin)}` : "—"}
            </Text>
            <Text style={{ width: 44, textAlign: "right" }}>{m.noPrazoPct != null ? `${m.noPrazoPct}%` : "—"}</Text>
            <Text style={{ width: 40, textAlign: "right" }}>{m.horasApontadas > 0 ? `${m.horasApontadas}h` : "—"}</Text>
            <Text style={{ width: 42, textAlign: "right" }}>{m.abertasAtuais}</Text>
          </View>
        ))}

        {/* Por tipo */}
        <Text style={s.h2}>Por tipo de atividade</Text>
        <View style={s.th}>
          <Text style={[s.thCell, { width: 150 }]}>Tipo</Text>
          <Text style={[s.thCell, { width: 45, textAlign: "right" }]}>Criadas</Text>
          <Text style={[s.thCell, { width: 55, textAlign: "right" }]}>Concluídas</Text>
          <Text style={[s.thCell, { width: 75, textAlign: "right" }]}>Tempo médio</Text>
          <Text style={[s.thCell, { width: 75, textAlign: "right" }]}>Est. médio</Text>
        </View>
        {r.porTipo.map((t) => (
          <View key={t.id} style={s.tr}>
            <Text style={{ width: 150, fontFamily: "Helvetica-Bold", color: C.ink }}>{t.name}</Text>
            <Text style={{ width: 45, textAlign: "right" }}>{t.criadas}</Text>
            <Text style={{ width: 55, textAlign: "right", color: C.done, fontFamily: "Helvetica-Bold" }}>{t.concluidas}</Text>
            <Text style={{ width: 75, textAlign: "right" }}>{t.tempoMedioMin != null ? fmtMin(t.tempoMedioMin) : "—"}</Text>
            <Text style={{ width: 75, textAlign: "right" }}>{t.estimadoMedioMin != null ? fmtMin(t.estimadoMedioMin) : "—"}</Text>
          </View>
        ))}

        {/* Por cliente */}
        {r.porCliente.length > 0 && (
          <>
            <Text style={s.h2}>Por cliente (top {r.porCliente.length})</Text>
            <View style={s.th}>
              <Text style={[s.thCell, { flex: 1 }]}>Cliente</Text>
              <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>Demandas</Text>
              <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>Concluídas</Text>
            </View>
            {r.porCliente.map((c) => (
              <View key={c.id} style={s.tr}>
                <Text style={{ flex: 1 }}>
                  {c.razao}
                  {c.ixcId ? `  (IXC ${c.ixcId})` : "  (manual)"}
                </Text>
                <Text style={{ width: 60, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{c.total}</Text>
                <Text style={{ width: 60, textAlign: "right", color: C.done }}>{c.concluidas}</Text>
              </View>
            ))}
          </>
        )}

        {/* Por projeto */}
        {r.porProjeto.length > 0 && (
          <>
            <Text style={s.h2}>Por projeto</Text>
            <View style={s.th}>
              <Text style={[s.thCell, { flex: 1 }]}>Projeto</Text>
              <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>Criadas</Text>
              <Text style={[s.thCell, { width: 60, textAlign: "right" }]}>Concluídas</Text>
            </View>
            {r.porProjeto.map((pj) => (
              <View key={pj.id} style={s.tr}>
                <Text style={{ flex: 1 }}>{pj.name}</Text>
                <Text style={{ width: 60, textAlign: "right" }}>{pj.criadas}</Text>
                <Text style={{ width: 60, textAlign: "right", color: C.done, fontFamily: "Helvetica-Bold" }}>{pj.concluidas}</Text>
              </View>
            ))}
          </>
        )}

        {/* Prolongadas */}
        {r.prolongadas.length > 0 && (
          <>
            <Text style={s.h2}>Atividades se prolongando (abertas há mais tempo)</Text>
            <View style={s.th}>
              <Text style={[s.thCell, { flex: 1 }]}>Atividade</Text>
              <Text style={[s.thCell, { width: 90 }]}>Responsável</Text>
              <Text style={[s.thCell, { width: 70 }]}>Etapa</Text>
              <Text style={[s.thCell, { width: 55, textAlign: "right" }]}>Aberta há</Text>
            </View>
            {r.prolongadas.map((t) => (
              <View key={t.id} style={s.tr}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink }}>{t.title}</Text>
                  <Text style={{ fontSize: 7, color: C.muted }}>{t.projectName ?? t.tipoName ?? "Avulsa"}</Text>
                </View>
                <Text style={{ width: 90 }}>{t.assigneeName ?? "—"}</Text>
                <Text style={{ width: 70 }}>{COL_LABEL[t.column] ?? t.column}</Text>
                <Text style={{ width: 55, textAlign: "right", fontFamily: "Helvetica-Bold", color: t.diasAberta > 14 ? C.risk : C.ink2 }}>
                  {t.diasAberta}d
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={s.foot} fixed>
          <Text>OpenBoard — relatório de produtividade</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Concluídas detalhadas com relato */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Concluídas no período — detalhe ({r.concluidas.length})</Text>
        {r.concluidas.length === 0 && <Text style={{ color: C.muted, marginTop: 4 }}>Nenhuma atividade concluída no período.</Text>}
        {r.concluidas.map((t) => (
          <View key={t.id} wrap={false} style={{ borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 9.5, flex: 1, paddingRight: 8 }}>{t.title}</Text>
              <Text style={[s.chip, { color: ORIGEM[t.origem].c }]}>{ORIGEM[t.origem].label}</Text>
            </View>
            <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 2 }}>
              {t.assigneeName ?? "Sem responsável"} · {t.tipoName ?? "sem tipo"}
              {t.clienteRazao ? ` · cliente: ${t.clienteRazao}` : ""}
              {t.projectName ? ` · projeto: ${t.projectName}` : ""}
              {" · concluída em "}{fmtDT(t.doneAt)}
              {t.realMinutes != null ? ` · tempo real ${fmtMin(t.realMinutes)}` : ""}
              {t.estimatedMinutes != null ? ` (est. ${fmtMin(t.estimatedMinutes)})` : ""}
              {t.updates > 0 ? ` · ${t.updates} atualização${t.updates === 1 ? "" : "s"}` : ""}
            </Text>
            {t.report && <Text style={s.relato}>{t.report}</Text>}
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>OpenBoard — relatório de produtividade</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderProdutividadePdf(r: ProdutividadeReport): Promise<Buffer> {
  return renderToBuffer(<ProdutividadePdf r={r} />);
}
