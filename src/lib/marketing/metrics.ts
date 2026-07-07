// Delta genérico (variação vs período anterior). Portado de openmarketing/lib/metrics.ts
// (ver docs/HANDOFF-OPENBOARD.md §3). Usado pelos dois sub-módulos de Marketing.

export type Direction = "up" | "down" | "flat";

export interface Delta {
  current: number;
  previous: number | null;
  /** Variação percentual vs período anterior; null quando não há base de comparação */
  deltaPct: number | null;
  direction: Direction;
}

export function computeDelta(current: number, previous: number | null | undefined): Delta {
  if (previous == null || previous === 0) {
    return { current, previous: previous ?? null, deltaPct: null, direction: "flat" };
  }
  const deltaPct = ((current - previous) / Math.abs(previous)) * 100;
  const direction: Direction =
    Math.abs(deltaPct) < 0.05 ? "flat" : deltaPct > 0 ? "up" : "down";
  return { current, previous, deltaPct, direction };
}

/**
 * Melhorou ou piorou? Para métricas onde "menos é melhor"
 * (ex.: tarefas atrasadas), passe lowerIsBetter = true.
 */
export function isImprovement(d: Delta, lowerIsBetter = false): boolean | null {
  if (d.direction === "flat" || d.deltaPct == null) return null;
  return lowerIsBetter ? d.direction === "down" : d.direction === "up";
}
