"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { comercialCrumbFor } from "./nav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { logoutAction } from "@/app/(auth)/actions";
import type { NotificationItem } from "@/server/notifications";

export function ComercialTopbar({
  collapsed,
  setCollapsed,
  notifications,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  notifications: { items: NotificationItem[]; unread: number };
}) {
  const pathname = usePathname();
  const { a, b } = comercialCrumbFor(pathname);
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title="Recolher menu">
        <Icon name="sidebar" size={18} />
      </button>
      <div className="crumbs">
        {a} <Icon name="chevRight" size={14} /> <b>{b}</b>
      </div>
      <div style={{ flex: 1 }} />
      <NotificationBell items={notifications.items} unread={notifications.unread} />
      <form action={logoutAction}>
        <button className="icon-btn" title="Sair" type="submit">
          <Icon name="logout" size={18} />
        </button>
      </form>
    </header>
  );
}
