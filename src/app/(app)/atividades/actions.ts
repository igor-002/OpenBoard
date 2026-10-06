"use server";

// Busca e cadastro manual de cliente, usados ao vincular uma demanda.
// As ações da demanda em si ficam em ../demandas/actions.ts.
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAnyToolUser, TOOLS_DEMANDA } from "@/lib/permissions";

// ---------- Clientes (busca + cadastro manual) ----------

export type ClienteHit = { id: string; razao: string; cnpjCpf: string | null; ixcId: string | null };

// Busca cliente no espelho local (IXC + manuais) por razão, CNPJ/CPF ou código IXC.
export async function searchClientes(q: string): Promise<ClienteHit[]> {
  await requireAnyToolUser(TOOLS_DEMANDA);
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const hits = await db.ixcCliente.findMany({
    where: {
      OR: [
        { razao: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ cnpjCpf: { contains: digits } }] : []),
        { ixcId: term },
      ],
    },
    take: 10,
    orderBy: { razao: "asc" },
    select: { id: true, razao: true, cnpjCpf: true, ixcId: true },
  });
  return hits;
}

const clienteSchema = z.object({
  razao: z.string().min(2, "Informe o nome/razão social"),
  cnpjCpf: z.string().optional(),
  uf: z.string().max(2).optional(),
});

export type ClienteCreateState = { ok?: boolean; error?: string; cliente?: ClienteHit };

// Cadastra cliente manual (fora do sync IXC — ixcId fica null, manual=true).
export async function createClienteManual(_prev: ClienteCreateState, formData: FormData): Promise<ClienteCreateState> {
  await requireAnyToolUser(TOOLS_DEMANDA);
  const parsed = clienteSchema.safeParse({
    razao: formData.get("razao"),
    cnpjCpf: formData.get("cnpjCpf") || undefined,
    uf: formData.get("uf") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const c = await db.ixcCliente.create({
    data: {
      manual: true,
      razao: parsed.data.razao.trim().slice(0, 200),
      cnpjCpf: parsed.data.cnpjCpf?.trim() || null,
      uf: parsed.data.uf?.trim().toUpperCase() || null,
    },
    select: { id: true, razao: true, cnpjCpf: true, ixcId: true },
  });
  return { ok: true, cliente: c };
}
