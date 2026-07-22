// Sync GLPI → espelho local (GlpiTicket). Read-only. Puxa os chamados cujo autor
// (user_recipient) é um dos usuários rastreados e faz upsert por glpiId.
//
// Filtro RSQL: user_recipient.id=in=(40,41,43,60) — campo escalar filtrável (o
// `team`/assignee NÃO é filtrável via RSQL, por isso ancoramos no autor). ~229
// chamados hoje → fetch completo a cada sync (barato).
import { db } from "@/lib/db";
import { glpiGetOne, glpiGetAll, glpiDate, glpiConfigured, TRACKED_USER_IDS } from "@/lib/glpi";

// Campos pedidos ao GLPI (evita despejar o objeto inteiro — doc §3).
const FIELDS =
  "id,name,status,type,urgency,impact,priority,entity,category,location,request_type,user_recipient,team,date_creation,date_mod,date_solve,date_close,resolution_duration,close_duration,waiting_duration,is_deleted";

type Ref = { id: number; name: string } | null;
type TeamMember = { id: number; name: string; realname?: string; firstname?: string; display_name?: string; role: string };
type GlpiTicketRaw = {
  id: number;
  name: string;
  status?: Ref;
  type?: number;
  urgency?: number;
  impact?: number;
  priority?: number;
  entity?: { id: number; name: string; completename?: string } | null;
  category?: Ref;
  location?: Ref;
  request_type?: Ref;
  user_recipient?: Ref;
  team?: TeamMember[];
  date_creation?: string;
  date_mod?: string;
  date_solve?: string | null;
  date_close?: string | null;
  resolution_duration?: number;
  close_duration?: number;
  waiting_duration?: number;
  is_deleted?: boolean;
};

type GlpiUserRaw = { id: number; username?: string; firstname?: string; realname?: string };

// Resolve id → nome de exibição dos usuários rastreados (o user_recipient só traz
// o login). Um GET por usuário; falha individual não aborta.
async function resolveTrackedUsers(): Promise<Map<number, { login: string; name: string }>> {
  const map = new Map<number, { login: string; name: string }>();
  for (const id of TRACKED_USER_IDS) {
    try {
      const u = await glpiGetOne<GlpiUserRaw>(`/Administration/User/${id}`, "id,username,firstname,realname");
      if (u) {
        const name = [u.firstname, u.realname].filter(Boolean).join(" ").trim() || u.username || String(id);
        map.set(id, { login: u.username ?? String(id), name });
      }
    } catch {
      // segue sem esse usuário resolvido (usa login/id como fallback no upsert)
    }
  }
  return map;
}

// Mapeia o ticket cru do GLPI → colunas do GlpiTicket (mesma forma no sync completo
// e no syncOneTicket pós-escrita).
function buildTicketData(t: GlpiTicketRaw, users: Map<number, { login: string; name: string }>) {
  const reqId = t.user_recipient?.id ?? 0;
  const resolved = users.get(reqId);
  const requesterLogin = t.user_recipient?.name ?? resolved?.login ?? "";
  const requesterName = resolved?.name ?? requesterLogin;
  const assignees = (t.team ?? [])
    .filter((m) => m.role === "assigned")
    .map((m) => m.display_name || m.name)
    .join(", ");
  return {
    name: t.name ?? "",
    statusId: t.status?.id ?? 0,
    statusName: t.status?.name ?? "",
    typeId: t.type ?? 0,
    urgency: t.urgency ?? 0,
    impact: t.impact ?? 0,
    priority: t.priority ?? 0,
    requesterId: reqId,
    requesterLogin,
    requesterName,
    assignees,
    entityName: t.entity?.name ?? "",
    requestType: t.request_type?.name ?? "",
    categoryName: t.category?.name ?? null,
    locationName: t.location?.name ?? null,
    dateCreation: glpiDate(t.date_creation) ?? new Date(0),
    dateMod: glpiDate(t.date_mod),
    dateSolve: glpiDate(t.date_solve),
    dateClose: glpiDate(t.date_close),
    resolutionDuration: t.resolution_duration ?? null,
    closeDuration: t.close_duration ?? null,
    waitingDuration: t.waiting_duration ?? null,
    isDeleted: Boolean(t.is_deleted),
    syncedAt: new Date(),
  };
}

async function syncTickets(): Promise<{ processed: number; errors: number }> {
  const users = await resolveTrackedUsers();
  const filter = `user_recipient.id=in=(${TRACKED_USER_IDS.join(",")})`;
  const tickets = await glpiGetAll<GlpiTicketRaw>("/Assistance/Ticket", { filter, fields: FIELDS });

  let processed = 0;
  let errors = 0;
  const seen: number[] = [];

  for (const t of tickets) {
    try {
      const data = buildTicketData(t, users);
      await db.glpiTicket.upsert({
        where: { glpiId: t.id },
        create: { glpiId: t.id, ...data },
        update: data,
      });
      seen.push(t.id);
      processed++;
    } catch {
      errors++;
    }
  }

  // Chamados que sumiram da API (ex.: reatribuídos/removidos) → marca como excluído
  // no espelho em vez de apagar (preserva histórico). Só quando o fetch trouxe algo,
  // pra não zerar tudo num erro parcial de rede.
  if (seen.length > 0) {
    await db.glpiTicket.updateMany({
      where: { glpiId: { notIn: seen }, isDeleted: false },
      data: { isDeleted: true },
    });
  }

  return { processed, errors };
}

// Re-espelha UM chamado (após uma escrita: novo ticket, followup, status, atribuição).
// Se o ticket não for mais visível/existir, ignora silenciosamente.
export async function syncOneTicket(glpiId: number): Promise<void> {
  if (!glpiConfigured() || !Number.isInteger(glpiId) || glpiId <= 0) return;
  const users = await resolveTrackedUsers();
  const t = await glpiGetOne<GlpiTicketRaw>(`/Assistance/Ticket/${glpiId}`, FIELDS);
  if (!t || !t.id) return;
  const data = buildTicketData(t, users);
  await db.glpiTicket.upsert({
    where: { glpiId: t.id },
    create: { glpiId: t.id, ...data },
    update: data,
  });
}

export async function runGlpiSync(
  kind: "auto" | "manual" = "manual",
): Promise<{ ok: boolean; runId: string; error?: string }> {
  if (!glpiConfigured()) {
    return { ok: false, runId: "", error: "GLPI não configurado (defina as variáveis GLPI_*)." };
  }
  const run = await db.glpiSyncRun.create({ data: { kind } });
  const t0 = Date.now();
  try {
    const { processed, errors } = await syncTickets();
    await db.glpiSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), durationMs: Date.now() - t0, processed, errors },
    });
    return { ok: true, runId: run.id };
  } catch (e) {
    const msg = (e as Error).message;
    await db.glpiSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), durationMs: Date.now() - t0, fatalError: msg },
    });
    return { ok: false, runId: run.id, error: msg };
  }
}
