import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { glpiConfigured } from "@/lib/glpi";
import { v1ListCategories } from "@/lib/glpi-v1";
import { getAssignableUsers } from "@/server/glpi/users";
import { listarRegras } from "@/server/glpi/regras";
import { GlpiRegrasManager } from "@/components/admin/GlpiRegrasManager";

// Regras de envio de demanda pro GLPI do Marketing: quando abrir chamado e com
// quais parâmetros. As listas de técnico/requerente/categoria vêm do GLPI ao vivo.
export const dynamic = "force-dynamic";

export default async function GlpiRegrasPage() {
  const admin = await requireAdmin();
  const ligado = glpiConfigured();
  const [regras, tipos, usuarios, usuariosGlpi, categorias] = await Promise.all([
    listarRegras(admin.workspaceId),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId: admin.workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ligado ? getAssignableUsers() : [],
    ligado ? v1ListCategories() : [],
  ]);

  return (
    <div className="page">
      <GlpiRegrasManager
        ligado={ligado}
        regras={regras}
        tipos={tipos}
        usuarios={usuarios}
        usuariosGlpi={usuariosGlpi}
        categorias={categorias.map((c) => ({ id: c.id, name: c.nome }))}
      />
    </div>
  );
}
