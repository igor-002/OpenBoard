"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { monthLong } from "@/lib/marketing/format";
import { ALL_COMPANIES_SLUG } from "@/server/marketing/social-source";

export function SocialFilterBar({
  companies,
  empresa,
  period,
  months,
}: {
  companies: { slug: string; name: string }[];
  empresa: string;
  period: string;
  months: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    start(() => router.push(`/marketing/social?${params.toString()}`));
  }

  const tabs = [{ slug: ALL_COMPANIES_SLUG, name: "Todas" }, ...companies];

  return (
    <div className="card card-pad row gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
      <div className="row gap8" style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-pill)", padding: 4, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.slug}
            onClick={() => apply({ empresa: t.slug === ALL_COMPANIES_SLUG ? "" : t.slug })}
            className="btn"
            style={
              empresa === t.slug
                ? { background: "var(--primary)", color: "#fff", padding: "5px 14px", fontSize: 12, borderRadius: "var(--r-pill)" }
                : { background: "transparent", color: "var(--muted)", padding: "5px 14px", fontSize: 12, borderRadius: "var(--r-pill)" }
            }
          >
            {t.name}
          </button>
        ))}
      </div>

      <select value={period} onChange={(e) => apply({ periodo: e.target.value })} className="select-comercial">
        {months.map((m) => (
          <option key={m} value={m}>{monthLong(m)}</option>
        ))}
      </select>

      {pending && <span className="muted" style={{ fontSize: 12 }}>…</span>}
    </div>
  );
}
