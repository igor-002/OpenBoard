"use server";

import { revalidatePath } from "next/cache";
import { requireModuleUser } from "@/lib/permissions";
import { isSolicitacaoStatus } from "@/lib/cadastros";
import { changeSolicitacaoStatus } from "@/server/comercial/cadastros";

export type CadastroActionState = { ok?: boolean; error?: string };

// Muda o status da solicitação (Pendente / Cadastrado / Cancelado) com histórico.
export async function changeStatusAction(id: string, status: string): Promise<CadastroActionState> {
  const user = await requireModuleUser("comercial");
  if (!isSolicitacaoStatus(status)) return { error: "Status inválido." };
  await changeSolicitacaoStatus(id, status, user.id);
  revalidatePath("/comercial/cadastros");
  return { ok: true };
}
