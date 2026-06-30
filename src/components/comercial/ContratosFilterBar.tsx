"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";

type Opt = { value: string; label: string };

// Barra de filtros dos Contratos (busca, status, vendedor). Atualiza a URL.
export function ContratosFilterBar({
  vendedores,
  statusOptions,
  filiais,
}: {
  vendedores: { ixcId: string; nome: string }[];
  statusOptions: Opt[];
  filiais: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // reseta paginação ao filtrar
    start(() => router.push(`/comercial/contratos?${params.toString()}`));
  }

  const status = sp.get("status") ?? "";
  const vendedor = sp.get("vendedor") ?? "";
  const filial = sp.get("filial") ?? "";
  const temFiltro = q || status || vendedor || filial;

  return (
    <div className="card card-pad row gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
      <form
        onSubmit={(e) => { e.preventDefault(); apply({ q }); }}
        className="row gap8"
        style={{ flex: 1, minWidth: 220, alignItems: "center", background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "6px 12px" }}
      >
        <Icon name="search" size={15} style={{ color: "var(--muted)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente ou contrato…"
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14 }}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); apply({ q: "" }); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
            <Icon name="more" size={14} />
          </button>
        )}
      </form>

      <select value={status} onChange={(e) => apply({ status: e.target.value })} className="select-comercial">
        <option value="">Todos os status</option>
        {statusOptions.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

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
        <button
          onClick={() => { setQ(""); start(() => router.push("/comercial/contratos")); }}
          className="btn btn-ghost"
          style={{ color: "var(--st-risk)" }}
        >
          Limpar filtros
        </button>
      )}
      {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
    </div>
  );
}
