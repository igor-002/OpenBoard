import { hasModule } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TOOL_KEYS } from "@/lib/modules";
import { getNotifications } from "@/server/notifications";
import { ComercialShell } from "@/components/comercial/ComercialShell";

// Segundo sistema (Comercial / IXC). Reusa a sessão do OpenBoard. Suporta as
// três áreas que vivem sob /comercial: Comercial, Leads e Margem.
export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!hasModule(user, "comercial") && !hasModule(user, "leads") && !hasModule(user, "margem")) {
    redirect("/sem-acesso");
  }
  const notifications = await getNotifications(user.id);
  return (
    <ComercialShell
      user={{ name: user.name, initials: user.initials, color: user.color, jobTitle: user.jobTitle }}
      notifications={notifications}
      tools={user.role === "admin" ? TOOL_KEYS : user.tools}
    >
      {children}
    </ComercialShell>
  );
}
