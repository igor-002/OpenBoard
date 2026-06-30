import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/server/notifications";
import { ComercialShell } from "@/components/comercial/ComercialShell";

// Segundo sistema (Comercial / IXC). Reusa a sessão do OpenBoard — mesmos
// usuários. Por ora qualquer usuário logado entra; papéis vêm depois.
export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);
  return (
    <ComercialShell
      user={{ name: user.name, initials: user.initials, color: user.color, jobTitle: user.jobTitle }}
      notifications={notifications}
    >
      {children}
    </ComercialShell>
  );
}
