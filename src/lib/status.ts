// Rótulos de status do contrato (campo `status_internet` — handoff §6 / SalesTracker).
// Client-safe (SEM server-only) — pode ser importado por componentes client (ex.: PDFs).
export const STATUS_LABEL: Record<string, string> = {
  A: "Ativo",
  AA: "Aguardando Assinatura",
  P: "Proposta", // tratado como pipeline junto de AA
  B: "Bloqueado",
  CM: "Bloqueado (Manual)",
  C: "Cancelado",
  CN: "Cancelado",
  CA: "Cancelado",
  FA: "Financeiro em Atraso",
  N: "Negativado",
  D: "Desativado", // ⚠️ inferido — confirmar significado no IXC (12k contratos)
};

export const isRealizado = (status: string) => status === "A"; // meta real do mês
export const isPipeline = (status: string) => status === "AA" || status === "P"; // promessa
