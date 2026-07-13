// Estágios do funil de Leads (Kanban comercial) + normalizadores de dedup.
// Client-safe (sem server-only): usado tanto na UI quanto no backend de ingest.

// Funil enxuto de 4 estágios (2026-07-13). Ids "ganho"/"perdido" mantidos por
// compatibilidade com stats/forecast/histórico — só o label mudou:
// ganho = Aprovado (conversão), perdido = Sem resposta (saída do funil).
export const LEAD_STAGES = [
  { id: "contato", label: "Em contato", c: "var(--pr-med)" },
  { id: "proposta", label: "Proposta", c: "var(--primary)" },
  { id: "ganho", label: "Aprovado", c: "var(--st-done)" },
  { id: "perdido", label: "Sem resposta", c: "var(--st-risk)" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["id"];
export const LEAD_STAGE_IDS = LEAD_STAGES.map((s) => s.id) as LeadStage[];
export function isLeadStage(s: string | null | undefined): s is LeadStage {
  return !!s && (LEAD_STAGE_IDS as string[]).includes(s);
}
export function leadStageMeta(id: string) {
  return LEAD_STAGES.find((s) => s.id === id) ?? { id, label: id, c: "var(--muted)" };
}

// Probabilidade de fechamento por estágio — base do forecast ponderado
// (Σ valorEstimado × prob dos leads ativos). Calibrar conforme o funil madurar.
export const LEAD_STAGE_PROB: Record<LeadStage, number> = {
  contato: 0.25,
  proposta: 0.75,
  ganho: 1,
  perdido: 0,
};

export const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

// CPF (11) ou CNPJ (14). Só considera match forte se o tamanho bater; senão null.
export function normDoc(s?: string | null): string | null {
  const d = onlyDigits(s);
  return d.length === 11 || d.length === 14 ? d : null;
}

// Telefone: descarta DDI (mantém os últimos 11 dígitos = DDD + número) p/ casar
// variações com/sem +55. Mínimo 8 dígitos pra valer como chave.
export function normPhone(s?: string | null): string | null {
  let d = onlyDigits(s);
  if (d.length < 8) return null;
  if (d.length > 11) d = d.slice(-11);
  return d;
}

export function normEmail(s?: string | null): string | null {
  const e = (s ?? "").trim().toLowerCase();
  return e.length > 3 && e.includes("@") ? e : null;
}
