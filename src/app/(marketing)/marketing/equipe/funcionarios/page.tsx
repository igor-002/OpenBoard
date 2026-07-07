import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUsers } from "@/server/users";
import { EmployeesManager } from "@/components/marketing/EmployeesManager";

export default async function FuncionariosPage() {
  const user = await requireUser();
  const [employees, users] = await Promise.all([
    db.employee.findMany({ orderBy: { name: "asc" } }),
    getUsers(user.workspaceId),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="page-sub">Time de marketing — vincule opcionalmente a um usuário do OpenBoard.</p>
        </div>
      </div>
      <EmployeesManager
        employees={employees.map((e) => ({ id: e.id, name: e.name, role: e.role, avatarColor: e.avatarColor, userId: e.userId }))}
        userOpts={users.map((u) => ({ id: u.id, name: u.name }))}
      />
    </div>
  );
}
