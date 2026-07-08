// Presets rápidos de período (client-side): datas LOCAIS do usuário em "YYYY-MM-DD",
// aplicadas como range custom (ini/fim) — o server resolve via resolvePeriodo.
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PresetKey = "hoje" | "semana";
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
];

// hoje → [hoje, hoje]; semana → [segunda-feira desta semana, hoje].
export function presetRange(key: PresetKey): { ini: string; fim: string } {
  const hoje = new Date();
  if (key === "hoje") {
    const d = isoLocal(hoje);
    return { ini: d, fim: d };
  }
  const seg = new Date(hoje);
  const dow = seg.getDay(); // 0=dom
  seg.setDate(seg.getDate() - ((dow + 6) % 7)); // volta até segunda
  return { ini: isoLocal(seg), fim: isoLocal(hoje) };
}

// Marca o preset ativo comparando com o range da URL (pra pintar o botão).
export function activePreset(ini: string, fim: string): PresetKey | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key);
    if (r.ini === ini && r.fim === fim) return p.key;
  }
  return null;
}
