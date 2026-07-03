// Scheduler in-process do sync IXC (1 instância só — vide docs/realtime).
// Ligado no boot via src/instrumentation.ts. Mantém o espelho local (e portanto
// dashboards/TV) sempre fresco sem depender de clique manual.
//
// Regras:
//  - Intervalo: SYNC_INTERVAL_MIN (default 30, mínimo 5).
//  - Nunca sobrepõe execuções (flag `running`).
//  - Pula o tick se um sync (manual ou auto) terminou OK há menos de um intervalo.
//  - Guard global contra registro duplo (HMR do dev re-importa módulos).
import { db } from "@/lib/db";
import { ixcConfigured } from "@/lib/ixc";
import { runFullSync } from "./sync";

const KEY = Symbol.for("openboard.syncScheduler");
type SchedulerState = { running: boolean; timer: ReturnType<typeof setInterval> };

export function startSyncScheduler(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[KEY]) return; // já rodando (HMR / register repetido)

  if (!ixcConfigured()) {
    console.log("[sync-cron] IXC não configurado — scheduler desligado.");
    return;
  }

  const min = Math.max(5, Number(process.env.SYNC_INTERVAL_MIN) || 30);
  const intervalMs = min * 60_000;
  const state: SchedulerState = {
    running: false,
    timer: setInterval(() => void tick(state, intervalMs), intervalMs),
  };
  state.timer.unref?.(); // não segura o processo vivo no shutdown
  g[KEY] = state;

  // Primeiro tick logo após o boot (20s) — o freshness guard evita re-sync
  // desnecessário quando o servidor reinicia com dado recente.
  setTimeout(() => void tick(state, intervalMs), 20_000).unref?.();
  console.log(`[sync-cron] ligado — sync IXC a cada ${min}min.`);
}

async function tick(state: SchedulerState, intervalMs: number): Promise<void> {
  if (state.running) return;
  if (!ixcConfigured()) return;
  state.running = true;
  try {
    // Freshness: se qualquer sync terminou OK dentro do intervalo, não repete
    // (conta sync manual — evita rodar dobrado logo depois de um clique).
    const last = await db.syncRun.findFirst({
      where: { finishedAt: { not: null }, fatalError: null },
      orderBy: { startedAt: "desc" },
      select: { finishedAt: true },
    });
    if (last?.finishedAt && Date.now() - +last.finishedAt < intervalMs - 60_000) return;

    const t0 = Date.now();
    const r = await runFullSync("auto");
    if (r.ok) console.log(`[sync-cron] sync OK em ${((Date.now() - t0) / 1000).toFixed(1)}s (run ${r.runId}).`);
    else console.error(`[sync-cron] sync falhou: ${r.error}`);
  } catch (e) {
    console.error("[sync-cron] erro inesperado:", (e as Error).message);
  } finally {
    state.running = false;
  }
}
