"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

type Toast = {
  id: number;
  kind: "project_created" | "task_created";
  actorName: string;
  entity: string;
  link: string;
};

const META: Record<Toast["kind"], { icon: IconName; label: string; verb: string }> = {
  project_created: { icon: "folder", label: "Novo projeto", verb: "criado por" },
  task_created: { icon: "kanban", label: "Nova tarefa", verb: "criada por" },
};

const DURATION = 5200; // ms na tela

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (ev) => {
      let data: Partial<Toast> & { kind?: string };
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.kind !== "project_created" && data.kind !== "task_created") return;

      const id = nextId.current++;
      setToasts((list) => [
        ...list,
        { id, kind: data.kind as Toast["kind"], actorName: data.actorName ?? "Alguém", entity: data.entity ?? "", link: data.link ?? "#" },
      ]);
      // atualiza o sino (contador de não-lidas) sem reload.
      router.refresh();
      setTimeout(() => dismiss(id), DURATION);
    };

    // EventSource reconecta sozinho em erro; nada a fazer aqui.
    return () => es.close();
  }, [router, dismiss]);

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
      {toasts.map((t) => {
        const m = META[t.kind];
        return (
          <div
            key={t.id}
            className="toast-pop"
            onClick={() => {
              dismiss(t.id);
              router.push(t.link);
            }}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
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
                background: "var(--primary-tint)",
                color: "var(--primary)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon name={m.icon} size={18} />
            </span>
            <div style={{ minWidth: 0, lineHeight: 1.35 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                {m.label}: <span style={{ color: "var(--primary)" }}>{t.entity}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.verb} {t.actorName}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
