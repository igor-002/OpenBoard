// Helpers de formatação/período do módulo Marketing. Portado de
// openmarketing/lib/format.ts. Períodos são sempre strings "YYYY-MM".

const nf = new Intl.NumberFormat("pt-BR");
const nfCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtNumber(n: number): string {
  return nf.format(n);
}

export function fmtCompact(n: number): string {
  return nfCompact.format(n);
}

export function fmtPercent(n: number, digits = 1): string {
  return `${nf.format(Number(n.toFixed(digits)))}%`;
}

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MONTHS_LONG = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-07" → "jul/26" */
export function monthShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** "2026-07" → "Julho de 2026" */
export function monthLong(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

/** Período "YYYY-MM" do mês atual */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Período anterior a um "YYYY-MM" */
export function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
