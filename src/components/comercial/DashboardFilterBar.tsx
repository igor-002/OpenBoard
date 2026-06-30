"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PERIODOS = ["Mês atual", "Mês anterior", "2 meses atrás"];

// Filtros da Visão Geral: período (tabs) + vendedor + filial. Tudo na URL.
export function DashboardFilterBar({
  vendedores,
  filiais,
}: {
  vendedores: { ixcId: string; nome: string }[];
  filiais: { value: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const periodo = Number(sp.get("periodo") ?? "0");
  const vendedor = sp.get("vendedor") ?? "";
  const filial = sp.get("filial") ?? "";

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    start(() => router.push(`/comercial?${params.toString()}`));
  }

  const temFiltro = periodo !== 0 || vendedor || filial;

  return (
    <div className="card card-pad row gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
      <div className="row gap8" style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: 4 }}>
        {PERIODOS.map((label, i) => (
          <button
            key={i}
            onClick={() => apply({ periodo: String(i) })}
            className="btn"
            style={
              periodo === i
                ? { background: "var(--primary)", color: "#fff", padding: "5px 14px", fontSize: 12, borderRadius: "var(--r-pill)" }
                : { background: "transparent", color: "var(--muted)", padding: "5px 14px", fontSize: 12, borderRadius: "var(--r-pill)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <select value={vendedor} onChange={(e) => apply({ vendedor: e.target.value })} className="select-comercial">
        <option value="">Todos os vendedores</option>
        {vendedores.map((v) => (
          <option key={v.ixcId} value={v.ixcId}>{v.nome}</option>
        ))}
      </select>

      <select value={filial} onChange={(e) => apply({ filial: e.target.value })} className="select-comercial">
        <option value="">Todas as filiais</option>
        {filiais.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {temFiltro && (
        <button onClick={() => start(() => router.push("/comercial"))} className="btn btn-ghost" style={{ color: "var(--st-risk)" }}>
          Limpar
        </button>
      )}
      {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
    </div>
  );
}
