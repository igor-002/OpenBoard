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

export function MetasManager({
  isAdmin,
  mes,
  ano,
  mesLabel,
  mrrAtivoCents,
  ativosTotal,
  metaContratos,
  metaMrrCents,
  vendedores,
}: {
  isAdmin: boolean;
  mes: number;
  ano: number;
  mesLabel: string;
  mrrAtivoCents: number;
  ativosTotal: number;
  metaContratos: number;
  metaMrrCents: number;
  vendedores: VendRow[];
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
          <p className="page-sub">{mesLabel} {ano} · MRR ativo {brl(mrrAtivoCents)} · {ativosTotal} contratos ativos</p>
        </div>
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>

      {/* Meta do time */}
      <Card title="Meta do time" sub={`Contratos ativos e MRR alvo em ${mesLabel}`} pad>
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
