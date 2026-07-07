"use client";

import { useState } from "react";
import { MarketingSidebar } from "./MarketingSidebar";
import { MarketingTopbar } from "./MarketingTopbar";
import { ToastHost } from "@/components/layout/ToastHost";
import type { AvatarUser } from "@/lib/types";
import type { NotificationItem } from "@/server/notifications";

// Shell do módulo Marketing. Mesma casca do AppShell (tema/CSS compartilhado),
// mas com sidebar/topbar do Marketing.
export function MarketingShell({
  user,
  notifications,
  children,
}: {
  user: AvatarUser & { jobTitle: string };
  notifications: { items: NotificationItem[]; unread: number };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app" data-side-collapsed={collapsed}>
      <MarketingSidebar user={user} />
      <div className="main">
        <MarketingTopbar collapsed={collapsed} setCollapsed={setCollapsed} notifications={notifications} />
        <div className="scroll">{children}</div>
      </div>
      <ToastHost />
    </div>
  );
}
