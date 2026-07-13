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

export type DeadlineTone = "overdue" | "soon" | "ok";

// Dias de calendário até o prazo (negativo = atrasado) + tom + rótulo PT-BR.
// soonDays = janela do "chegando no prazo" (amarelo).
export function deadlineInfo(due: Date, soonDays = 7): { days: number; tone: DeadlineTone; label: string } {
  const day = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((+d - +today) / day);
  const tone: DeadlineTone = days < 0 ? "overdue" : days <= soonDays ? "soon" : "ok";
  const abs = Math.abs(days);
  const label =
    days < 0
      ? `Atrasado há ${abs} ${abs === 1 ? "dia" : "dias"}`
      : days === 0
        ? "Vence hoje"
        : days === 1
          ? "Vence amanhã"
          : `Faltam ${days} dias`;
  return { days, tone, label };
}

export function deadlineColor(tone: DeadlineTone): string {
  return tone === "overdue" ? "var(--st-risk)" : tone === "soon" ? "var(--pr-med)" : "var(--ink-2)";
}

// minutos -> "45min" | "2h30" | "2h"
export function minLabel(min: number): string {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
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
