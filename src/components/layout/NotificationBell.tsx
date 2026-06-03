"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { markAllRead } from "@/app/(app)/notifications/actions";
import type { NotificationItem } from "@/server/notifications";

const TYPE_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  task_assigned: "kanban",
  note_added: "msg",
  project_member: "folder",
};

function when(d: Date) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    // Ao abrir com não-lidas, marca todas como lidas.
    if (next && unread > 0) {
      start(async () => {
        await markAllRead();
        router.refresh();
      });
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" title="Notificações" onClick={toggle}>
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--primary)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
              border: "1.5px solid var(--surface)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 48,
              zIndex: 50,
              width: 340,
              maxHeight: 420,
              overflowY: "auto",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--sh-lg)",
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", fontWeight: 800, fontSize: 14 }}>
              Notificações
            </div>
            {items.length === 0 ? (
              <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>Nada por aqui.</div>
            ) : (
              items.map((n) => {
                const inner = (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "12px 16px",
                      borderTop: "1px solid var(--line)",
                      background: n.read ? "transparent" : "var(--primary-tint)",
                    }}
                  >
                    <span style={{ color: "var(--primary)", flex: "none", marginTop: 1 }}>
                      <Icon name={TYPE_ICON[n.type] ?? "bell"} size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 3 }}>{when(n.createdAt)}</div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)} style={{ display: "block" }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
