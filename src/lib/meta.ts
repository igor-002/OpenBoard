// Metadados de apresentação (rótulos + cores via CSS vars).
// Portado de data.jsx do protótipo.

import type { ProjectStatus, Priority, TaskColumn } from "./types";

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

export const KANBAN_COLS: { id: TaskColumn; label: string; c: string }[] = [
  { id: "todo", label: "A fazer", c: "var(--st-planned)" },
  { id: "doing", label: "Em progresso", c: "var(--st-progress)" },
  { id: "review", label: "Em revisão", c: "var(--st-review)" },
  { id: "done", label: "Concluído", c: "var(--st-done)" },
];

export const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
