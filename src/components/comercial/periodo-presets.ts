// Presets rápidos de período (client-side): datas LOCAIS do usuário em "YYYY-MM-DD",
// aplicadas como range custom (ini/fim) — o server resolve via resolvePeriodo.
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PresetKey = "hoje" | "semana" | "meta";
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
];
/** Fora de PRESETS: só os Relatórios mostram a semana da meta. */
export const META_PRESET: { key: PresetKey; label: string } = { key: "meta", label: "Semana da meta" };

// hoje → [hoje, hoje]; semana → [segunda desta semana, hoje];
// meta → [última quinta, sexta da semana seguinte] — a semana da meta do
// comercial não é seg–dom.
export function presetRange(key: PresetKey): { ini: string; fim: string } {
  const hoje = new Date();
  if (key === "hoje") {
    const d = isoLocal(hoje);
    return { ini: d, fim: d };
  }
  if (key === "meta") {
    const qui = new Date(hoje);
    qui.setDate(qui.getDate() - ((qui.getDay() - 4 + 7) % 7)); // 4 = quinta
    const sex = new Date(qui);
    sex.setDate(sex.getDate() + 8); // sexta da semana seguinte
    return { ini: isoLocal(qui), fim: isoLocal(sex) };
  }
  const seg = new Date(hoje);
  const dow = seg.getDay(); // 0=dom
  seg.setDate(seg.getDate() - ((dow + 6) % 7)); // volta até segunda
  return { ini: isoLocal(seg), fim: isoLocal(hoje) };
}

// Marca o preset ativo comparando com o range da URL (pra pintar o botão).
export function activePreset(ini: string, fim: string): PresetKey | null {
  for (const p of [...PRESETS, META_PRESET]) {
    const r = presetRange(p.key);
    if (r.ini === ini && r.fim === fim) return p.key;
  }
  return null;
}
