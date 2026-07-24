// Bus de toast LOCAL (disparado no client, ex.: início/fim de um sync). Separado
// dos toasts de eventos SSE (/api/events) — ambos são renderizados pelo ToastHost.
// Uso: emitToast({ variant: "info", title: "Sync iniciada…" }).
export const TOAST_EVENT = "app-toast";

export type ToastVariant = "info" | "success" | "error";
export type LocalToast = { variant: ToastVariant; title: string; sub?: string };

export function emitToast(t: LocalToast): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LocalToast>(TOAST_EVENT, { detail: t }));
}
