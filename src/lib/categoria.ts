// Categoria do projeto (campo `tag`): é texto livre no banco, mas se comporta
// como lista — as opções saem do que já existe e grafias que só diferem em
// maiúscula/minúscula são a MESMA categoria ("hotspot" = "Hotspot").

/** Chave de comparação: só caixa, sem mexer em acento (Atendaí ≠ Atendai). */
export const chaveCategoria = (s: string) => s.trim().toLowerCase();

/** Limpa espaço sobrando antes de gravar. */
export const limparCategoria = (s: string) => s.trim().replace(/\s+/g, " ");

// Paleta fixa por categoria. Índice vem de um hash do nome, então a mesma
// categoria mantém a cor em toda a tela (card, chip, filtro) sem cadastro.
const CORES: { fg: string; bg: string }[] = [
  { fg: "#2d6ff2", bg: "#eaf1fe" },
  { fg: "#16a34a", bg: "#e7f6ec" },
  { fg: "#7a5ae0", bg: "#f0ecfc" },
  { fg: "#e8910c", bg: "#fdf2de" },
  { fg: "#0e9aa7", bg: "#e2f5f7" },
  { fg: "#e5484d", bg: "#fcecec" },
  { fg: "#c2410c", bg: "#fdeee3" },
  { fg: "#4f5b93", bg: "#ecedf6" },
];

export function corCategoria(nome: string): { fg: string; bg: string } {
  const k = chaveCategoria(nome);
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}
