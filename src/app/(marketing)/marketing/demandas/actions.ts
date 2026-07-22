"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requireModuleUser } from "@/lib/permissions";
import { runGlpiSync } from "@/server/glpi/sync";
import { addFollowup, createTicket, updateStatus, setAssignee, removeAssignee, type CreateTicketInput } from "@/server/glpi/write";

export type GlpiSyncState = { ok?: boolean; error?: string };

// Dispara o sync GLPI → espelho local. Só admin (bate na API externa).
export async function runGlpiSyncAction(): Promise<GlpiSyncState> {
  await requireAdmin();
  const r = await runGlpiSync("manual");
  revalidatePath("/marketing/demandas");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}

// ── Escrita (fase 2) ─────────────────────────────────────────────────────────
// Qualquer usuário do módulo Marketing pode escrever. Revalida a lista e o detalhe.
export type WriteState = { ok: boolean; error?: string; id?: number };

function revalidate(glpiId?: number) {
  revalidatePath("/marketing/demandas");
  revalidatePath("/marketing/equipe");
  if (glpiId) revalidatePath(`/marketing/demandas/${glpiId}`);
}

function fail(e: unknown): WriteState {
  return { ok: false, error: (e as Error).message || "Falha na operação." };
}

export async function addFollowupAction(glpiId: number, content: string, isPrivate: boolean): Promise<WriteState> {
  await requireModuleUser("marketing");
  try {
    await addFollowup(glpiId, content, isPrivate);
    revalidate(glpiId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createDemandaAction(input: CreateTicketInput): Promise<WriteState> {
  await requireModuleUser("marketing");
  try {
    const id = await createTicket(input);
    revalidate(id ?? undefined);
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStatusAction(glpiId: number, statusId: number): Promise<WriteState> {
  await requireModuleUser("marketing");
  try {
    await updateStatus(glpiId, statusId);
    revalidate(glpiId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function assignAction(glpiId: number, userId: number): Promise<WriteState> {
  await requireModuleUser("marketing");
  try {
    await setAssignee(glpiId, userId);
    revalidate(glpiId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function unassignAction(glpiId: number, userId: number): Promise<WriteState> {
  await requireModuleUser("marketing");
  try {
    await removeAssignee(glpiId, userId);
    revalidate(glpiId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
