import { getDashboard, getDashboardFiltroOpcoes, getRelatorioRanking, getEvolucao, getDistribuicaoPfPj, getMetaTime, getMetasVendedorMap, getTempoAtivacao, getContratosDoPeriodo, diasUteis, periodoMesAno, getDiarioDia, getVendedoresCRM, getRelatorioEquipe } from "@/server/comercial/queries";
import { RelatoriosNav } from "@/components/comercial/RelatoriosNav";
import { FunilVendas, EvolucaoBars, DonutCard } from "@/components/comercial/RelatorioCharts";
import { ContratosPeriodoCards } from "@/components/comercial/ContratosPeriodo";
import { DiarioManager } from "@/components/comercial/DiarioManager";
import { EquipeFilter } from "@/components/comercial/EquipeFilter";
import { EquipePdf } from "@/components/comercial/EquipePdf";
import { StatCard } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { brl } from "@/lib/format";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; sub?: string; periodo?: string; vendedor?: string; filial?: string; data?: string; ini?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const aba = sp.aba ?? "gerencial";
  const sub = sp.sub ?? "geral";
  const periodo = sp.periodo ? parseInt(sp.periodo, 10) : 0;
  const opcoes = await getDashboardFiltroOpcoes();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-sub">Gerenciais (IXC) · Diário e Equipe (manual) — tudo num lugar.</p>
        </div>
      </div>

      <RelatoriosNav vendedores={opcoes.vendedores} filiais={opcoes.filiais} />

      {aba === "diario" && <Diario dataISO={sp.data ?? new Date().toISOString().slice(0, 10)} />}
      {aba === "equipe" && <Equipe ini={sp.ini ?? mesInicioISO()} fim={sp.fim ?? new Date().toISOString().slice(0, 10)} />}

      {aba === "gerencial" && (
        <div style={{ marginTop: "var(--gap)" }}>
          {sub === "geral" && <VisaoGeral periodo={periodo} vendedor={sp.vendedor} filial={sp.filial} />}
          {sub === "ranking" && <Ranking periodo={periodo} filial={sp.filial} />}
          {sub === "vendedor" && <PorVendedor periodo={periodo} vendedor={sp.vendedor} filial={sp.filial} vendedores={opcoes.vendedores} />}
        </div>
      )}
    </div>
  );
}

function mesInicioISO(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ── Relatório de Equipe (agrega o diário) ─────────────────────────────────────
async function Equipe({ ini, fim }: { ini: string; fim: string }) {
  const { totais, porVendedor, porDia, produtos } = await getRelatorioEquipe(ini, fim);
  const maxValor = Math.max(...porDia.map((d) => d.valorCents), 1);
  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}><EquipeFilter ini={ini} fim={fim} /></div>
        <EquipePdf ini={ini} fim={fim} totais={totais} porVendedor={porVendedor} porDia={porDia} produtos={produtos} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <StatCard icon="briefcase" label="Vendas fechadas" value={totais.vendas} foot={`${brl(totais.valorCents)} · ${totais.dias} dias com registro`} accent="var(--st-done)" />
        <StatCard icon="users" label="Contatos" value={totais.contatos} foot={`${totais.leads} leads`} accent="var(--st-progress)" />
        <StatCard icon="msg" label="Calls / Reuniões" value={totais.callsReunioes} foot="no período" accent="var(--st-review)" />
        <StatCard icon="trendUp" label="Taxa de conversão" value={`${totais.conversao}%`} foot={`ticket ${brl(totais.ticketCents)}`} accent="var(--primary)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Ranking por vendedor" sub="Esforço no período" pad={false}>
          {porVendedor.length === 0 ? (
            <div className="card-pad muted">Nenhum apontamento no período. Preencha no Relatório Diário.</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Vendedor</th>
                  <th style={{ textAlign: "right" }}>Leads</th>
                  <th style={{ textAlign: "right" }}>Contatos</th>
                  <th style={{ textAlign: "right" }}>Vendas</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th style={{ textAlign: "right" }}>Dias</th>
                </tr>
              </thead>
              <tbody>
                {porVendedor.map((v) => (
                  <tr key={v.vendedorIxcId}>
                    <td style={{ fontWeight: 700 }}>{v.nome}</td>
                    <td style={{ textAlign: "right" }} className="muted">{v.leads}</td>
                    <td style={{ textAlign: "right" }} className="muted">{v.contatos}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{v.vendas}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(v.valorCents)}</td>
                    <td style={{ textAlign: "right" }} className="muted">{v.dias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Evolução por dia" sub="Valor apontado" pad>
          {porDia.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200, padding: "8px 4px 0" }}>
              {porDia.map((d) => (
                <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", maxWidth: 32, display: "flex", alignItems: "flex-end" }}>
                    <div title={brl(d.valorCents)} style={{ width: "100%", height: `${(d.valorCents / maxValor) * 100}%`, background: "var(--primary)", borderRadius: "5px 5px 0 0", minHeight: d.valorCents ? 4 : 0 }} />
                  </div>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.dia.slice(8)}/{d.dia.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Produtos vendidos no período" sub="Consolidado dos produtos apontados no Diário" pad={false}>
          {produtos.length === 0 ? (
            <div className="card-pad muted">Nenhum produto apontado no período.</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Produto</th>
                  <th style={{ textAlign: "right" }}>Qtd.</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.nome}>
                    <td style={{ fontWeight: 700 }}>{p.nome}</td>
                    <td style={{ textAlign: "right" }} className="muted">{p.qtd}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(p.valorCents)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid var(--line-2)", fontWeight: 800 }}>
                  <td>Total</td>
                  <td style={{ textAlign: "right" }}>{produtos.reduce((a, p) => a + p.qtd, 0)}</td>
                  <td style={{ textAlign: "right" }}>{brl(produtos.reduce((a, p) => a + p.valorCents, 0))}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

// ── Relatório Diário (manual) ─────────────────────────────────────────────────
async function Diario({ dataISO }: { dataISO: string }) {
  const [vendedores, diaMap] = await Promise.all([getVendedoresCRM(), getDiarioDia(dataISO)]);
  const linhas = vendedores
    .filter((v) => v.ativo)
    .map((v) => {
      const r = diaMap.get(v.ixcId);
      return {
        ixcId: v.ixcId,
        nome: v.nome,
        leads: r ? String(r.leads) : "",
        contatos: r ? String(r.contatos) : "",
        callsReunioes: r ? String(r.callsReunioes) : "",
        vendas: r ? String(r.vendas) : "",
        valor: r && r.valorCents ? String(r.valorCents / 100) : "",
        observacoes: r?.observacoes ?? "",
        produtos: (r?.produtos ?? []).map((p) => ({ nome: p.nome, valor: String(p.valorCents / 100) })),
        preenchido: !!r,
      };
    });
  return <DiarioManager dataISO={dataISO} vendedores={linhas} />;
}

// ── Visão Geral ───────────────────────────────────────────────────────────────
async function VisaoGeral({ periodo, vendedor, filial }: { periodo: number; vendedor?: string; filial?: string }) {
  const extra = { vendedorIxcId: vendedor, filial };
  const { mes, ano } = periodoMesAno(periodo);
  const [d, ranking, evolucao, pfpj, metaTime, tempoAtiv, contratos] = await Promise.all([
    getDashboard(periodo, extra),
    getRelatorioRanking(periodo, filial),
    getEvolucao(extra, 6),
    getDistribuicaoPfPj(extra),
    getMetaTime(mes, ano),
    getTempoAtivacao(periodo, extra),
    getContratosDoPeriodo(periodo, extra),
  ]);

  const cadastrados = d.ativos + d.aguardando + d.cancelados + d.bloqueados;
  const totalPipeline = d.ativos + d.aguardando;
  const ticket = d.ativos > 0 ? Math.round(d.valorAtivosCents / d.ativos) : 0;
  const conversao = totalPipeline > 0 ? Math.round((d.ativos / totalPipeline) * 100) : 0;

  // Forecast (SalesTracker): MRR projetado fim do mês por dias úteis. Só no mês atual.
  const du = diasUteis(mes, ano);
  const forecastCents = periodo === 0 && du.passados > 0 ? Math.round((d.valorAtivosCents / du.passados) * du.total) : null;
  const metaContratos = metaTime?.metaContratos ?? 0;
  const atingMeta = metaContratos > 0 ? Math.round((d.ativos / metaContratos) * 100) : null;

  const topAtivos = ranking.slice(0, 6).map((r) => ({ label: r.nome, value: r.ativos }));
  const topMrr = ranking.slice(0, 6).map((r) => ({ label: r.nome, value: r.mrrCents, money: true }));

  return (
    <>
      <p className="page-sub" style={{ marginBottom: 12 }}>{MESES[d.mes - 1]} {d.ano} · resultado real do IXC</p>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: "var(--gap)" }}>
        <StatCard icon="briefcase" label="Total de vendas" value={d.ativos + d.aguardando} foot={`${brl(d.valorAtivosCents + d.valorAguardandoCents)}/mês em MRR · fechados + pipeline`} accent="var(--primary)" />
        <StatCard icon="checkCircle" label="Ativados no período" value={d.ativos} foot={`${brl(d.valorAtivosCents)} MRR`} accent="var(--st-done)" />
        <StatCard icon="target" label="Aguardando" value={d.aguardando} foot={`${brl(d.valorAguardandoCents)}`} accent="var(--st-progress)" />
        <StatCard icon="wallet" label="Ticket médio (ativos)" value={brl(ticket)} foot="MRR por contrato ativo" accent="var(--st-review)" />
        <StatCard icon="trendUp" label="Taxa de conversão" value={`${conversao}%`} foot="ativos / (ativos + aguardando)" accent="var(--primary)" />
      </div>

      {/* Meta do time + Forecast */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Meta do time" sub={metaContratos ? `${d.ativos} de ${metaContratos} contratos ativos` : "Sem meta — cadastre em MRR & Metas"} pad>
          {metaContratos > 0 ? (
            <div style={{ marginTop: 4 }}>
              <div className="row gap12" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: (atingMeta ?? 0) >= 100 ? "var(--st-done)" : "var(--ink)" }}>{atingMeta}%</span>
                <span className="muted" style={{ alignSelf: "flex-end" }}>{d.ativos}/{metaContratos}</span>
              </div>
              <div style={{ height: 10, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, atingMeta ?? 0)}%`, height: "100%", background: (atingMeta ?? 0) >= 100 ? "var(--st-done)" : (atingMeta ?? 0) >= 50 ? "var(--pr-med)" : "var(--st-progress)" }} />
              </div>
            </div>
          ) : (
            <div className="muted" style={{ padding: "12px 0" }}>Defina a meta em <strong>MRR &amp; Metas</strong> pra acompanhar o atingimento aqui.</div>
          )}
        </Card>
        <Card title="Forecast de MRR" sub={forecastCents != null ? `Projeção fim do mês · ${du.passados}/${du.total} dias úteis` : "Disponível só no mês atual"} pad>
          {forecastCents != null ? (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{brl(forecastCents)}</span>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Hoje: {brl(d.valorAtivosCents)} ativados · ritmo projeta {brl(forecastCents)}</div>
            </div>
          ) : (
            <div className="muted" style={{ padding: "12px 0" }}>Selecione &quot;Mês atual&quot; pra ver a projeção por dias úteis.</div>
          )}
        </Card>
      </div>

      {/* Tempo médio de ativação */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Tempo de ativação" sub={tempoAtiv ? `Do cadastro à ativação · ${tempoAtiv.n} contratos ativados no período` : "Do cadastro à ativação"} pad>
          {tempoAtiv ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "var(--gap)" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{tempoAtiv.mediaDias}<small style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)" }}> dias</small></div>
                <div className="muted" style={{ fontSize: 13 }}>Média</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--st-done)" }}>{tempoAtiv.melhorDias}<small style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)" }}> dias</small></div>
                <div className="muted" style={{ fontSize: 13 }}>Mais rápido</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--st-risk)" }}>{tempoAtiv.piorDias}<small style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)" }}> dias</small></div>
                <div className="muted" style={{ fontSize: 13 }}>Mais lento</div>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ padding: "12px 0" }}>Nenhum contrato ativado no período (ou sem data de cadastro/ativação no espelho).</div>
          )}
        </Card>
      </div>

      {/* Funil + Evolução */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Funil de Vendas" sub="Do cadastro à ativação" pad>
          <FunilVendas cadastrados={cadastrados} ativos={d.ativos} aguardando={d.aguardando} cancelados={d.cancelados} />
        </Card>
        <Card title="Evolução" sub="Ativados × Aguardando — últimos 6 meses" pad>
          <EvolucaoBars data={evolucao} />
        </Card>
      </div>

      {/* Donuts de distribuição */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <DonutCard title="Contratos ativos por vendedor" items={topAtivos} />
        <DonutCard title="MRR por vendedor" items={topMrr} />
        <DonutCard
          title="Pessoa Física × Jurídica"
          sub="Carteira ativa"
          items={[{ label: "Pessoa Física", value: pfpj.pf }, { label: "Pessoa Jurídica", value: pfpj.pj }]}
        />
      </div>

      {/* Contratos/clientes do período — quem fechou e quem ativou */}
      <ContratosPeriodoCards data={contratos} />
    </>
  );
}

// ── Ranking / Performance por Vendedor ────────────────────────────────────────
async function Ranking({ periodo, filial }: { periodo: number; filial?: string }) {
  const { mes, ano } = periodoMesAno(periodo);
  const [rows, metasVend] = await Promise.all([getRelatorioRanking(periodo, filial), getMetasVendedorMap(mes, ano)]);
  const tot = rows.reduce(
    (a, r) => ({ cadastrados: a.cadastrados + r.cadastrados, ativos: a.ativos + r.ativos, aguardando: a.aguardando + r.aguardando, cancelados: a.cancelados + r.cancelados, mrrCents: a.mrrCents + r.mrrCents }),
    { cadastrados: 0, ativos: 0, aguardando: 0, cancelados: 0, mrrCents: 0 },
  );
  const ticketTime = tot.ativos > 0 ? Math.round(tot.mrrCents / tot.ativos) : 0;
  const convTime = tot.ativos + tot.aguardando > 0 ? Math.round((tot.ativos / (tot.ativos + tot.aguardando)) * 100) : 0;
  const donutMrr = rows.slice(0, 6).map((r) => ({ label: r.nome, value: r.mrrCents, money: true }));

  return (
    <>
      <Card title="Performance por Vendedor" sub="Resultado real do IXC no período" pad={false}>
        {rows.length === 0 ? (
          <div className="card-pad muted">Sem contratos no período.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>#</th>
                <th style={{ textAlign: "left" }}>Vendedor</th>
                <th style={{ textAlign: "right" }}>Cadastr.</th>
                <th style={{ textAlign: "right" }}>Ativos</th>
                <th style={{ textAlign: "right" }}>Aguard.</th>
                <th style={{ textAlign: "right" }}>Cancel.</th>
                <th style={{ textAlign: "right" }}>MRR</th>
                <th style={{ textAlign: "right" }}>Ticket</th>
                <th style={{ textAlign: "right" }}>Conv.</th>
                <th style={{ textAlign: "right" }}>Meta</th>
                <th style={{ textAlign: "right" }}>Ating.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const meta = metasVend.get(r.vendedorIxcId) ?? 0;
                const ating = meta > 0 ? Math.round((r.ativos / meta) * 100) : null;
                return (
                <tr key={r.vendedorIxcId}>
                  <td className="muted" style={{ fontWeight: 700 }}>{i + 1}º</td>
                  <td style={{ fontWeight: 700 }}>{r.nome}</td>
                  <td style={{ textAlign: "right" }} className="muted">{r.cadastrados}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--st-done)" }}>{r.ativos}</td>
                  <td style={{ textAlign: "right", color: "var(--st-progress)" }}>{r.aguardando}</td>
                  <td style={{ textAlign: "right", color: r.cancelados ? "var(--st-risk)" : "var(--muted)" }}>{r.cancelados}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(r.mrrCents)}</td>
                  <td style={{ textAlign: "right" }} className="muted">{brl(r.ticketCents)}</td>
                  <td style={{ textAlign: "right" }}>{r.conversao}%</td>
                  <td style={{ textAlign: "right" }} className="muted">{meta || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: ating == null ? "var(--muted)" : ating >= 100 ? "var(--st-done)" : ating >= 50 ? "var(--pr-med)" : "var(--st-risk)" }}>{ating == null ? "—" : `${ating}%`}</td>
                </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--line-2)", fontWeight: 800 }}>
                <td />
                <td>Total do Time</td>
                <td style={{ textAlign: "right" }}>{tot.cadastrados}</td>
                <td style={{ textAlign: "right", color: "var(--st-done)" }}>{tot.ativos}</td>
                <td style={{ textAlign: "right", color: "var(--st-progress)" }}>{tot.aguardando}</td>
                <td style={{ textAlign: "right", color: tot.cancelados ? "var(--st-risk)" : "var(--muted)" }}>{tot.cancelados}</td>
                <td style={{ textAlign: "right" }}>{brl(tot.mrrCents)}</td>
                <td style={{ textAlign: "right" }}>{brl(ticketTime)}</td>
                <td style={{ textAlign: "right" }}>{convTime}%</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <DonutCard title="MRR por vendedor" sub="Participação no MRR ativado" items={donutMrr} />
        <DonutCard title="Contratos ativos por vendedor" items={rows.slice(0, 6).map((r) => ({ label: r.nome, value: r.ativos }))} />
      </div>
    </>
  );
}

// ── Por Vendedor ──────────────────────────────────────────────────────────────
async function PorVendedor({ periodo, vendedor, filial, vendedores }: { periodo: number; vendedor?: string; filial?: string; vendedores: { ixcId: string; nome: string }[] }) {
  if (!vendedor) {
    return <div className="card card-pad muted" style={{ marginTop: 4 }}>Selecione um vendedor no filtro acima.</div>;
  }
  const extra = { vendedorIxcId: vendedor, filial };
  const [d, evolucao] = await Promise.all([getDashboard(periodo, extra), getEvolucao(extra, 6)]);
  const nome = vendedores.find((v) => v.ixcId === vendedor)?.nome ?? `#${vendedor}`;
  const totalPipeline = d.ativos + d.aguardando;
  const ticket = d.ativos > 0 ? Math.round(d.valorAtivosCents / d.ativos) : 0;
  const conversao = totalPipeline > 0 ? Math.round((d.ativos / totalPipeline) * 100) : 0;
  const cadastrados = d.ativos + d.aguardando + d.cancelados + d.bloqueados;

  return (
    <>
      <p className="page-sub" style={{ marginBottom: 12 }}>{nome} · {MESES[d.mes - 1]} {d.ano}</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)" }}>
        <StatCard icon="checkCircle" label="Ativados" value={d.ativos} foot={`${brl(d.valorAtivosCents)} MRR`} accent="var(--st-done)" />
        <StatCard icon="target" label="Aguardando" value={d.aguardando} foot={brl(d.valorAguardandoCents)} accent="var(--st-progress)" />
        <StatCard icon="wallet" label="Ticket médio" value={brl(ticket)} foot="MRR por ativo" accent="var(--st-review)" />
        <StatCard icon="trendUp" label="Conversão" value={`${conversao}%`} foot="ativos / pipeline" accent="var(--primary)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <Card title="Funil do vendedor" sub="No período" pad>
          <FunilVendas cadastrados={cadastrados} ativos={d.ativos} aguardando={d.aguardando} cancelados={d.cancelados} />
        </Card>
        <Card title="Evolução do vendedor" sub="Ativados × Aguardando — últimos 6 meses" pad>
          <EvolucaoBars data={evolucao} />
        </Card>
      </div>
    </>
  );
}
