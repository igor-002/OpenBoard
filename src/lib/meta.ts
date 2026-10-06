// Metadados de apresentação (rótulos + cores via CSS vars).
// Portado de data.jsx do protótipo.

import type { ProjectStatus, Priority, TaskColumn, TaskOrigin } from "./types";

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; c: string; bg: string }
> = {
  progress: { label: "Em andamento", c: "var(--st-progress)", bg: "var(--st-progress-bg)" },
  done: { label: "Concluído", c: "var(--st-done)", bg: "var(--st-done-bg)" },
  review: { label: "Em revisão", c: "var(--st-review)", bg: "var(--st-review-bg)" },
  planned: { label: "Planejado", c: "var(--st-planned)", bg: "var(--st-planned-bg)" },
};

export const PRIORITY_META: Record<Priority, { label: string; c: string; bg: string }> = {
  high: { label: "Alta", c: "var(--pr-high)", bg: "var(--pr-high-bg)" },
  med: { label: "Média", c: "var(--pr-med)", bg: "var(--pr-med-bg)" },
  low: { label: "Baixa", c: "var(--pr-low)", bg: "var(--pr-low-bg)" },
};

// Canal por onde a demanda chegou. `avulsa` é o valor antigo de "não planejada"
// sem canal definido; segue existindo pro histórico.
export const ORIGEM_META: Record<TaskOrigin, { label: string; c: string; bg: string }> = {
  whatsapp: { label: "WhatsApp", c: "var(--st-done)", bg: "var(--st-done-bg)" },
  telefone: { label: "Telefone", c: "var(--pr-med)", bg: "var(--pr-med-bg)" },
  presencial: { label: "Presencial", c: "var(--st-progress)", bg: "var(--st-progress-bg)" },
  planejada: { label: "Interna", c: "var(--st-planned)", bg: "var(--st-planned-bg)" },
  monitoramento: { label: "Monitoramento", c: "var(--st-risk)", bg: "var(--st-risk-bg)" },
  avulsa: { label: "Outro", c: "var(--st-review)", bg: "var(--st-review-bg)" },
};

// Ordem em que os canais aparecem em seletor e relatório.
export const ORIGENS: TaskOrigin[] = ["whatsapp", "telefone", "presencial", "planejada", "monitoramento", "avulsa"];

// Colunas do quadro. "Cancelada" é status mas não é coluna: sai do quadro.
export const KANBAN_COLS: { id: TaskColumn; label: string; c: string }[] = [
  { id: "todo", label: "Na fila", c: "var(--st-planned)" },
  { id: "doing", label: "Em atendimento", c: "var(--st-progress)" },
  { id: "waiting", label: "Aguardando", c: "var(--pr-med)" },
  { id: "done", label: "Resolvida", c: "var(--st-done)" },
];

// Todos os status de uma demanda, com rótulo e cor.
export const STATUS_DEMANDA: Record<TaskColumn, { label: string; c: string; bg: string }> = {
  todo: { label: "Na fila", c: "var(--st-planned)", bg: "var(--st-planned-bg)" },
  doing: { label: "Em atendimento", c: "var(--st-progress)", bg: "var(--st-progress-bg)" },
  waiting: { label: "Aguardando", c: "var(--pr-med)", bg: "var(--pr-med-bg)" },
  done: { label: "Resolvida", c: "var(--st-done)", bg: "var(--st-done-bg)" },
  canceled: { label: "Cancelada", c: "var(--muted)", bg: "var(--surface-3)" },
};

// Demanda aberta = ainda pede trabalho. Use isto em vez de `!== "done"`:
// cancelada também está fechada.
export const COLUNAS_ABERTAS: TaskColumn[] = ["todo", "doing", "waiting"];
export function isAberta(column: TaskColumn): boolean {
  return COLUNAS_ABERTAS.includes(column);
}

// Atrasada = aberta e o DIA do prazo já passou. Prazo é gravado ao meio-dia, então
// comparar com "agora" faria a demanda virar atrasada no meio do próprio dia.
export function isAtrasada(column: TaskColumn, dueDate: Date | string | null | undefined, agora: Date | number = Date.now()): boolean {
  if (!dueDate || !isAberta(column)) return false;
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  return +new Date(dueDate) < +inicioDoDia;
}

// Tarefa concluída some do quadro depois disso: a coluna "Concluído" crescia
// pra sempre e enterrava as três colunas que importam.
export const DIAS_CONCLUIDA_QUADRO = 7;

// Mesmo problema no quadro de projetos, mas Project não tem data de conclusão
// (só createdAt), então o corte é por quantidade e não por dias: mostra os N
// mais recentes e esconde o resto atrás de um botão.
export const PROJETOS_CONCLUIDOS_QUADRO = 8;

export const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
