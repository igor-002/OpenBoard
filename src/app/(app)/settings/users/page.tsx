import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isModuleManager, isModuleKey } from "@/lib/permissions";
import { getUsers } from "@/server/users";
import { UsersManager } from "@/components/admin/UsersManager";

// Admin faz tudo. Gerente de módulo entra só pra liberar ferramentas dos módulos
// que administra — sem criar usuário, mudar papel nem redefinir senha.
export default async function UsersPage() {
  const eu = await requireUser();
  if (!isModuleManager(eu)) redirect("/dashboard");

  const users = await getUsers(eu.workspaceId);
  const souAdmin = eu.role === "admin";
  return (
    <div className="page">
      <UsersManager
        users={users}
        currentUserId={eu.id}
        isAdmin={souAdmin}
        managedModules={souAdmin ? [] : (eu.manages ?? []).filter(isModuleKey)}
      />
    </div>
  );
}
