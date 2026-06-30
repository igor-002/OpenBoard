"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function EquipeFilter({ ini, fim }: { ini: string; fim: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function set(campo: "ini" | "fim", v: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("aba", "equipe");
    params.set(campo, v);
    start(() => router.push(`/comercial/relatorios?${params.toString()}`));
  }

  return (
    <div className="card card-pad row gap12" style={{ alignItems: "center", flexWrap: "wrap", marginTop: "var(--gap)" }}>
      <label style={{ fontSize: 13, color: "var(--muted)" }}>De</label>
      <input type="date" value={ini} onChange={(e) => set("ini", e.target.value)} className="select-comercial" />
      <label style={{ fontSize: 13, color: "var(--muted)" }}>Até</label>
      <input type="date" value={fim} onChange={(e) => set("fim", e.target.value)} className="select-comercial" />
      {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
    </div>
  );
}
