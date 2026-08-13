import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/lib/types";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string;
  initials: string;
  color: string;
  hourlyCostCents: number;
  modules: string[];
  tools: string[];
  manages: string[];
  active: boolean;
};

// Só quem tem acesso: é isso que alimenta selects de responsável, equipe de
// projeto e afins. Para a tela de administração, use getAllUsers().
export async function getUsers(workspaceId: string): Promise<UserRow[]> {
  return db.user.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, initials: true, color: true, hourlyCostCents: true, modules: true, tools: true, manages: true, active: true },
  });
}

// Inclui os desativados — a tela de usuários precisa deles para reativar.
export async function getAllUsers(workspaceId: string): Promise<UserRow[]> {
  return db.user.findMany({
    where: { workspaceId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, jobTitle: true, initials: true, color: true, hourlyCostCents: true, modules: true, tools: true, manages: true, active: true },
  });
}
