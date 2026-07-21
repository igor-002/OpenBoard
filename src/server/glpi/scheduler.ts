// Scheduler in-process do sync GLPI (1 instância só — vide docs/realtime).
// Ligado no boot via src/instrumentation.ts. Mantém o espelho de chamados fresco.
// Mesmas regras do scheduler IXC (intervalo, anti-overlap, freshness, guard HMR),
// mas com log próprio (GlpiSyncRun) pra não cruzar com o freshness do IXC.
import { db } from "@/lib/db";
import { glpiConfigured } from "@/lib/glpi";
import { runGlpiSync } from "./sync";

const KEY = Symbol.for("openboard.glpiScheduler");
type SchedulerState = { running: boolean; timer: ReturnType<typeof setInterval> };

export function startGlpiSyncScheduler(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[KEY]) return; // já rodando (HMR / register repetido)

  if (!glpiConfigured()) {
    console.log("[glpi-cron] GLPI não configurado — scheduler desligado.");
    return;
  }

  const min = Math.max(5, Number(process.env.GLPI_SYNC_INTERVAL_MIN) || 30);
  const intervalMs = min * 60_000;
  const state: SchedulerState = {
    running: false,
    timer: setInterval(() => void tick(state, intervalMs), intervalMs),
  };
  state.timer.unref?.();
  g[KEY] = state;

  // Primeiro tick logo após o boot (25s — desencontrado do IXC/marketing).
  setTimeout(() => void tick(state, intervalMs), 25_000).unref?.();
  console.log(`[glpi-cron] ligado — sync GLPI a cada ${min}min.`);
}

async function tick(state: SchedulerState, intervalMs: number): Promise<void> {
  if (state.running) return;
  if (!glpiConfigured()) return;
  state.running = true;
  try {
    // Freshness: se um sync GLPI terminou OK dentro do intervalo, não repete.
    const last = await db.glpiSyncRun.findFirst({
      where: { finishedAt: { not: null }, fatalError: null },
      orderBy: { startedAt: "desc" },
      select: { finishedAt: true },
    });
    if (last?.finishedAt && Date.now() - +last.finishedAt < intervalMs - 60_000) return;

    const t0 = Date.now();
    const r = await runGlpiSync("auto");
    if (r.ok) console.log(`[glpi-cron] sync OK em ${((Date.now() - t0) / 1000).toFixed(1)}s (run ${r.runId}).`);
    else console.error(`[glpi-cron] sync falhou: ${r.error}`);
  } catch (e) {
    console.error("[glpi-cron] erro inesperado:", (e as Error).message);
  } finally {
    state.running = false;
  }
}
