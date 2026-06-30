import { requireUser } from "@/lib/auth";
import { getLeadsBoard } from "@/server/comercial/leads";
import { getUsers } from "@/server/users";
import { LeadsBoard } from "@/components/comercial/LeadsBoard";

export default async function LeadsPage() {
  const user = await requireUser();
  const [board, users] = await Promise.all([getLeadsBoard(), getUsers(user.workspaceId)]);
  return (
    <div className="page">
      <LeadsBoard board={board} userOpts={users.map((u) => ({ id: u.id, name: u.name }))} isAdmin={user.role === "admin"} />
    </div>
  );
}
