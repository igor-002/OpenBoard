"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { runGlpiSync } from "@/server/glpi/sync";

export type GlpiSyncState = { ok?: boolean; error?: string };

// Dispara o sync GLPI → espelho local. Só admin (bate na API externa).
export async function runGlpiSyncAction(): Promise<GlpiSyncState> {
  await requireAdmin();
  const r = await runGlpiSync("manual");
  revalidatePath("/marketing/demandas");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
