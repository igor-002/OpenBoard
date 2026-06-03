// Helpers de formatação PT-BR.

const fmtDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtFull = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// "02 mar" → capitaliza o mês: "02 Mar"
function cap(s: string) {
  return s.replace(/(\d+ )([a-zç]{3})/i, (_, d, m) => d + m.charAt(0).toUpperCase() + m.slice(1));
}

export function dayLabel(d: Date): string {
  return cap(fmtDay.format(d).replace(".", ""));
}

export function fullLabel(d: Date): string {
  return cap(fmtFull.format(d).replace(/\./g, ""));
}

// segundos -> "H:MM:SS"
export function hms(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Date -> "HH:MM"
export function hourLabel(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
