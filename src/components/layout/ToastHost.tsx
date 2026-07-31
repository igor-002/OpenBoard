"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { withBasePath } from "@/lib/basePath";
import { TOAST_EVENT, type LocalToast } from "@/lib/toast";

// Toast unificado: eventos SSE (com link/ator) OU status local (sync iniciado/
// concluído/erro), sem link.
type Toast = {
  id: number;
  icon: IconName;
  title: string;
  sub?: string;
  accent: string;
  link?: string;
};

type EventKind = "project_created" | "task_created" | "solicitacao_cadastro" | "nota_compartilhada";
const EVENT_META: Record<EventKind, { icon: IconName; label: string; verb: string }> = {
  project_created: { icon: "folder", label: "Novo projeto", verb: "criado por" },
  task_created: { icon: "kanban", label: "Nova tarefa", verb: "criada por" },
  solicitacao_cadastro: { icon: "users", label: "Solicitação de cadastro", verb: "solicitado por" },
  nota_compartilhada: { icon: "note", label: "Nota compartilhada", verb: "compartilhada por" },
};

const VARIANT_META: Record<LocalToast["variant"], { icon: IconName; accent: string }> = {
  info: { icon: "zap", accent: "var(--primary)" },
  success: { icon: "checkCircle", accent: "var(--st-done)" },
  error: { icon: "alert", accent: "var(--st-risk)" },
};

const DURATION = 5200; // ms na tela

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">, duration = DURATION) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...t, id }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  // 1) Eventos do servidor (SSE) — criação de projeto/tarefa/solicitação.
  useEffect(() => {
    const es = new EventSource(withBasePath("/api/events"));
    es.onmessage = (ev) => {
      let data: { kind?: string; actorName?: string; entity?: string; link?: string };
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!data.kind || !(data.kind in EVENT_META)) return;
      const m = EVENT_META[data.kind as EventKind];
      push({
        icon: m.icon,
        title: `${m.label}: ${data.entity ?? ""}`.trim(),
        sub: `${m.verb} ${data.actorName ?? "Alguém"}`,
        accent: "var(--primary)",
        link: data.link ?? undefined,
      });
      router.refresh(); // atualiza o sino (não-lidas) sem reload
    };
    return () => es.close();
  }, [router, push]);

  // 2) Toasts locais (client) — status de sync etc. via emitToast().
  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent<LocalToast>).detail;
      if (!d) return;
      const m = VARIANT_META[d.variant];
      push({ icon: m.icon, title: d.title, sub: d.sub, accent: m.accent });
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [push]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-pop"
          onClick={() => {
            dismiss(t.id);
            if (t.link) router.push(t.link);
          }}
          style={{
            pointerEvents: "auto",
            cursor: t.link ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 320,
            maxWidth: 440,
            padding: "13px 18px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            boxShadow: "var(--sh-lg)",
          }}
        >
          <span
            style={{
              flex: "none",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: `color-mix(in srgb, ${t.accent} 14%, transparent)`,
              color: t.accent,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name={t.icon} size={18} />
          </span>
          <div style={{ minWidth: 0, lineHeight: 1.35 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{t.title}</div>
            {t.sub && (
              <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.sub}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
