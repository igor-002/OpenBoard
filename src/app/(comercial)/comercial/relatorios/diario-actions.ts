"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { diaUTC, type Produto } from "@/server/comercial/queries";

export type DiarioActionState = { ok?: boolean; error?: string };

export async function upsertDiario(
  vendedorIxcId: string,
  dataISO: string,
  campos: { leads: number; contatos: number; callsReunioes: number; vendas: number; valorCents: number; observacoes: string; produtos?: Produto[] },
): Promise<DiarioActionState> {
  await requireUser(); // qualquer usuário logado pode apontar
  const data = diaUTC(dataISO);

  // Sanitiza produtos e, se houver, o valor total passa a ser a soma deles (SalesTracker §6).
  const produtos: Produto[] = (campos.produtos ?? [])
    .map((p) => ({ nome: String(p.nome ?? "").trim(), valorCents: Math.max(0, Math.round(Number(p.valorCents) || 0)) }))
    .filter((p) => p.nome.length > 0);
  const valorCents = produtos.length > 0 ? produtos.reduce((a, p) => a + p.valorCents, 0) : campos.valorCents;

  const payload = {
    leads: campos.leads,
    contatos: campos.contatos,
    callsReunioes: campos.callsReunioes,
    vendas: campos.vendas,
    valorCents,
    observacoes: campos.observacoes || null,
    produtos: produtos.length > 0 ? produtos : undefined,
  };

  await db.relatorioDiario.upsert({
    where: { vendedorIxcId_data: { vendedorIxcId, data } },
    create: { vendedorIxcId, data, ...payload },
    update: payload,
  });
  revalidatePath("/comercial/relatorios");
  return { ok: true };
}
