// Boot do servidor (convenção instrumentation.ts do Next). Liga o cron de sync
// IXC que mantém o espelho local — e os painéis — sempre atualizados.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncScheduler } = await import("@/server/comercial/scheduler");
    startSyncScheduler();
  }
}
