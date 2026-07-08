"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { brl } from "@/lib/format";
import { upsertMetaTime, upsertMetaVendedor } from "@/app/(comercial)/comercial/mrr/actions";

type VendRow = { ixcId: string; nome: string; ativos: number; meta: number };

function Barra({ atual, meta }: { atual: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  const cor = pct >= 100 ? "var(--st-done)" : pct >= 50 ? "var(--pr-med)" : "var(--st-progress)";
  return (
    <div className="row gap8" style={{ alignItems: "center", minWidth: 160 }}>
      <div style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: cor }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: "right", color: cor }}>{meta > 0 ? `${pct}%` : "—"}</span>
    </div>
  );
}

// O MRR ativo da CARTEIRA (base toda) não aparece aqui (decisão 2026-07-08) —
// os demais valores (MRR do mês, metas, projeções) são normais.
export function MetasManager({
  isAdmin,
  mes,
  ano,
  mesLabel,
  ativosTotal,
  metaContratos,
  metaMrrCents,
  vendedores,
  mrrAtivadoMesCents,
  diasUteisTotal,
  diasUteisPassados,
}: {
  isAdmin: boolean;
  mes: number;
  ano: number;
  mesLabel: string;
  ativosTotal: number;
  metaContratos: number;
  metaMrrCents: number;
  vendedores: VendRow[];
  mrrAtivadoMesCents: number;
  diasUteisTotal: number;
  diasUteisPassados: number;
}) {
  const [pending, start] = useTransition();
  const [mc, setMc] = useState(String(metaContratos || ""));
  const [mm, setMm] = useState(String(metaMrrCents ? metaMrrCents / 100 : ""));
  const [vmetas, setVmetas] = useState<Record<string, string>>(
    Object.fromEntries(vendedores.map((v) => [v.ixcId, v.meta ? String(v.meta) : ""])),
  );
  const [msg, setMsg] = useState<string | null>(null);

  function salvarTime() {
    setMsg(null);
    start(async () => {
      const r = await upsertMetaTime(mes, ano, parseInt(mc || "0", 10), Math.round(parseFloat(mm || "0") * 100));
      setMsg(r.ok ? "Meta do time salva." : r.error ?? "Erro");
    });
  }
  function salvarVend(ixcId: string) {
    start(async () => {
      await upsertMetaVendedor(ixcId, mes, ano, parseInt(vmetas[ixcId] || "0", 10));
      setMsg("Meta do vendedor salva.");
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">MRR & Metas</h1>
          <p className="page-sub">{mesLabel} {ano} · {ativosTotal} contratos ativados no mês</p>
        </div>
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>

      {/* Meta do time */}
      <Card title="Meta do time" sub={`Contratos ativados e MRR alvo em ${mesLabel} — ativação conta pra meta, mesmo de venda antiga`} pad>
        <div className="row gap12" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Meta de contratos ativos
            <input type="number" min="0" value={mc} onChange={(e) => setMc(e.target.value)} disabled={!isAdmin || pending}
              className="select-comercial" style={{ width: 160 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Meta de MRR (R$)
            <input type="number" min="0" step="0.01" value={mm} onChange={(e) => setMm(e.target.value)} disabled={!isAdmin || pending}
              className="select-comercial" style={{ width: 160 }} />
          </label>
          {isAdmin && <button className="btn btn-primary" onClick={salvarTime} disabled={pending}>Salvar meta</button>}
        </div>
        <div style={{ marginTop: 16, maxWidth: 420 }}>
          <div className="row gap12" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span className="muted">Atingimento (ativos / meta)</span>
            <span style={{ fontWeight: 700 }}>{ativosTotal} / {metaContratos || "—"}</span>
          </div>
          <Barra atual={ativosTotal} meta={metaContratos} />
        </div>

        {/* Run-rate: projeção de fechamento do mês pelo ritmo de dias úteis */}
        {diasUteisPassados > 0 && (ativosTotal > 0 || metaContratos > 0) && (() => {
          const projContratos = Math.round((ativosTotal / diasUteisPassados) * diasUteisTotal);
          const projMrrCents = Math.round((mrrAtivadoMesCents / diasUteisPassados) * diasUteisTotal);
          const pctProj = metaContratos > 0 ? Math.round((projContratos / metaContratos) * 100) : null;
          const faltam = Math.max(0, metaContratos - ativosTotal);
          const diasRestantes = Math.max(0, diasUteisTotal - diasUteisPassados);
          const ritmoNecessario = faltam > 0 && diasRestantes > 0 ? Math.ceil((faltam / diasRestantes) * 10) / 10 : null;
          const cor = pctProj == null ? "var(--muted)" : pctProj >= 100 ? "var(--st-done)" : pctProj >= 80 ? "var(--pr-med)" : "var(--st-risk)";
          return (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: "12px 36px" }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>Projeção do mês (run-rate)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: cor }}>
                  {projContratos} contratos{pctProj != null && <span style={{ fontSize: 13, marginLeft: 6 }}>({pctProj}% da meta)</span>}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>ritmo atual × {diasUteisTotal} dias úteis ({diasUteisPassados} decorridos)</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>Projeção de MRR ativado</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{brl(projMrrCents)}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{brl(mrrAtivadoMesCents)} ativados até agora</div>
              </div>
              {ritmoNecessario != null && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>Pra bater a meta</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{ritmoNecessario}/dia útil</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>faltam {faltam} em {diasRestantes} dias úteis</div>
                </div>
              )}
            </div>
          );
        })()}
      </Card>

      {/* Metas por vendedor */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Metas por vendedor" sub="Meta de contratos ativos por pessoa" pad={false}>
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Vendedor</th>
                <th style={{ textAlign: "right" }}>Ativos</th>
                <th style={{ textAlign: "left" }}>Meta</th>
                <th style={{ textAlign: "left" }}>Atingimento</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const metaNum = parseInt(vmetas[v.ixcId] || "0", 10);
                return (
                  <tr key={v.ixcId}>
                    <td style={{ fontWeight: 700 }}>{v.nome}</td>
                    <td style={{ textAlign: "right", color: "var(--st-done)", fontWeight: 700 }}>{v.ativos}</td>
                    <td>
                      <input type="number" min="0" value={vmetas[v.ixcId] ?? ""} disabled={!isAdmin || pending}
                        onChange={(e) => setVmetas((s) => ({ ...s, [v.ixcId]: e.target.value }))}
                        placeholder="0" className="select-comercial" style={{ width: 80 }} />
                    </td>
                    <td><Barra atual={v.ativos} meta={metaNum} /></td>
                    {isAdmin && (
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-ghost" onClick={() => salvarVend(v.ixcId)} disabled={pending}>Salvar</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
      {!isAdmin && <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Apenas administradores podem editar metas.</p>}
    </div>
  );
}
