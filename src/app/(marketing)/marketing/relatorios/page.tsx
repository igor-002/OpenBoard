import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { glpiConfigured } from "@/server/glpi/queries";
import { getGlpiActivityReport } from "@/server/glpi/report";
import { resolvePeriodo } from "@/server/relatorios";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { BarsList } from "@/components/marketing/SocialCharts";
import { AnimatedStat, DemandasDailyBars } from "@/components/marketing/GlpiReportCharts";
import { PeriodPicker } from "@/components/reports/PeriodPicker";
import { fullLabel, hourLabel } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

export const dynamic = "force-dynamic";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function MarketingRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { from, to, preset } = resolvePeriodo(sp);
  const configured = glpiConfigured();
  const r = configured ? await getGlpiActivityReport(from, to) : null;
  const pdfUrl = withBasePath(`/api/marketing/relatorios?from=${iso(from)}&to=${iso(to)}`);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatório de Demandas</h1>
          <p className="page-sub">
            Produção do time de marketing no GLPI · {fullLabel(from)} até {fullLabel(to)}
          </p>
        </div>
        <div className="row gap12">
          {configured && (
            <a className="btn btn-primary" href={pdfUrl} target="_blank" rel="noopener">
              <Icon name="download" size={16} /> Gerar relatório (PDF)
            </a>
          )}
          <Link className="btn btn-ghost" href="/marketing/equipe">
            <Icon name="users" size={15} /> Ver equipe
          </Link>
        </div>
      </div>

      {!configured ? (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--st-risk)" }}>
          <span style={{ color: "var(--st-risk)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>GLPI não configurado</div>
            <div className="muted">Defina as variáveis <code>GLPI_*</code>. Veja <code>glpi-api-v2-integracao.md</code>.</div>
          </div>
        </div>
      ) : !r ? null : (
        <>
          <PeriodPicker preset={preset} fromIso={iso(from)} toIso={iso(to)} />

          {/* KPIs do período (count-up na entrada) */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--gap)" }}>
            <AnimatedStat icon="inbox" label="Abertas no período" value={r.kpis.abertasNoPeriodo} foot="chamados criados" accent="var(--st-progress)" />
            <AnimatedStat
              icon="checkCircle"
              label="Solucionadas"
              value={r.kpis.solucionadasNoPeriodo}
              foot={r.kpis.taxaSolucaoPct != null ? `${r.kpis.taxaSolucaoPct}% das abertas` : "no período"}
              accent="var(--st-done)"
            />
            <AnimatedStat
              icon="timeline"
              label="Tempo até solução"
              value={r.kpis.tempoMedianoH}
              suffix="h"
              decimals={1}
              foot="mediana (tempo corrido)"
              accent="var(--c5)"
            />
            <AnimatedStat icon="clock" label="Abertas agora" value={r.kpis.abertasAgora} foot="snapshot atual" accent="var(--st-review)" />
            <AnimatedStat icon="alert" label="Paradas agora" value={r.kpis.paradasAgora} foot="≥3 dias sem mov." accent="var(--st-risk)" />
          </div>

          {/* Produção por dia + categoria */}
          <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)", alignItems: "start" }}>
            <Card title="Atividade no período" sub="Abertas vs. solucionadas" pad>
              <DemandasDailyBars data={r.porDia} />
            </Card>
            <Card title="Por categoria" sub="Chamados abertos no período" pad>
              {r.porCategoria.length === 0 ? (
                <div className="muted" style={{ padding: 8 }}>Nenhum chamado no período.</div>
              ) : (
                <BarsList items={r.porCategoria} />
              )}
            </Card>
          </div>

          {/* Por pessoa */}
          <Card title="Por pessoa" sub="Produção no período + carga atual" style={{ marginTop: "var(--gap)" }} pad={false}>
            {r.porPessoa.length === 0 ? (
              <div className="card-pad muted" style={{ fontSize: 13.5 }}>Sem atividade no período.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ width: "100%", marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Pessoa</th>
                      <th style={{ textAlign: "right" }}>Abertas</th>
                      <th style={{ textAlign: "right" }}>Solucionadas</th>
                      <th style={{ textAlign: "right" }}>Tempo (mediana)</th>
                      <th style={{ textAlign: "right" }}>Abertas agora</th>
                      <th style={{ textAlign: "right" }}>Paradas</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.porPessoa.map((m) => (
                      <tr key={m.requesterId}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td style={{ textAlign: "right" }}>{m.abertasNoPeriodo}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{m.solucionadasNoPeriodo}</td>
                        <td style={{ textAlign: "right" }} className="muted">{m.tempoMedianoH != null ? `${m.tempoMedianoH}h` : "—"}</td>
                        <td style={{ textAlign: "right" }}>{m.abertasAgora}</td>
                        <td style={{ textAlign: "right", color: m.paradasAgora ? "var(--st-risk)" : "inherit", fontWeight: m.paradasAgora ? 700 : 400 }}>{m.paradasAgora}</td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/marketing/demandas?user=${m.requesterId}`} className="btn btn-ghost" style={{ padding: "2px 8px" }} title="Ver demandas">
                            <Icon name="chevRight" size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Detalhe: solucionadas no período */}
          <Card title={`Solucionadas no período (${r.solucionadas.length})`} sub="Mais recentes primeiro" style={{ marginTop: "var(--gap)" }} pad={false}>
            {r.solucionadas.length === 0 ? (
              <div className="card-pad muted" style={{ fontSize: 13.5 }}>Nenhum chamado solucionado no período.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ width: "100%", marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Chamado</th>
                      <th style={{ textAlign: "left" }}>Pessoa</th>
                      <th style={{ textAlign: "left" }}>Categoria</th>
                      <th style={{ textAlign: "right" }}>Solucionado em</th>
                      <th style={{ textAlign: "right" }}>Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.solucionadas.map((t) => (
                      <tr key={t.glpiId}>
                        <td>
                          <div className="nm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
                            #{t.glpiId} · {t.name}
                          </div>
                        </td>
                        <td style={{ color: "var(--ink-2)" }}>{t.requesterName}</td>
                        <td className="muted">{t.categoryName ?? "—"}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--ink-2)" }}>{fullLabel(new Date(t.dateSolve))}</td>
                        <td style={{ textAlign: "right" }} className="muted">{t.resolutionH != null ? `${t.resolutionH}h` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {r.lastSync?.finishedAt && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Última sincronização: {hourLabel(new Date(r.lastSync.finishedAt))} · {r.lastSync.processed} chamados.
            </p>
          )}
        </>
      )}
    </div>
  );
}
