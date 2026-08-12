"use client";

import { useState } from "react";
import { ComercialSidebar } from "./ComercialSidebar";
import { ComercialTopbar } from "./ComercialTopbar";
import { ToastHost } from "@/components/layout/ToastHost";
import { DemandAcknowledgementModal } from "@/components/layout/DemandAcknowledgementModal";
import type { AvatarUser } from "@/lib/types";
import type { NotificationItem } from "@/server/notifications";
import type { PendingTaskAcknowledgement } from "@/server/task-acknowledgements";

// Shell do segundo sistema. Mesma casca do AppShell (tema/CSS compartilhado),
// mas com sidebar/topbar do Comercial.
export function ComercialShell({
  user,
  notifications,
  tools,
  pendingAcknowledgements,
  children,
}: {
  user: AvatarUser & { jobTitle: string };
  notifications: { items: NotificationItem[]; unread: number };
  tools: string[];
  pendingAcknowledgements: PendingTaskAcknowledgement[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app" data-side-collapsed={collapsed}>
      <ComercialSidebar user={user} tools={tools} />
      <div className="main">
        <ComercialTopbar collapsed={collapsed} setCollapsed={setCollapsed} notifications={notifications} />
        <div className="scroll">{children}</div>
      </div>
      <ToastHost />
      <DemandAcknowledgementModal key={pendingAcknowledgements.map((item) => item.id).join(",")} initial={pendingAcknowledgements} />
    </div>
  );
}
