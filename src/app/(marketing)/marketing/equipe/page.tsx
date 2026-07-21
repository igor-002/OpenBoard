import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGlpiTeamStats, glpiConfigured } from "@/server/glpi/queries";
import { StatCard } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { BarsList } from "@/components/marketing/SocialCharts";
import { hourLabel } from "@/lib/format";

// Equipe = visão gerencial da produção do time de marketing, alimentada pelos
// chamados do GLPI (mesmo mirror da aba Demandas). Substitui o antigo painel
// manual (MarketingTask/Employee).
export default async function EquipePage() {
  await requireUser();
  const configured = glpiConfigured();
  const stats = configured ? await getGlpiTeamStats() : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-sub">Produção do time de marketing — chamados abertos no GLPI, por pessoa.</p>
        </div>
        <Link className="btn btn-ghost" href="/marketing/demandas">
          <Icon name="inbox" size={15} /> Ver demandas
        </Link>
      </div>

      {!configured ? (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--st-risk)" }}>
          <span style={{ color: "var(--st-risk)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>GLPI não configurado</div>
            <div className="muted">Defina as variáveis <code>GLPI_*</code>. Veja <code>glpi-api-v2-integracao.md</code>.</div>
          </div>
        </div>
      ) : !stats || stats.members.length === 0 ? (
        <div className="card card-pad muted">Nenhum chamado sincronizado ainda.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
            <StatCard icon="inbox" label="Total de demandas" value={stats.totals.total} foot="no espelho" />
            <StatCard icon="clock" label="Abertas" value={stats.totals.abertos} accent="var(--st-progress)" foot="em andamento" />
            <StatCard icon="alert" label="Paradas" value={stats.totals.paradas} accent="var(--st-risk)" foot="≥3 dias sem mov." />
            <StatCard icon="checkCircle" label="Solucionadas" value={stats.totals.solucionados} accent="var(--st-done)" foot="status Solucionado" />
            <StatCard
              icon="timeline"
              label="Tempo até solução"
              value={stats.totals.medianResolutionH ?? "—"}
              suffix={stats.totals.medianResolutionH ? "h" : undefined}
              accent="var(--c5)"
              foot="mediana (tempo corrido)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)", alignItems: "start" }}>
            <Card title="Solucionadas por pessoa" pad>
              <BarsList items={stats.members.map((m) => ({ label: m.name, value: m.solucionados }))} />
            </Card>
            <Card title="Abertas por pessoa" sub="carga atual" pad>
              <BarsList items={stats.members.map((m) => ({ label: m.name, value: m.abertos }))} />
            </Card>
          </div>

          <Card title="Por pessoa" sub="clique numa linha para ver as demandas da pessoa" pad={false}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Pessoa</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Abertas</th>
                    <th style={{ textAlign: "right" }}>Paradas</th>
                    <th style={{ textAlign: "right" }}>Pendentes</th>
                    <th style={{ textAlign: "right" }}>Solucionadas</th>
                    <th style={{ textAlign: "right" }}>Fechadas</th>
                    <th style={{ textAlign: "right" }}>Tempo (mediana)</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.members.map((m) => (
                    <tr key={m.requesterId}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ textAlign: "right" }}>{m.total}</td>
                      <td style={{ textAlign: "right" }}>{m.abertos}</td>
                      <td style={{ textAlign: "right", color: m.paradas ? "var(--st-risk)" : "inherit", fontWeight: m.paradas ? 700 : 400 }}>{m.paradas}</td>
                      <td style={{ textAlign: "right" }}>{m.pendentes}</td>
                      <td style={{ textAlign: "right" }}>{m.solucionados}</td>
                      <td style={{ textAlign: "right" }}>{m.fechados}</td>
                      <td style={{ textAlign: "right" }} className="muted">{m.medianResolutionH != null ? `${m.medianResolutionH}h` : "—"}</td>
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
          </Card>

          {stats.lastSync?.finishedAt && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Última sincronização: {hourLabel(new Date(stats.lastSync.finishedAt))} · {stats.lastSync.processed} chamados.
            </p>
          )}
        </>
      )}
    </div>
  );
}
