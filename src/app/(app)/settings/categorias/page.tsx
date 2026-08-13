import { requireAdmin } from "@/lib/auth";
import { listProjectCategories } from "@/server/project-categories";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

// Catálogo de categorias de projeto. Mesma lista que a integração do Ploomes
// consulta em /api/v1/integrations/options/project-categories.
export default async function CategoriasPage() {
  const admin = await requireAdmin();
  const categorias = await listProjectCategories(admin.workspaceId);

  return (
    <div className="page">
      <CategoriesManager categorias={categorias} />
    </div>
  );
}
