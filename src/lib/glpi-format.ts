// Helpers client-safe da integração GLPI (sem server-only — usado em client e server).

// Converte o HTML dos chamados/followups do GLPI em texto legível, preservando
// parágrafos, listas e quebras. NÃO renderizamos o HTML cru (sem sanitizer no
// projeto) — texto é seguro contra injeção e suficiente pra leitura.
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html;
  // quebras estruturais → \n
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|h[1-6]|tr|blockquote)\s*>/gi, "\n");
  s = s.replace(/<\s*li[^>]*>/gi, "• ");
  s = s.replace(/<\s*\/\s*li\s*>/gi, "\n");
  // remove todas as tags restantes
  s = s.replace(/<[^>]+>/g, "");
  // decodifica entidades comuns
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  // colapsa excesso de linhas em branco
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  return s;
}

// Cores do badge de status (GLPI: 5/6 concluído, 4 pendente, resto em andamento).
export function statusColors(statusId: number): { color: string; bg: string } {
  if (statusId === 5 || statusId === 6) return { color: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (statusId === 4) return { color: "var(--st-risk)", bg: "var(--st-risk-bg)" };
  return { color: "var(--st-progress)", bg: "var(--st-progress-bg)" };
}

export const PRIORITY_LABEL: Record<number, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
};

// Iniciais (1–2 letras) a partir de um nome/login.
export function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Cor estável (da paleta do app) derivada do nome — pra avatares dos autores.
const AV_VARS = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"];
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `var(${AV_VARS[h % AV_VARS.length]})`;
}

export type StaleLevel = "none" | "warn" | "risk";

// GLPI: aberto = 1 Novo, 2 Em atend. (atribuído), 3 Em atend. (planejado), 4 Pendente.
const OPEN_STATUSES = [1, 2, 3, 4];
export function isOpenStatus(statusId: number): boolean {
  return OPEN_STATUSES.includes(statusId);
}

// Dias sem movimentação (desde date_mod). Só faz sentido pra chamado aberto.
export function staleDays(dateModIso: string | null, dateCreationIso: string): number {
  const ref = dateModIso ? new Date(dateModIso) : new Date(dateCreationIso);
  const ms = Date.now() - ref.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Limiares: ≥7d = risco, ≥3d = atenção. Chamado fechado/solucionado nunca é "parado".
export function staleLevel(statusId: number, days: number): StaleLevel {
  if (!isOpenStatus(statusId)) return "none";
  if (days >= 7) return "risk";
  if (days >= 3) return "warn";
  return "none";
}
