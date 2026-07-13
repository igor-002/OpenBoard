"use client";

// Seletor de período do relatório: presets + intervalo custom, via querystring.
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PRESETS: { key: string; label: string }[] = [
  { key: "semana", label: "Esta semana" },
  { key: "7d", label: "7 dias" },
  { key: "mes", label: "Este mês" },
  { key: "30d", label: "30 dias" },
  { key: "trimestre", label: "90 dias" },
];

export function PeriodPicker({ preset, fromIso, toIso }: { preset: string; fromIso: string; toIso: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setPreset(key: string) {
    const params = new URLSearchParams(sp.toString());
    params.delete("from");
    params.delete("to");
    params.set("preset", key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setCustom(from: string, to: string) {
    if (!from) return;
    const params = new URLSearchParams(sp.toString());
    params.delete("preset");
    params.set("from", from);
    if (to) params.set("to", to);
    else params.delete("to");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="card" style={{ padding: "10px 14px", marginBottom: "var(--gap)" }}>
      <div className="row gap12" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <div className="row gap8" style={{ flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`btn ${preset === p.key ? "btn-primary" : ""}`}
              style={{ padding: "6px 12px", fontSize: 12.5 }}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span style={{ width: 1, height: 24, background: "var(--line)" }} />
        <div className="row gap8" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Personalizado:</span>
          <input
            className="input"
            type="date"
            value={preset === "custom" ? fromIso : ""}
            onChange={(e) => setCustom(e.target.value, preset === "custom" ? toIso : "")}
            style={{ width: 150, padding: "6px 10px" }}
            aria-label="Data inicial"
          />
          <span className="muted" style={{ fontSize: 12.5 }}>até</span>
          <input
            className="input"
            type="date"
            value={preset === "custom" ? toIso : ""}
            onChange={(e) => setCustom(preset === "custom" ? fromIso : fromIso, e.target.value)}
            style={{ width: 150, padding: "6px 10px" }}
            aria-label="Data final"
          />
        </div>
      </div>
    </div>
  );
}
