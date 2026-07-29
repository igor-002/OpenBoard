import { requireTool } from "@/lib/permissions";
import { getVendedoresCRM } from "@/server/comercial/queries";
import { getUsers } from "@/server/users";
import { VendedoresManager } from "@/components/comercial/VendedoresManager";

export default async function VendedoresPage() {
  const user = await requireTool("comercial.vendedores");
  const [rows, users] = await Promise.all([getVendedoresCRM(), getUsers(user.workspaceId)]);
  const userOpts = users.map((u) => ({ id: u.id, name: u.name }));
  return <VendedoresManager rows={rows} userOpts={userOpts} workspaceId={user.workspaceId} isAdmin={user.role === "admin"} />;
}
