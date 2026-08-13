import "server-only";
import { db } from "@/lib/db";
import { chaveCategoria, limparCategoria } from "@/lib/categoria";

// Garante a categoria pelo nome digitado. Reativa quando alguém volta a usar
// uma categoria desativada — se está sendo escolhida de novo, voltou a existir.
export async function ensureProjectCategory(workspaceId: string, name: string) {
  const cleaned = limparCategoria(name);
  const key = chaveCategoria(cleaned);
  return db.projectCategory.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    update: { active: true },
    create: { workspaceId, name: cleaned, key },
  });
}

export type ProjectCategoryRow = {
  id: string;
  name: string;
  active: boolean;
  projectCount: number;
};

// Todas as categorias, inclusive as desativadas — a tela de administração
// precisa delas para reativar. O filtro de projetos usa getProjectCategorias().
export async function listProjectCategories(workspaceId: string): Promise<ProjectCategoryRow[]> {
  const rows = await db.projectCategory.findMany({
    where: { workspaceId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, _count: { select: { projects: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, active: r.active, projectCount: r._count.projects }));
}
