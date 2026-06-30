"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { brl } from "@/lib/format";
import { upsertDiario } from "@/app/(comercial)/comercial/relatorios/diario-actions";

type ProdutoIn = { nome: string; valor: string }; // valor em reais
type Linha = {
  ixcId: string;
  nome: string;
  leads: string;
  contatos: string;
  callsReunioes: string;
  vendas: string;
  valor: string; // reais (manual, usado só quando não há produtos)
  observacoes: string;
  produtos: ProdutoIn[];
  preenchido: boolean;
};

const num = (s: string) => parseInt(s || "0", 10) || 0;
const reais = (s: string) => parseFloat((s || "0").replace(",", ".")) || 0;
const cents = (s: string) => Math.round(reais(s) * 100);
// Valor efetivo da linha (R$): soma dos produtos se houver, senão o valor manual.
const valorLinha = (l: Linha) =>
  l.produtos.length > 0 ? l.produtos.reduce((a, p) => a + reais(p.valor), 0) : reais(l.valor);

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function dataExtenso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES[m - 1]} ${y}`;
}

export function DiarioManager({ dataISO, vendedores }: { dataISO: string; vendedores: Linha[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [linhas, setLinhas] = useState(vendedores);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState<Record<string, ProdutoIn>>({});

  function set(ixcId: string, campo: keyof Linha, v: string) {
    setLinhas((ls) => ls.map((l) => (l.ixcId === ixcId ? { ...l, [campo]: v } : l)));
  }
  function addProduto(ixcId: string) {
    const p = novo[ixcId];
    if (!p || !p.nome.trim()) return;
    setLinhas((ls) => ls.map((l) => (l.ixcId === ixcId ? { ...l, produtos: [...l.produtos, { nome: p.nome.trim(), valor: p.valor }] } : l)));
    setNovo((n) => ({ ...n, [ixcId]: { nome: "", valor: "" } }));
  }
  function removeProduto(ixcId: string, idx: number) {
    setLinhas((ls) => ls.map((l) => (l.ixcId === ixcId ? { ...l, produtos: l.produtos.filter((_, i) => i !== idx) } : l)));
  }
  function trocarData(nova: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("aba", "diario");
    params.set("data", nova);
    start(() => router.push(`/comercial/relatorios?${params.toString()}`));
  }
  function salvar(l: Linha) {
    setSavingId(l.ixcId);
    start(async () => {
      const produtos = l.produtos.filter((p) => p.nome.trim()).map((p) => ({ nome: p.nome.trim(), valorCents: cents(p.valor) }));
      await upsertDiario(l.ixcId, dataISO, {
        leads: num(l.leads), contatos: num(l.contatos), callsReunioes: num(l.callsReunioes),
        vendas: num(l.vendas), valorCents: cents(l.valor), observacoes: l.observacoes, produtos,
      });
      setLinhas((ls) => ls.map((x) => (x.ixcId === l.ixcId ? { ...x, preenchido: true } : x)));
      setSavingId(null);
    });
  }
  function imprimir() {
    document.body.classList.add("printing");
    const limpar = () => { document.body.classList.remove("printing"); window.removeEventListener("afterprint", limpar); };
    window.addEventListener("afterprint", limpar);
    window.print();
  }

  const tot = linhas.reduce(
    (a, l) => ({ leads: a.leads + num(l.leads), contatos: a.contatos + num(l.contatos), calls: a.calls + num(l.callsReunioes), vendas: a.vendas + num(l.vendas), valor: a.valor + valorLinha(l) }),
    { leads: 0, contatos: 0, calls: 0, vendas: 0, valor: 0 },
  );
  const preenchidos = linhas.filter((l) => l.preenchido).length;
  // Produtos consolidados do dia (todas as linhas).
  const prodDia = (() => {
    const m = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const l of linhas) for (const p of l.produtos) {
      if (!p.nome.trim()) continue;
      const k = p.nome.trim().toLowerCase();
      const e = m.get(k) ?? { nome: p.nome.trim(), qtd: 0, valor: 0 };
      e.qtd += 1; e.valor += reais(p.valor);
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  })();
  const inp = { width: 64 } as React.CSSProperties;

  return (
    <div style={{ marginTop: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div className="card card-pad row gap12" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "var(--muted)" }}>Data do apontamento</label>
        <input type="date" value={dataISO} onChange={(e) => trocarData(e.target.value)} className="select-comercial" />
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ color: "var(--st-progress)", background: "var(--st-progress-bg)" }}>
          {preenchidos} de {linhas.length} preencheram
        </span>
        <button className="btn btn-ghost" onClick={imprimir} title="Gerar PDF (imprimir → salvar como PDF)">
          <Icon name="download" size={15} /> Gerar PDF
        </button>
        {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
      </div>

      <Card title="Apontamento por vendedor" sub="Esforço comercial do dia (manual) — adicione produtos para somar o valor automaticamente" pad={false}>
        <table className="tbl" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Vendedor</th>
              <th>Leads</th>
              <th>Contatos</th>
              <th>Calls/Reun.</th>
              <th>Vendas</th>
              <th>Produtos</th>
              <th style={{ textAlign: "left" }}>Valor (R$)</th>
              <th style={{ textAlign: "left" }}>Obs.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const temProdutos = l.produtos.length > 0;
              const expandido = aberto === l.ixcId;
              return (
              <Fragment key={l.ixcId}>
              <tr>
                <td style={{ fontWeight: 700 }}>
                  {l.nome} {l.preenchido && <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)", fontSize: 10 }}>OK</span>}
                </td>
                <td><input type="number" min="0" value={l.leads} onChange={(e) => set(l.ixcId, "leads", e.target.value)} className="select-comercial" style={inp} /></td>
                <td><input type="number" min="0" value={l.contatos} onChange={(e) => set(l.ixcId, "contatos", e.target.value)} className="select-comercial" style={inp} /></td>
                <td><input type="number" min="0" value={l.callsReunioes} onChange={(e) => set(l.ixcId, "callsReunioes", e.target.value)} className="select-comercial" style={inp} /></td>
                <td><input type="number" min="0" value={l.vendas} onChange={(e) => set(l.ixcId, "vendas", e.target.value)} className="select-comercial" style={inp} /></td>
                <td style={{ textAlign: "center" }}>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={() => setAberto(expandido ? null : l.ixcId)} title="Produtos vendidos">
                    <Icon name={expandido ? "chevDown" : "chevRight"} size={14} /> {l.produtos.length || "—"}
                  </button>
                </td>
                <td>
                  {temProdutos ? (
                    <span style={{ fontWeight: 700 }} title="Soma automática dos produtos">{brl(Math.round(valorLinha(l) * 100))}</span>
                  ) : (
                    <input type="number" min="0" step="0.01" value={l.valor} onChange={(e) => set(l.ixcId, "valor", e.target.value)} className="select-comercial" style={{ width: 90 }} />
                  )}
                </td>
                <td><input value={l.observacoes} onChange={(e) => set(l.ixcId, "observacoes", e.target.value)} className="select-comercial" style={{ width: 140 }} placeholder="—" /></td>
                <td style={{ textAlign: "right" }}><button className="btn btn-ghost" onClick={() => salvar(l)} disabled={pending}>{savingId === l.ixcId ? "…" : "Salvar"}</button></td>
              </tr>
              {expandido && (
                <tr style={{ background: "var(--surface-2)" }}>
                  <td colSpan={9} style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {l.produtos.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Nenhum produto. Adicione abaixo.</span>}
                      {l.produtos.map((p, i) => (
                        <span key={i} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--st-done)", background: "var(--st-done-bg)" }}>
                          {p.nome} · {brl(cents(p.valor))}
                          <button onClick={() => removeProduto(l.ixcId, i)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }} title="Remover" aria-label="Remover produto">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="row gap8" style={{ marginTop: 10, flexWrap: "wrap" }}>
                      <input
                        value={novo[l.ixcId]?.nome ?? ""}
                        onChange={(e) => setNovo((n) => ({ ...n, [l.ixcId]: { nome: e.target.value, valor: n[l.ixcId]?.valor ?? "" } }))}
                        onKeyDown={(e) => { if (e.key === "Enter") addProduto(l.ixcId); }}
                        className="select-comercial" style={{ width: 220 }} placeholder="Nome do produto"
                      />
                      <input
                        type="number" min="0" step="0.01"
                        value={novo[l.ixcId]?.valor ?? ""}
                        onChange={(e) => setNovo((n) => ({ ...n, [l.ixcId]: { nome: n[l.ixcId]?.nome ?? "", valor: e.target.value } }))}
                        onKeyDown={(e) => { if (e.key === "Enter") addProduto(l.ixcId); }}
                        className="select-comercial" style={{ width: 110 }} placeholder="Valor R$"
                      />
                      <button className="btn btn-ghost" onClick={() => addProduto(l.ixcId)}><Icon name="plus" size={14} /> Adicionar</button>
                      <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>O valor da venda passa a ser a soma dos produtos.</span>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--line-2)", fontWeight: 800 }}>
              <td>Consolidado do dia</td>
              <td style={{ textAlign: "center" }}>{tot.leads}</td>
              <td style={{ textAlign: "center" }}>{tot.contatos}</td>
              <td style={{ textAlign: "center" }}>{tot.calls}</td>
              <td style={{ textAlign: "center" }}>{tot.vendas}</td>
              <td />
              <td colSpan={3}>{brl(Math.round(tot.valor * 100))}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {prodDia.length > 0 && (
        <Card title="Produtos vendidos no dia" sub="Consolidado dos produtos apontados" pad={false}>
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr><th style={{ textAlign: "left" }}>Produto</th><th style={{ textAlign: "right" }}>Qtd.</th><th style={{ textAlign: "right" }}>Valor</th></tr>
            </thead>
            <tbody>
              {prodDia.map((p) => (
                <tr key={p.nome}>
                  <td style={{ fontWeight: 700 }}>{p.nome}</td>
                  <td style={{ textAlign: "right" }} className="muted">{p.qtd}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(Math.round(p.valor * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Bloco de impressão (PDF) — só visível em @media print */}
      <div className="diario-print">
        <h2 style={{ margin: "0 0 4px" }}>Relatório Diário Comercial</h2>
        <p style={{ margin: "0 0 16px", color: "#444" }}>{dataExtenso(dataISO)} · {preenchidos} de {linhas.length} vendedores preencheram</p>
        <table className="diario-print-tbl">
          <thead>
            <tr><th>Vendedor</th><th>Leads</th><th>Contatos</th><th>Calls</th><th>Vendas</th><th>Valor</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ixcId}>
                <td>{l.nome}</td>
                <td>{num(l.leads)}</td>
                <td>{num(l.contatos)}</td>
                <td>{num(l.callsReunioes)}</td>
                <td>{num(l.vendas)}</td>
                <td>{brl(Math.round(valorLinha(l) * 100))}</td>
              </tr>
            ))}
            <tr className="tot">
              <td>Total</td><td>{tot.leads}</td><td>{tot.contatos}</td><td>{tot.calls}</td><td>{tot.vendas}</td><td>{brl(Math.round(tot.valor * 100))}</td>
            </tr>
          </tbody>
        </table>
        {prodDia.length > 0 && (
          <>
            <h3 style={{ margin: "20px 0 6px" }}>Produtos vendidos no dia</h3>
            <table className="diario-print-tbl">
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead>
              <tbody>
                {prodDia.map((p) => (
                  <tr key={p.nome}><td>{p.nome}</td><td>{p.qtd}</td><td>{brl(Math.round(p.valor * 100))}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
