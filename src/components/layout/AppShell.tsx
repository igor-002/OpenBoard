"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FloatingTimer } from "@/components/time/FloatingTimer";
import { FirstAccessModal } from "@/components/account/FirstAccessModal";
import { ToastHost } from "./ToastHost";
import { CommandPalette } from "./CommandPalette";
import { DemandAcknowledgementModal } from "./DemandAcknowledgementModal";
import { PainelDemanda } from "@/components/demanda/PainelDemanda";
import type { AvatarUser } from "@/lib/types";
import type { NotificationItem } from "@/server/notifications";
import type { ActiveTimer } from "@/server/time";
import type { PendingTaskAcknowledgement } from "@/server/task-acknowledgements";

export function AppShell({
  user,
  workspaceName,
  isAdmin,
  notifications,
  activeTimer,
  mustChangePassword,
  tools,
  pendingAcknowledgements,
  children,
}: {
  user: AvatarUser & { id: string; jobTitle: string };
  workspaceName: string;
  isAdmin: boolean;
  notifications: { items: NotificationItem[]; unread: number };
  activeTimer: ActiveTimer | null;
  mustChangePassword: boolean;
  tools: string[];
  pendingAcknowledgements: PendingTaskAcknowledgement[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app" data-skin="ob2" data-side-collapsed={collapsed}>
      <Sidebar user={user} workspaceName={workspaceName} isAdmin={isAdmin} tools={tools} />
      <div className="main">
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} notifications={notifications} tools={tools} />
        <div className="scroll">{children}</div>
      </div>
      <FloatingTimer timer={activeTimer} />
      <FirstAccessModal mustChange={mustChangePassword} />
      <ToastHost />
      <CommandPalette />
      {/* Lê ?d= da URL — useSearchParams pede um limite de Suspense. */}
      <Suspense fallback={null}>
        <PainelDemanda meId={user.id} isAdmin={isAdmin} />
      </Suspense>
      <DemandAcknowledgementModal key={pendingAcknowledgements.map((item) => item.id).join(",")} initial={pendingAcknowledgements} />
    </div>
  );
}
