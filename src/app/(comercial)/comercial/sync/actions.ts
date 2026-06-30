"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { runFullSync } from "@/server/comercial/sync";

export type SyncState = { ok?: boolean; error?: string; processed?: number };

// Dispara o sync completo IXC → DB local. Só admin (operação pesada/sensível).
export async function runSyncAction(): Promise<SyncState> {
  await requireAdmin();
  const r = await runFullSync();
  // "layout" revalida toda a subtree /comercial/* (contratos, clientes, relatórios,
  // pipeline, etc.), não só a página exata. /dashboard tem o card comercial.
  revalidatePath("/comercial", "layout");
  revalidatePath("/dashboard");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
