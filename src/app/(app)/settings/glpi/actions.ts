"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type RegraActionState = { ok?: boolean; error?: string };

const idGlpi = z.coerce.number().int().min(1).nullable();

const regraSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Dê um nome à regra.").max(80),
  active: z.boolean(),
  tipoId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  glpiAssigneeId: idGlpi,
  glpiRequesterId: idGlpi,
  glpiCategoryId: idGlpi,
  glpiType: z.coerce.number().int().min(1).max(2),
  fecharJunto: z.boolean(),
});
export type RegraInput = z.input<typeof regraSchema>;

function revalidate() {
  revalidatePath("/settings/glpi");
  revalidatePath("/atividades");
  revalidatePath("/kanban");
}

// Cria ou atualiza uma regra de chamado. Os ids do GLPI (técnico, requerente,
// categoria) não são conferidos aqui — quem confere é a abertura do chamado, que
// fala com o GLPI de verdade e devolve o erro dele.
export async function salvarRegra(input: RegraInput): Promise<RegraActionState> {
  const admin = await requireAdmin();
  const parsed = regraSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...d } = parsed.data;
  const ws = admin.workspaceId;

  if (d.tipoId && !(await db.taskType.findFirst({ where: { id: d.tipoId }, select: { id: true } }))) {
    return { error: "Tipo de demanda inválido." };
  }
  if (d.assigneeId && !(await db.user.findFirst({ where: { id: d.assigneeId, workspaceId: ws }, select: { id: true } }))) {
    return { error: "Responsável inválido." };
  }

  if (id) {
    const r = await db.glpiRegra.updateMany({ where: { id, workspaceId: ws }, data: d });
    if (r.count === 0) return { error: "Regra não encontrada." };
  } else {
    await db.glpiRegra.create({ data: { ...d, workspaceId: ws } });
  }
  revalidate();
  return { ok: true };
}

// Apaga a regra. Chamados já abertos por ela seguem vinculados às demandas.
export async function excluirRegra(id: string): Promise<RegraActionState> {
  const admin = await requireAdmin();
  const r = await db.glpiRegra.deleteMany({ where: { id, workspaceId: admin.workspaceId } });
  if (r.count === 0) return { error: "Regra não encontrada." };
  revalidate();
  return { ok: true };
}
