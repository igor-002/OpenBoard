// Alertas proativos → viram Notification (sininho). Rodados por scheduler
// in-process (1 instância só — mesmo modelo do sync IXC). Cada alerta deduplica
// pela própria tabela Notification (mesmo type+link dentro da janela), então o
// tick pode rodar à vontade sem spammar ninguém.
import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/server/notifications";

const DAY = 86400000;
const JANELA_DEDUP_DIAS = 7; // não repete o mesmo alerta dentro desta janela

const LEAD_ATIVOS = ["contato", "proposta"];

// Já existe notificação equivalente recente? (dedup por type+link)
async function jaAlertado(type: string, link: string): Promise<boolean> {
  const n = await db.notification.findFirst({
    where: { type, link, createdAt: { gte: new Date(Date.now() - JANELA_DEDUP_DIAS * DAY) } },
    select: { id: true },
  });
  return !!n;
}

async function adminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
  return admins.map((a) => a.id);
}

// ── Leads parados: ativo há +7d sem contato E sem mudar de fila ──────────────
export async function alertLeadsParados(): Promise<number> {
  const limite = new Date(Date.now() - 7 * DAY);
  const leads = await db.lead.findMany({
    where: { stage: { in: LEAD_ATIVOS }, lastContactAt: { lt: limite }, stageChangedAt: { lt: limite } },
    select: { id: true, nome: true, empresa: true, stage: true, assignedUserId: true, valorEstimadoCents: true },
  });
  if (!leads.length) return 0;
  const admins = await adminIds();
  let criados = 0;
  for (const l of leads) {
    const link = `/comercial/leads/${l.id}`;
    if (await jaAlertado("lead_stale", link)) continue;
    await notify([l.assignedUserId, ...admins], {
      type: "lead_stale",
      title: `Lead parado: ${l.nome}`,
      body: `${l.empresa ? `${l.empresa} — ` : ""}há mais de 7 dias sem contato na fila "${l.stage}".`,
      link,
    });
    criados++;
  }
  return criados;
}

// ── Projetos estourando: prazo em até 7d (ou vencido) com tarefas pendentes ──
export async function alertProjetosPrazo(): Promise<number> {
  const horizonte = new Date(Date.now() + 7 * DAY);
  const projetos = await db.project.findMany({
    where: { status: { notIn: ["done"] }, dueDate: { not: null, lte: horizonte } },
    select: {
      id: true, name: true, dueDate: true, creatorId: true,
      tasks: { select: { column: true } },
      members: { select: { userId: true, isLead: true } },
    },
  });
  let criados = 0;
  for (const p of projetos) {
    const restantes = p.tasks.filter((t) => t.column !== "done").length;
    if (restantes === 0) continue; // sem pendência, sem alerta
    const link = `/projects/${p.id}`;
    if (await jaAlertado("project_deadline", link)) continue;
    const vencido = p.dueDate! < new Date();
    const dias = Math.abs(Math.round((+p.dueDate! - Date.now()) / DAY));
    const destinatarios = [
      p.creatorId,
      ...p.members.filter((m) => m.isLead).map((m) => m.userId),
      ...(await adminIds()),
    ];
    await notify(destinatarios, {
      type: "project_deadline",
      title: vencido ? `Prazo estourado: ${p.name}` : `Prazo em ${dias}d: ${p.name}`,
      body: `${restantes} tarefa${restantes > 1 ? "s" : ""} pendente${restantes > 1 ? "s" : ""}${vencido ? ` — venceu há ${dias} dia${dias > 1 ? "s" : ""}` : ""}.`,
      link,
    });
    criados++;
  }
  return criados;
}

// Orquestra os checks (chamado pelo scheduler; erros não derrubam o tick).
export async function runAlertsCheck(): Promise<void> {
  try {
    const [leads, projetos] = await Promise.all([alertLeadsParados(), alertProjetosPrazo()]);
    if (leads + projetos > 0) console.log(`[alerts] ${leads} lead(s) parado(s), ${projetos} projeto(s) com prazo em risco.`);
  } catch (e) {
    console.error("[alerts] erro no check:", (e as Error).message);
  }
}

// Scheduler: 1º check 60s após o boot, depois a cada 6h (dedup segura repetição).
const KEY = Symbol.for("openboard.alertsScheduler");
export function startAlertsScheduler(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (g[KEY]) return; // HMR / register repetido
  const timer = setInterval(() => void runAlertsCheck(), 6 * 3600_000);
  timer.unref?.();
  g[KEY] = timer;
  setTimeout(() => void runAlertsCheck(), 60_000).unref?.();
  console.log("[alerts] ligado — check de leads parados e prazos a cada 6h.");
}
