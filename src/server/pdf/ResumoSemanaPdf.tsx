// PDF "Resumo da semana" — versão SIMPLES, estilo texto/bullets do documento de
// referência (resumo-projetos-semana.pdf): projeto → pessoa → concluído /
// em andamento / fila. Sem gráficos.
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ResumoSemana, ResumoItem } from "@/server/relatorios";

const C = {
  ink: "#16181d",
  ink2: "#3f4450",
  muted: "#6b7280",
  line: "#e5e7eb",
  done: "#16a34a",
  primary: "#f2691f",
};

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: "Helvetica", color: C.ink2, lineHeight: 1.45 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 2 },
  meta: { fontSize: 9, color: C.muted, marginBottom: 14 },
  projeto: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 14, marginBottom: 4 },
  pessoa: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 10, marginBottom: 2 },
  bucket: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.muted, marginTop: 6, marginBottom: 2 },
  li: { flexDirection: "row", marginBottom: 1.5 },
  liSub: { flexDirection: "row", marginLeft: 14, marginBottom: 1 },
  bullet: { width: 12 },
  liText: { flex: 1 },
  sub: { fontSize: 9, color: C.muted },
  divider: { borderBottomWidth: 0.5, borderBottomColor: C.line, marginTop: 10 },
  foot: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
});

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtMin = (min: number) => {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

function metaLinha(t: ResumoItem): string {
  const parts: string[] = [];
  if (t.tipoName) parts.push(t.tipoName);
  if (t.clienteRazao) parts.push(`cliente: ${t.clienteRazao}`);
  if (t.doneAt) parts.push(`concluída em ${fmtDate(t.doneAt)}`);
  if (t.realMinutes != null) parts.push(`tempo: ${fmtMin(t.realMinutes)}${t.estimatedMinutes != null ? ` (est. ${fmtMin(t.estimatedMinutes)})` : ""}`);
  else if (t.dueDate) parts.push(`prazo: ${fmtDate(t.dueDate)}`);
  return parts.join(" · ");
}

function Item({ t, showRelato }: { t: ResumoItem; showRelato: boolean }) {
  const meta = metaLinha(t);
  return (
    <View wrap={false}>
      <View style={s.li}>
        <Text style={s.bullet}>•</Text>
        <Text style={s.liText}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{t.title}</Text>
          {meta ? <Text style={s.sub}>  —  {meta}</Text> : null}
        </Text>
      </View>
      {showRelato && t.report && (
        <View style={s.liSub}>
          <Text style={s.bullet}>–</Text>
          <Text style={[s.liText, { fontSize: 9, color: C.ink2 }]}>{t.report}</Text>
        </View>
      )}
      {!t.report && showRelato && t.ultimaAtualizacao && (
        <View style={s.liSub}>
          <Text style={s.bullet}>–</Text>
          <Text style={[s.liText, { fontSize: 9, color: C.muted }]}>Última atualização: {t.ultimaAtualizacao}</Text>
        </View>
      )}
      {!showRelato && t.ultimaAtualizacao && (
        <View style={s.liSub}>
          <Text style={s.bullet}>–</Text>
          <Text style={[s.liText, { fontSize: 9, color: C.muted }]}>{t.ultimaAtualizacao}</Text>
        </View>
      )}
    </View>
  );
}

export function ResumoSemanaPdf({ r }: { r: ResumoSemana }) {
  return (
    <Document title={`Resumo da semana — ${fmtDate(r.from)} a ${fmtDate(r.to)}`} author="OpenBoard">
      {/* Página 1 — pontos importantes por projeto */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Resumo do período — pontos importantes</Text>
        <Text style={s.meta}>
          {r.workspaceName} · {fmtDate(r.from)} a {fmtDate(r.to)} · gerado em {fmtDate(r.geradoEm)}
        </Text>

        {r.destaques.length === 0 && <Text style={{ color: C.muted }}>Nenhuma entrega concluída no período.</Text>}
        {r.destaques.map((d) => (
          <View key={d.projeto} wrap={false}>
            <Text style={s.projeto}>{d.projeto} — principais entregas</Text>
            {d.itens.map((titulo, i) => (
              <View key={i} style={s.li}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.liText}>{titulo}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>OpenBoard — resumo do período</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Detalhe: projeto → pessoa → status */}
      <Page size="A4" style={s.page}>
        {r.projetos.map((proj) => (
          <View key={proj.name}>
            <Text style={s.projeto}>Projeto: {proj.name}</Text>
            {proj.pessoas.map((pe) => (
              <View key={pe.name}>
                <Text style={s.pessoa}>{pe.name}</Text>

                {pe.concluidas.length > 0 && (
                  <>
                    <Text style={[s.bucket, { color: C.done }]}>Concluído</Text>
                    {pe.concluidas.map((t, i) => (
                      <Item key={i} t={t} showRelato />
                    ))}
                  </>
                )}

                {pe.andamento.length > 0 && (
                  <>
                    <Text style={[s.bucket, { color: C.primary }]}>Em andamento</Text>
                    {pe.andamento.map((t, i) => (
                      <Item key={i} t={t} showRelato={false} />
                    ))}
                  </>
                )}

                {pe.fila.length > 0 && (
                  <>
                    <Text style={s.bucket}>Fila</Text>
                    {pe.fila.map((t, i) => (
                      <Item key={i} t={t} showRelato={false} />
                    ))}
                  </>
                )}
              </View>
            ))}
            <View style={s.divider} />
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>OpenBoard — resumo do período</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderResumoSemanaPdf(r: ResumoSemana): Promise<Buffer> {
  return renderToBuffer(<ResumoSemanaPdf r={r} />);
}
