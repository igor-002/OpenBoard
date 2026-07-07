// Scheduler in-process do sync Instagram (1 instância só — vide docs/realtime).
// Ligado no boot via src/instrumentation.ts. Métricas do Instagram não mudam
// minuto a minuto, então o intervalo é bem mais folgado que o sync do IXC.
//
// Regras:
//  - Intervalo: MARKETING_SYNC_INTERVAL_MIN (default 360 = 6h, mínimo 60).
//  - Nunca sobrepõe execuções (flag `running`).
//  - Pula o tick se não há nenhuma conta ativa com token (nada a fazer).
//  - Guard global contra registro duplo (HMR do dev re-importa módulos).
import { db } from "@/lib/db";
import { syncInstagramAccounts } from "./instagram-sync";

const KEY = Symbol.for("openboard.marketingSyncScheduler");
type SchedulerState = { running: boolean; timer: ReturnType<typeof setInterval> };

export function startMarketingSyncScheduler(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[KEY]) return; // já rodando (HMR / register repetido)

  const min = Math.max(60, Number(process.env.MARKETING_SYNC_INTERVAL_MIN) || 360);
  const intervalMs = min * 60_000;
  const state: SchedulerState = {
    running: false,
    timer: setInterval(() => void tick(state), intervalMs),
  };
  state.timer.unref?.(); // não segura o processo vivo no shutdown
  g[KEY] = state;

  // Primeiro tick logo após o boot (30s).
  setTimeout(() => void tick(state), 30_000).unref?.();
  console.log(`[marketing-sync-cron] ligado — sync Instagram a cada ${min}min.`);
}

async function tick(state: SchedulerState): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    const hasToken = await db.instagramAccount.findFirst({
      where: { active: true, accessToken: { not: null } },
      select: { id: true },
    });
    if (!hasToken) return;

    const t0 = Date.now();
    const results = await syncInstagramAccounts();
    const erros = results.filter((r) => r.status === "erro").length;
    console.log(
      `[marketing-sync-cron] sync concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s ` +
        `(${results.length} contas, ${erros} erros).`,
    );
  } catch (e) {
    console.error("[marketing-sync-cron] erro inesperado:", (e as Error).message);
  } finally {
    state.running = false;
  }
}
