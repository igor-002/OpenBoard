"use client";

// Painel de identidade visual ao vivo (portado de tweaks-panel.jsx).
// Aplica CSS vars no <html> e persiste em localStorage.
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Tweaks = {
  accent: string;
  font: string;
  sidebar: "light" | "dark";
  density: "regular" | "compact";
  corners: "soft" | "sharp";
};

const DEFAULTS: Tweaks = {
  accent: "#F2691F",
  font: "Plus Jakarta Sans",
  sidebar: "light",
  density: "regular",
  corners: "soft",
};

const ACCENTS = ["#F2691F", "#7A5AE0", "#2D6FF2", "#16A34A", "#16181D"];
const FONTS = ["Plus Jakarta Sans", "Space Grotesk", "Manrope", "Hanken Grotesk"];
const STORAGE_KEY = "ob-tweaks";

function apply(t: Tweaks) {
  const r = document.documentElement;
  r.style.setProperty("--primary", t.accent);
  r.style.setProperty("--font", `'${t.font}', system-ui, sans-serif`);
  r.style.setProperty("--font-display", `'${t.font}', system-ui, sans-serif`);
  r.setAttribute("data-side", t.sidebar);
  r.setAttribute("data-density", t.density);
  r.setAttribute("data-corners", t.corners);
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<Tweaks>(DEFAULTS);

  // Carrega do localStorage no mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setT({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  // Aplica + persiste a cada mudança.
  useEffect(() => {
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {}
  }, [t]);

  const set = <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => setT((p) => ({ ...p, [k]: v }));

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setOpen((o) => !o)}
        style={{ position: "fixed", right: 22, bottom: 22, zIndex: 50, borderRadius: "var(--r-pill)", boxShadow: "var(--sh-lg)" }}
        title="Tweaks"
      >
        <Icon name="settings" size={16} />
        Tweaks
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 22,
            bottom: 74,
            zIndex: 50,
            width: 280,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--sh-lg)",
            padding: 18,
          }}
        >
          <Section label="Identidade" />
          <Field label="Cor principal">
            <div className="row gap8">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => set("accent", c)}
                  title={c}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: c,
                    border: t.accent === c ? "2px solid var(--ink)" : "2px solid var(--line-2)",
                    outline: t.accent === c ? "2px solid var(--surface)" : "none",
                    outlineOffset: -4,
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Fonte">
            <select className="input" value={t.font} onChange={(e) => set("font", e.target.value)}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Section label="Layout" />
          <Radio label="Sidebar" value={t.sidebar} options={[["light", "Clara"], ["dark", "Escura"]]} onChange={(v) => set("sidebar", v as Tweaks["sidebar"])} />
          <Radio label="Densidade" value={t.density} options={[["regular", "Padrão"], ["compact", "Compacta"]]} onChange={(v) => set("density", v as Tweaks["density"])} />
          <Radio label="Cantos" value={t.corners} options={[["soft", "Arredondados"], ["sharp", "Retos"]]} onChange={(v) => set("corners", v as Tweaks["corners"])} />

          <button className="btn btn-block" style={{ marginTop: 14 }} onClick={() => setT(DEFAULTS)}>
            Restaurar padrão
          </button>
        </div>
      )}
    </>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--muted-2)", margin: "10px 0 12px" }}>
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Radio({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="seg" style={{ width: "100%" }}>
        {options.map(([k, l]) => (
          <button key={k} className={value === k ? "on" : ""} style={{ flex: 1 }} onClick={() => onChange(k)}>
            {l}
          </button>
        ))}
      </div>
    </Field>
  );
}
