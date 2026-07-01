"use client";

// PDF do relatório Gerencial (Visão Geral IXC): KPIs, meta/forecast, tempo de
// ativação, funil, evolução (barras) e listas de ativados/fechados no período.
// Reusa o mecanismo de impressão do Diário (body.printing + bloco .diario-print).
import { Icon } from "@/components/ui/Icon";
import { brl, dayLabel } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ixc";
import type { EvolucaoMes, ContratosPeriodo, TempoAtivacao } from "@/server/comercial/queries";

function imprimir() {
  document.body.classList.add("printing");
  const limpar = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", limpar);
  };
  window.addEventListener("afterprint", limpar);
  window.print();
}

export type GerencialKpis = {
  totalVendas: number;
  mrrTotalCents: number;
  ativos: number;
  mrrAtivosCents: number;
  aguardando: number;
  mrrAguardCents: number;
  cancelados: number;
  cadastrados: number;
  ticketCents: number;
  conversao: number;
};

export function GerencialPdf({
  periodoLabel,
  escopo,
  kpis,
  metaContratos,
  atingMeta,
  forecastCents,
  tempoAtiv,
  evolucao,
  contratos,
}: {
  periodoLabel: string;
  escopo: string;
  kpis: GerencialKpis;
  metaContratos: number;
  atingMeta: number | null;
  forecastCents: number | null;
  tempoAtiv: TempoAtivacao;
  evolucao: EvolucaoMes[];
  contratos: ContratosPeriodo;
}) {
  const maxMrr = Math.max(...evolucao.map((e) => e.mrrCents), 1);

  const kpi = (label: string, value: string, sub: string, bg: string) => (
    <div style={{ flex: 1, minWidth: 110, background: bg, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 19, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#555" }}>{sub}</div>
    </div>
  );

  return (
    <>
      <button className="btn btn-ghost" onClick={imprimir} title="Gerar PDF gerencial (imprimir → salvar como PDF)">
        <Icon name="download" size={15} /> Gerar PDF gerencial
      </button>

      <div className="diario-print">
        <h2 style={{ margin: "0 0 2px", fontSize: 18 }}>Relatório Gerencial — {periodoLabel}</h2>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>
          Resultado real do IXC{escopo ? ` · ${escopo}` : ""} · gerado em {new Date().toLocaleString("pt-BR")}
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {kpi("Total de vendas", String(kpis.totalVendas), `${brl(kpis.mrrTotalCents)}/mês MRR`, "#fdece0")}
          {kpi("Ativados", String(kpis.ativos), `${brl(kpis.mrrAtivosCents)} MRR`, "#e7f6ec")}
          {kpi("Aguardando", String(kpis.aguardando), brl(kpis.mrrAguardCents), "#eaf1fe")}
          {kpi("Ticket médio", brl(kpis.ticketCents), "MRR por ativo", "#f0ecfc")}
          {kpi("Conversão", `${kpis.conversao}%`, "ativos / pipeline", "#fdf2de")}
        </div>

        {/* Meta / Forecast / Tempo de ativação */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {metaContratos > 0 && kpi("Meta do time", `${atingMeta ?? 0}%`, `${kpis.ativos}/${metaContratos} contratos`, "#f2f2f2")}
          {forecastCents != null && kpi("Forecast MRR", brl(forecastCents), "projeção fim do mês", "#f2f2f2")}
          {tempoAtiv && kpi("Tempo de ativação", `${tempoAtiv.mediaDias}d`, `média · ${tempoAtiv.melhorDias}–${tempoAtiv.piorDias}d · n=${tempoAtiv.n}`, "#f2f2f2")}
        </div>

        {/* Funil */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Funil de vendas</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Cadastrados", v: kpis.cadastrados, c: "#6b7280" },
            { l: "Aguardando", v: kpis.aguardando, c: "#2d6ff2" },
            { l: "Ativados", v: kpis.ativos, c: "#16a34a" },
            { l: "Cancelados", v: kpis.cancelados, c: "#e5484d" },
          ].map((f) => (
            <div key={f.l} style={{ flex: 1, textAlign: "center", border: "1px solid #ddd", borderRadius: 8, padding: "8px 4px" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: f.c }}>{f.v}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{f.l}</div>
            </div>
          ))}
        </div>

        {/* Evolução MRR (barras) */}
        {evolucao.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Evolução do MRR ativado (últimos meses)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, borderBottom: "1px solid #ccc", paddingBottom: 2 }}>
              {evolucao.map((e) => (
                <div key={e.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <span style={{ fontSize: 8, color: "#555" }}>{brl(e.mrrCents)}</span>
                  <div style={{ width: "60%", maxWidth: 30, height: `${(e.mrrCents / maxMrr) * 100}%`, background: "#f2691f", borderRadius: "3px 3px 0 0", minHeight: e.mrrCents ? 3 : 0 }} />
                  <span style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ativados no período */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Clientes ativados no período ({contratos.ativados.length} · {brl(contratos.mrrAtivadosCents)} MRR)
        </div>
        {contratos.ativados.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>Nenhum contrato ativado no período.</div>
        ) : (
          <table className="diario-print-tbl" style={{ marginBottom: 16 }}>
            <thead><tr><th>Cliente</th><th>Vendedor</th><th>Cadastro</th><th>Ativação</th><th>Dias</th><th>MRR</th></tr></thead>
            <tbody>
              {contratos.ativados.map((l) => (
                <tr key={l.ixcId}>
                  <td style={{ textAlign: "left" }}>{l.clienteNome}</td>
                  <td style={{ textAlign: "left" }}>{l.vendedorNome ?? "—"}</td>
                  <td>{l.dataCadastro ? dayLabel(new Date(l.dataCadastro)) : "—"}</td>
                  <td>{l.dataAtivacao ? dayLabel(new Date(l.dataAtivacao)) : "—"}</td>
                  <td>{l.diasAtivacao != null ? `${l.diasAtivacao}d` : "—"}</td>
                  <td>{l.mrrCents ? brl(l.mrrCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Fechados no período */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Fechados no período ({contratos.fechados.length} · {brl(contratos.mrrFechadosCents)})
        </div>
        {contratos.fechados.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>Nenhum contrato cadastrado no período.</div>
        ) : (
          <table className="diario-print-tbl">
            <thead><tr><th>Cliente</th><th>Vendedor</th><th>Cadastro</th><th>Status</th><th>MRR</th></tr></thead>
            <tbody>
              {contratos.fechados.map((l) => (
                <tr key={l.ixcId}>
                  <td style={{ textAlign: "left" }}>{l.clienteNome}</td>
                  <td style={{ textAlign: "left" }}>{l.vendedorNome ?? "—"}</td>
                  <td>{l.dataCadastro ? dayLabel(new Date(l.dataCadastro)) : "—"}</td>
                  <td>{STATUS_LABEL[l.status] ?? l.status}</td>
                  <td>{l.mrrCents ? brl(l.mrrCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
