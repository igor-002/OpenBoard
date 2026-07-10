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
};

export async function getUsers(workspaceId: string): Promise<UserRow[]> {
  return db.user.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, initials: true, color: true, hourlyCostCents: true, modules: true },
  });
}
