import { requireModule } from "@/lib/permissions";
import { getNotifications } from "@/server/notifications";
import { ComercialShell } from "@/components/comercial/ComercialShell";

// Segundo sistema (Comercial / IXC). Reusa a sessão do OpenBoard. Acesso exige o
// módulo "comercial" (admin sempre); Leads e Margem têm gate extra nas próprias páginas.
export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("comercial");
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
