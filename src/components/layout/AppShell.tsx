"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TweaksPanel } from "@/components/tweaks/TweaksPanel";
import { FloatingTimer } from "@/components/time/FloatingTimer";
import { FirstAccessModal } from "@/components/account/FirstAccessModal";
import { ToastHost } from "./ToastHost";
import type { AvatarUser } from "@/lib/types";
import type { NotificationItem } from "@/server/notifications";
import type { ActiveTimer } from "@/server/time";

export function AppShell({
  user,
  workspaceName,
  isAdmin,
  notifications,
  activeTimer,
  mustChangePassword,
  children,
}: {
  user: AvatarUser & { jobTitle: string };
  workspaceName: string;
  isAdmin: boolean;
  notifications: { items: NotificationItem[]; unread: number };
  activeTimer: ActiveTimer | null;
  mustChangePassword: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app" data-side-collapsed={collapsed}>
      <Sidebar user={user} workspaceName={workspaceName} isAdmin={isAdmin} />
      <div className="main">
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} notifications={notifications} />
        <div className="scroll">{children}</div>
      </div>
      <TweaksPanel />
      <FloatingTimer timer={activeTimer} />
      <FirstAccessModal mustChange={mustChangePassword} />
      <ToastHost />
    </div>
  );
}
