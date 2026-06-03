import { requireAdmin } from "@/lib/auth";
import { getUsers } from "@/server/users";
import { UsersManager } from "@/components/admin/UsersManager";

export default async function UsersPage() {
  const admin = await requireAdmin(); // redireciona não-admins pro dashboard
  const users = await getUsers(admin.workspaceId);
  return (
    <div className="page">
      <UsersManager users={users} currentUserId={admin.id} />
    </div>
  );
}
