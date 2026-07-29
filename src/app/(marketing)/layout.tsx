import { requireModule } from "@/lib/permissions";
import { TOOL_KEYS } from "@/lib/modules";
import { getNotifications } from "@/server/notifications";
import { MarketingShell } from "@/components/marketing/MarketingShell";

// Terceiro sistema (Marketing). Reusa a sessão do OpenBoard. Acesso exige o
// módulo "marketing" (admin sempre). Ações também revalidam a permissão.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("marketing");
  const notifications = await getNotifications(user.id);
  return (
    <MarketingShell
      user={{ name: user.name, initials: user.initials, color: user.color, jobTitle: user.jobTitle }}
      notifications={notifications}
      tools={user.role === "admin" ? TOOL_KEYS : user.tools}
    >
      {children}
    </MarketingShell>
  );
}
