"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { runFullSync } from "@/server/comercial/sync";

export type SyncState = { ok?: boolean; error?: string; processed?: number };

// Dispara o sync completo IXC → DB local. Só admin (operação pesada/sensível).
export async function runSyncAction(): Promise<SyncState> {
  await requireAdmin();
  const r = await runFullSync();
  revalidatePath("/comercial");
  revalidatePath("/comercial/sync");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
