"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const ABAS = [
  { key: "gerencial", label: "Gerenciais" },
  { key: "diario", label: "Diário" },
  { key: "equipe", label: "Equipe" },
];
const SUBS = [
  { key: "geral", label: "Visão Geral" },
  { key: "ranking", label: "Ranking" },
  { key: "vendedor", label: "Por Vendedor" },
];
const PERIODOS = ["Mês atual", "Mês anterior", "2 meses atrás"];

export function RelatoriosNav({
  vendedores,
  filiais,
}: {
  vendedores: { ixcId: string; nome: string }[];
  filiais: { value: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const aba = sp.get("aba") ?? "gerencial";
  const sub = sp.get("sub") ?? "geral";
  const periodo = Number(sp.get("periodo") ?? "0");
  const vendedor = sp.get("vendedor") ?? "";
  const filial = sp.get("filial") ?? "";
  const ini = sp.get("ini") ?? "";
  const fim = sp.get("fim") ?? "";
  const custom = !!(ini && fim);

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    start(() => router.push(`/comercial/relatorios?${params.toString()}`));
  }

  const pill = (active: boolean) =>
    active
      ? { background: "var(--primary)", color: "#fff", padding: "6px 16px", fontSize: 13, borderRadius: "var(--r-pill)" }
      : { background: "transparent", color: "var(--muted)", padding: "6px 16px", fontSize: 13, borderRadius: "var(--r-pill)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12 }}>
      {/* Abas principais */}
      <div className="row gap8" style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: 4, width: "fit-content" }}>
        {ABAS.map((a) => (
          <button key={a.key} className="btn" style={pill(aba === a.key)} onClick={() => go({ aba: a.key })}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Sub-abas + filtros (só nas Gerenciais) */}
      {aba === "gerencial" && (
        <div className="card card-pad row gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <div className="row gap8" style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: 4 }}>
            {SUBS.map((s) => (
              <button key={s.key} className="btn" style={pill(sub === s.key)} onClick={() => go({ sub: s.key })}>
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div className="row gap8" style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: 4 }}>
            {PERIODOS.map((label, i) => (
              <button key={i} className="btn" style={pill(periodo === i && !custom)} onClick={() => go({ periodo: String(i), ini: "", fim: "" })}>
                {label}
              </button>
            ))}
          </div>

          <div className="row gap8" style={{ alignItems: "center", background: custom ? "var(--primary-tint)" : "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: "4px 10px" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Período:</span>
            <input type="date" value={ini} max={fim || undefined} onChange={(e) => go({ ini: e.target.value, periodo: "" })} className="select-comercial" style={{ padding: "3px 6px" }} />
            <span style={{ color: "var(--muted)" }}>–</span>
            <input type="date" value={fim} min={ini || undefined} onChange={(e) => go({ fim: e.target.value, periodo: "" })} className="select-comercial" style={{ padding: "3px 6px" }} />
          </div>

          {sub !== "vendedor" && (
            <select value={vendedor} onChange={(e) => go({ vendedor: e.target.value })} className="select-comercial">
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.ixcId} value={v.ixcId}>{v.nome}</option>
              ))}
            </select>
          )}
          {sub === "vendedor" && (
            <select value={vendedor} onChange={(e) => go({ vendedor: e.target.value })} className="select-comercial">
              <option value="">Selecione um vendedor…</option>
              {vendedores.map((v) => (
                <option key={v.ixcId} value={v.ixcId}>{v.nome}</option>
              ))}
            </select>
          )}

          <select value={filial} onChange={(e) => go({ filial: e.target.value })} className="select-comercial">
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
        </div>
      )}
    </div>
  );
}
