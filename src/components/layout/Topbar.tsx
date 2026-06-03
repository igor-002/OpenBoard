"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { crumbFor } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { logoutAction } from "@/app/(auth)/actions";
import type { NotificationItem } from "@/server/notifications";

export function Topbar({
  collapsed,
  setCollapsed,
  notifications,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  notifications: { items: NotificationItem[]; unread: number };
}) {
  const pathname = usePathname();
  const { a, b } = crumbFor(pathname);
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title="Recolher menu">
        <Icon name="sidebar" size={18} />
      </button>
      <div className="crumbs">
        {a} <Icon name="chevRight" size={14} /> <b>{b}</b>
      </div>
      <div style={{ flex: 1 }} />
      {/* busca oculta por enquanto */}
      <NotificationBell items={notifications.items} unread={notifications.unread} />
      <form action={logoutAction}>
        <button className="icon-btn" title="Sair" type="submit">
          <Icon name="logout" size={18} />
        </button>
      </form>
    </header>
  );
}
