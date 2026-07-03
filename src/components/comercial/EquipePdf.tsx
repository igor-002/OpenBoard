"use client";

// PDF do Relatório de Equipe (período) — "relatório dos relatórios diários".
// Reusa o mecanismo de impressão do Diário (body.printing + bloco .diario-print).
// Bloco só visível em @media print → dashboards (KPIs, barras) + tabelas.
import { Icon } from "@/components/ui/Icon";
import { brl } from "@/lib/format";
import type { EquipeTotais, EquipeVendedor, EquipeDia, EquipeProduto } from "@/server/comercial/queries";

function imprimir() {
  document.body.classList.add("printing");
  const limpar = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", limpar);
  };
  window.addEventListener("afterprint", limpar);
  window.print();
}

function fmtDia(iso: string) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`;
}

export function EquipePdf({
  ini,
  fim,
  totais,
  porVendedor,
  porDia,
  produtos,
}: {
  ini: string;
  fim: string;
  totais: EquipeTotais;
  porVendedor: EquipeVendedor[];
  porDia: EquipeDia[];
  produtos: EquipeProduto[];
}) {
  const maxDia = Math.max(...porDia.map((d) => d.valorCents), 1);
  const maxVend = Math.max(...porVendedor.map((v) => v.valorCents), 1);
  const totalProdQtd = produtos.reduce((a, p) => a + p.qtd, 0);
  const totalProdValor = produtos.reduce((a, p) => a + p.valorCents, 0);

  const kpi = (label: string, value: string, sub: string, bg: string) => (
    <div style={{ flex: 1, minWidth: 120, background: bg, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#555" }}>{sub}</div>
    </div>
  );

  return (
    <>
      <button className="btn btn-ghost" onClick={imprimir} title="Gerar PDF do período (imprimir → salvar como PDF)">
        <Icon name="download" size={15} /> Gerar PDF do período
      </button>

      {/* Bloco de impressão — só visível em @media print */}
      <div className="diario-print">
        <h2 style={{ margin: "0 0 2px", fontSize: 18 }}>Relatório de Equipe — {fmtDia(ini)} a {fmtDia(fim)}</h2>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>
          {/* suppressHydrationWarning: timestamp muda entre server e client (bloco só de impressão) */}
          Consolidado dos apontamentos diários · gerado em <span suppressHydrationWarning>{new Date().toLocaleString("pt-BR")}</span>
        </div>

        {/* KPIs (dashboard) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {kpi("Vendas fechadas", String(totais.vendas), brl(totais.valorCents), "#e7f6ec")}
          {kpi("Contatos", String(totais.contatos), `${totais.leads} leads`, "#eaf1fe")}
          {kpi("Calls / Reuniões", String(totais.callsReunioes), "no período", "#f0ecfc")}
          {kpi("Conversão", `${totais.conversao}%`, `ticket ${brl(totais.ticketCents)}`, "#fdf2de")}
          {kpi("Dias c/ registro", String(totais.dias), "apontamentos", "#f2f2f2")}
        </div>

        {/* Dashboard: valor por dia (barras) */}
        {porDia.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Valor apontado por dia</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, borderBottom: "1px solid #ccc", paddingBottom: 2 }}>
              {porDia.map((d) => (
                <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ width: "70%", maxWidth: 26, height: `${(d.valorCents / maxDia) * 100}%`, background: "#f2691f", borderRadius: "3px 3px 0 0", minHeight: d.valorCents ? 3 : 0 }} />
                  <span style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{fmtDia(d.dia)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ranking por vendedor + mini-barra de valor */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Ranking por vendedor</div>
        <table className="diario-print-tbl" style={{ marginBottom: 16 }}>
          <thead>
            <tr><th>Vendedor</th><th>Leads</th><th>Contatos</th><th>Calls/Reun.</th><th>Vendas</th><th>Valor</th><th>Dias</th></tr>
          </thead>
          <tbody>
            {porVendedor.map((v) => (
              <tr key={v.vendedorIxcId}>
                <td style={{ textAlign: "left" }}>
                  {v.nome}
                  <div style={{ height: 5, background: "#eee", borderRadius: 3, marginTop: 3 }}>
                    <div style={{ width: `${(v.valorCents / maxVend) * 100}%`, height: "100%", background: "#16a34a", borderRadius: 3 }} />
                  </div>
                </td>
                <td>{v.leads}</td>
                <td>{v.contatos}</td>
                <td>{v.callsReunioes}</td>
                <td>{v.vendas}</td>
                <td>{brl(v.valorCents)}</td>
                <td>{v.dias}</td>
              </tr>
            ))}
            <tr className="tot">
              <td style={{ textAlign: "left" }}>Total</td>
              <td>{totais.leads}</td>
              <td>{totais.contatos}</td>
              <td>{totais.callsReunioes}</td>
              <td>{totais.vendas}</td>
              <td>{brl(totais.valorCents)}</td>
              <td>{totais.dias}</td>
            </tr>
          </tbody>
        </table>

        {/* Produtos */}
        {produtos.length > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Produtos vendidos no período</div>
            <table className="diario-print-tbl">
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.nome}><td style={{ textAlign: "left" }}>{p.nome}</td><td>{p.qtd}</td><td>{brl(p.valorCents)}</td></tr>
                ))}
                <tr className="tot"><td style={{ textAlign: "left" }}>Total</td><td>{totalProdQtd}</td><td>{brl(totalProdValor)}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
