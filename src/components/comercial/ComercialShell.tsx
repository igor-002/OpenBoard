"use client";

import { useState } from "react";
import { ComercialSidebar } from "./ComercialSidebar";
import { ComercialTopbar } from "./ComercialTopbar";
import { ToastHost } from "@/components/layout/ToastHost";
import type { AvatarUser } from "@/lib/types";
import type { NotificationItem } from "@/server/notifications";

// Shell do segundo sistema. Mesma casca do AppShell (tema/CSS compartilhado),
// mas com sidebar/topbar do Comercial.
export function ComercialShell({
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
      <ComercialSidebar user={user} />
      <div className="main">
        <ComercialTopbar collapsed={collapsed} setCollapsed={setCollapsed} notifications={notifications} />
        <div className="scroll">{children}</div>
      </div>
      <ToastHost />
    </div>
  );
}
