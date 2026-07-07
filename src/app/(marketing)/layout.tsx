import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/server/notifications";
import { MarketingShell } from "@/components/marketing/MarketingShell";

// Terceiro sistema (Marketing). Reusa a sessão do OpenBoard — mesmos
// usuários. Sem RBAC — qualquer usuário logado entra e edita tudo.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);
  return (
    <MarketingShell
      user={{ name: user.name, initials: user.initials, color: user.color, jobTitle: user.jobTitle }}
      notifications={notifications}
    >
      {children}
    </MarketingShell>
  );
}
