"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export type MetaActionState = { ok?: boolean; error?: string };

// Meta do time (mês/ano).
export async function upsertMetaTime(
  mes: number,
  ano: number,
  metaContratos: number,
  metaMrrCents: number,
): Promise<MetaActionState> {
  await requireAdmin();
  await db.meta.upsert({
    where: { mes_ano: { mes, ano } },
    create: { mes, ano, metaContratos, metaMrrCents },
    update: { metaContratos, metaMrrCents },
  });
  revalidatePath("/comercial/mrr");
  revalidatePath("/comercial/relatorios");
  revalidatePath("/comercial");
  return { ok: true };
}

// Meta de um vendedor (mês/ano).
export async function upsertMetaVendedor(
  vendedorIxcId: string,
  mes: number,
  ano: number,
  metaContratos: number,
): Promise<MetaActionState> {
  await requireAdmin();
  await db.metaVendedor.upsert({
    where: { vendedorIxcId_mes_ano: { vendedorIxcId, mes, ano } },
    create: { vendedorIxcId, mes, ano, metaContratos },
    update: { metaContratos },
  });
  revalidatePath("/comercial/mrr");
  revalidatePath("/comercial/relatorios");
  return { ok: true };
}
