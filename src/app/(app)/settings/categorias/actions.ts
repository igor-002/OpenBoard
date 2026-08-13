"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { chaveCategoria, limparCategoria } from "@/lib/categoria";

export type CategoryActionState = { ok?: boolean; error?: string };

function revalidate() {
  revalidatePath("/settings/categorias");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

// Cria uma categoria sem depender de um projeto — é assim que se prepara o
// catálogo que a integração do Ploomes consulta antes de existir projeto algum.
export async function createProjectCategory(_prev: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  const admin = await requireAdmin();
  const name = limparCategoria(String(formData.get("name") ?? ""));
  if (name.length < 2) return { error: "Informe um nome com ao menos 2 caracteres." };

  const key = chaveCategoria(name);
  const existing = await db.projectCategory.findUnique({
    where: { workspaceId_key: { workspaceId: admin.workspaceId, key } },
    select: { id: true, active: true },
  });
  if (existing?.active) return { error: "Já existe uma categoria com esse nome." };
  if (existing) {
    // Mesma chave, mas desativada: reativa com a grafia nova em vez de barrar.
    await db.projectCategory.update({ where: { id: existing.id }, data: { active: true, name } });
  } else {
    await db.projectCategory.create({ data: { workspaceId: admin.workspaceId, name, key } });
  }
  revalidate();
  return { ok: true };
}

// Liga/desliga a categoria. Desativada, some do filtro de projetos e da API de
// opções; os projetos que já usam continuam intactos.
export async function setProjectCategoryActive(id: string, active: boolean): Promise<CategoryActionState> {
  const admin = await requireAdmin();
  const target = await db.projectCategory.findFirst({
    where: { id, workspaceId: admin.workspaceId },
    select: { id: true },
  });
  if (!target) return { error: "Categoria não encontrada." };

  await db.projectCategory.update({ where: { id }, data: { active } });
  revalidate();
  return { ok: true };
}

// Renomeia. A chave acompanha, então "Hotspot" e "hotspot" seguem sendo a mesma
// categoria — o que impede duplicata no filtro.
export async function renameProjectCategory(id: string, name: string): Promise<CategoryActionState> {
  const admin = await requireAdmin();
  const cleaned = limparCategoria(name);
  if (cleaned.length < 2) return { error: "Informe um nome com ao menos 2 caracteres." };

  const target = await db.projectCategory.findFirst({
    where: { id, workspaceId: admin.workspaceId },
    select: { id: true },
  });
  if (!target) return { error: "Categoria não encontrada." };

  const key = chaveCategoria(cleaned);
  const clash = await db.projectCategory.findUnique({
    where: { workspaceId_key: { workspaceId: admin.workspaceId, key } },
    select: { id: true },
  });
  if (clash && clash.id !== id) return { error: "Já existe uma categoria com esse nome." };

  // `Project.tag` acompanha: o filtro da lista de projetos agrupa por esse
  // texto, então deixá-lo com o nome antigo partiria a categoria em duas.
  await db.$transaction([
    db.projectCategory.update({ where: { id }, data: { name: cleaned, key } }),
    db.project.updateMany({ where: { categoryId: id }, data: { tag: cleaned } }),
  ]);
  revalidate();
  return { ok: true };
}
