import Link from "next/link";
import { getComercialOverview, getDashboard, getDashboardFiltroOpcoes, getAlertasAA, getCarteiraResumo, getContratosDoPeriodo } from "@/server/comercial/queries";
import { StatCard } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DashboardFilterBar } from "@/components/comercial/DashboardFilterBar";
import { ContratosPeriodoCards } from "@/components/comercial/ContratosPeriodo";
import { AutoRefresh } from "@/components/common/AutoRefresh";
import { AbrirTvButton } from "@/components/tv/AbrirTvButton";
import { brl, fullLabel } from "@/lib/format";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default async function ComercialOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; vendedor?: string; filial?: string; ini?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const periodo = sp.periodo ? parseInt(sp.periodo, 10) : 0;
  const custom = !!(sp.ini && sp.fim);
  const extra = { vendedorIxcId: sp.vendedor, filial: sp.filial };

  const [o, d, opcoes, alertas, carteira, contratos] = await Promise.all([
    getComercialOverview(),
    getDashboard(periodo, extra, sp.ini, sp.fim),
    getDashboardFiltroOpcoes(),
    getAlertasAA(7, 8, extra),
    getCarteiraResumo(),
    getContratosDoPeriodo(periodo, extra, sp.ini, sp.fim),
  ]);

  const escopo = [
    sp.vendedor ? opcoes.vendedores.find((v) => v.ixcId === sp.vendedor)?.nome : null,
    sp.filial ? opcoes.filiais.find((f) => f.value === sp.filial)?.label : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <AutoRefresh seconds={60} />
      <div className="page-head">
        <div>
          <h1 className="page-title">Comercial</h1>
          <p className="page-sub">
            {custom ? d.label : `${MESES[d.mes - 1]} ${d.ano}`}{escopo ? ` · ${escopo}` : ""} — via IXC
          </p>
        </div>
        <div className="row gap12">
          <AbrirTvButton scope="comercial" label="TV" />
          <Link className="btn btn-primary" href="/comercial/sync">
            <Icon name="zap" size={15} /> Sincronização
          </Link>
        </div>
      </div>

      {!o.configured && (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--st-risk)" }}>
          <span style={{ color: "var(--st-risk)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>IXC não configurado</div>
            <div className="muted">Defina <code>IXC_TOKEN</code> / <code>IXC_PROXY_URL</code>. Veja <code>IXC_INTEGRATION_HANDOFF.md</code>.</div>
          </div>
        </div>
      )}

      <DashboardFilterBar vendedores={opcoes.vendedores} filiais={opcoes.filiais} />

      {/* KPIs escopados pelo período + filtros. Venda = data de cadastro (quando
          vendeu); Ativação = data de ativação (conta pra meta) — ativações de
          vendas antigas aparecem destacadas pra ninguém ler como venda nova. */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginTop: "var(--gap)" }}>
        <StatCard
          icon="briefcase"
          label="Vendas no período"
          value={d.vendas}
          foot={`${brl(contratos.mrrFechadosCents)} · por data de cadastro`}
          accent="var(--primary)"
        />
        <StatCard
          icon="checkCircle"
          label="Ativações no período"
          value={d.ativos}
          foot={`${brl(d.valorAtivosCents)} em MRR${d.ativacoesOutroPeriodo > 0 ? ` · ${d.ativacoesOutroPeriodo} de venda anterior` : ""}`}
          accent="var(--st-done)"
        />
        <StatCard
          icon="target"
          label="Aguardando assinatura"
          value={d.aguardando}
          foot={`${brl(d.valorAguardandoCents)}${d.parados30d ? ` · ${d.parados30d} parados +30d` : ""}`}
          accent="var(--st-progress)"
        />
        <StatCard
          icon="alert"
          label="Cancelados no período"
          value={d.cancelados}
          foot="contratos cancelados"
          accent="var(--st-risk)"
        />
        <StatCard
          icon="pause"
          label="Bloqueados no período"
          value={d.bloqueados}
          foot="bloqueados + financeiro em atraso"
          accent="var(--pr-med)"
        />
      </div>

      {alertas.length > 0 && (
        <div style={{ marginTop: "var(--gap)" }}>
          <Card
            title="Aguardando há mais de 7 dias"
            sub="Pendências de assinatura — cobrar fechamento"
            action={<Link className="btn btn-ghost" href="/comercial/contratos?status=AA">Ver todos <Icon name="chevRight" size={15} /></Link>}
            pad={false}
          >
            <div style={{ padding: "4px 0" }}>
              {alertas.map((a) => (
                <div key={a.ixcId} className="row gap12" style={{ justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.clienteNome}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{a.vendedorNome ?? "—"}</div>
                  </div>
                  <div className="row gap8" style={{ flexShrink: 0, alignItems: "center" }}>
                    <span className="muted" style={{ fontSize: 12 }}>{a.dias}d</span>
                    <span className="badge" style={a.dias > 15 ? { color: "var(--st-risk)", background: "var(--st-risk-bg)" } : { color: "var(--pr-med)", background: "var(--pr-med-bg)" }}>
                      {a.dias > 15 ? "Urgente" : "Atenção"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Carteira total (base inteira dos vendedores ativos — inclui base inativa D) */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Carteira (base total)" sub="Todos os contratos dos vendedores ativos no CRM — Desativados (D) ficam fora das métricas de venda" pad>
          <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: "var(--gap)" }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--st-done)" }}>{carteira.ativos}</div>
              <div className="muted" style={{ fontSize: 13 }}>Ativos</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--st-progress)" }}>{carteira.pipeline}</div>
              <div className="muted" style={{ fontSize: 13 }}>Pipeline (AA/P)</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--pr-med)" }}>{carteira.bloqueados}</div>
              <div className="muted" style={{ fontSize: 13 }}>Bloqueados</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--st-risk)" }}>{carteira.cancelados}</div>
              <div className="muted" style={{ fontSize: 13 }}>Cancelados</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--muted)" }}>{carteira.inativosD.toLocaleString("pt-BR")}</div>
              <div className="muted" style={{ fontSize: 13 }}>Inativos / Desativados (D)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Contratos/clientes do período — quem fechou e quem ativou (respeita o filtro) */}
      <ContratosPeriodoCards data={contratos} />

      <div className="grid" style={{ gridTemplateColumns: "1fr", marginTop: "var(--gap)" }}>
        <Card title="Última sincronização" sub="Espelho local dos dados do IXC" pad>
          {o.lastSync ? (
            <div className="row gap12" style={{ flexWrap: "wrap", alignItems: "baseline" }}>
              <span
                className="badge"
                style={
                  o.lastSync.fatalError
                    ? { color: "var(--st-risk)", background: "var(--st-risk-bg)" }
                    : !o.lastSync.finishedAt
                      ? { color: "var(--st-progress)", background: "var(--st-progress-bg)" }
                      : { color: "var(--st-done)", background: "var(--st-done-bg)" }
                }
              >
                {o.lastSync.fatalError ? "Interrompido" : !o.lastSync.finishedAt ? "Rodando…" : "OK"}
              </span>
              <span className="muted">{fullLabel(new Date(o.lastSync.startedAt))}</span>
              <span className="muted">· {o.lastSync.processed} registros</span>
              {o.lastSync.errors > 0 && <span className="muted">· {o.lastSync.errors} erros</span>}
              {o.lastSync.durationMs != null && <span className="muted">· {(o.lastSync.durationMs / 1000).toFixed(1)}s</span>}
            </div>
          ) : (
            <div className="muted">Nenhum sync ainda. Rode em <Link href="/comercial/sync">Sincronização</Link>.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
