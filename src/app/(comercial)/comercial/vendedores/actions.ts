"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncVendedores } from "@/server/comercial/sync";

export type VendedorActionState = { ok?: boolean; error?: string };

// Liga/desliga "Ativo no CRM".
export async function setVendedorAtivo(id: string, ativo: boolean): Promise<VendedorActionState> {
  await requireAdmin();
  // Desativar tira também do histórico (não faz sentido puxar sem estar ativo).
  await db.vendedor.update({
    where: { id },
    data: ativo ? { ativo: true } : { ativo: false, incluirHistorico: false },
  });
  revalidatePath("/comercial/vendedores");
  return { ok: true };
}

// Liga/desliga "Histórico" (gate do sync de contratos).
export async function setVendedorHistorico(id: string, incluir: boolean): Promise<VendedorActionState> {
  await requireAdmin();
  await db.vendedor.update({ where: { id }, data: { incluirHistorico: incluir } });
  revalidatePath("/comercial/vendedores");
  return { ok: true };
}

// Vincula (ou desvincula) um vendedor a um User do OpenBoard (A1). userId vazio = desvincula.
export async function setVendedorUser(id: string, userId: string | null): Promise<VendedorActionState> {
  await requireAdmin();
  await db.vendedor.update({ where: { id }, data: { userId: userId || null } });
  revalidatePath("/comercial/vendedores");
  return { ok: true };
}

// normaliza nome (sem acento, minúsculo, espaços colapsados) pra casar Vendedor↔User.
function normNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Auto-vincula vendedores sem User por igualdade de nome normalizado. Retorna nº de vínculos feitos.
export async function autoVincularVendedores(): Promise<VendedorActionState & { vinculados?: number }> {
  // Isolamento de tenant: usa sempre o workspace do admin logado (nunca um id do cliente).
  const admin = await requireAdmin();
  const [vendedores, users] = await Promise.all([
    db.vendedor.findMany({ where: { userId: null }, select: { id: true, nome: true } }),
    db.user.findMany({ where: { workspaceId: admin.workspaceId }, select: { id: true, name: true } }),
  ]);
  const userByNome = new Map(users.map((u) => [normNome(u.name), u.id]));
  let vinculados = 0;
  for (const v of vendedores) {
    const uid = userByNome.get(normNome(v.nome));
    if (uid) {
      await db.vendedor.update({ where: { id: v.id }, data: { userId: uid } });
      vinculados++;
    }
  }
  revalidatePath("/comercial/vendedores");
  return { ok: true, vinculados };
}

// Puxa a lista de vendedores do IXC (insere novos / atualiza nomes).
export async function syncVendedoresAction(): Promise<VendedorActionState & { total?: number }> {
  await requireAdmin();
  try {
    const total = await syncVendedores();
    revalidatePath("/comercial/vendedores");
    return { ok: true, total };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
