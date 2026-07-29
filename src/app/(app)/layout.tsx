import { requireUser } from "@/lib/auth";
import { TOOL_KEYS } from "@/lib/modules";
import { getNotifications } from "@/server/notifications";
import { getActiveTimer } from "@/server/time";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, activeTimer] = await Promise.all([
    getNotifications(user.id),
    getActiveTimer(user.id),
  ]);
  return (
    <AppShell
      user={{ name: user.name, initials: user.initials, color: user.color, jobTitle: user.jobTitle }}
      workspaceName={user.workspace.name}
      isAdmin={user.role === "admin"}
      notifications={notifications}
      tools={user.role === "admin" ? TOOL_KEYS : user.tools}
      activeTimer={activeTimer}
      mustChangePassword={user.mustChangePassword}
    >
      {children}
    </AppShell>
  );
}
