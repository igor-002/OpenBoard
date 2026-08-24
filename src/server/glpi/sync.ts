// Sync GLPI → espelho local (GlpiTicket). Read-only. "Demanda do marketing" =
// chamado da ENTIDADE Marketing, mais os chamados abertos por alguém do time do
// marketing em outra entidade.
//
// O GLPI não deixa filtrar por requerente via RSQL (a lista de atores não é
// filtrável — só autor e entidade são). Então puxamos a UNIÃO de dois filtros
// escaláveis: autor∈rastreados OU entidade Marketing.
//
// A entidade manda: todo chamado da entidade Marketing entra, mesmo que nenhum
// ator dele esteja em GLPI_TRACKED_USER_IDS. A regra antiga exigia um ator
// rastreado e DESCARTAVA silenciosamente os chamados de quem não estava na lista
// (8 chamados reais, incl. 2 abertos pela Caroline em ago/2026) — uma lista fixa
// de ids no env não é critério confiável de escopo.
import { db } from "@/lib/db";
import { glpiGetOne, glpiGetAll, glpiDate, glpiConfigured, TRACKED_USER_IDS, DEFAULT_ENTITY_ID } from "@/lib/glpi";
import { fetchGlpiUsers, glpiDisplayName } from "./users";

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

// Resolve id → nome de exibição de QUALQUER usuário (o user_recipient e o team só
// trazem o login). Uma chamada só pra instância inteira; se falhar, o upsert cai
// no login/nome que veio dentro do próprio chamado.
async function resolveUsers(): Promise<Map<number, { login: string; name: string }>> {
  const map = new Map<number, { login: string; name: string }>();
  for (const u of await fetchGlpiUsers()) {
    map.set(u.id, { login: u.username ?? String(u.id), name: glpiDisplayName(u) });
  }
  return map;
}

// role do ator, tolerante a variações do GLPI ("requester" / 1 / "requester_...").
const hasRole = (m: TeamMember, role: "requester" | "assigned") =>
  String(m.role ?? "").toLowerCase().includes(role);

// Quem PEDIU a demanda — é isso que a coluna "Solicitante" mostra e o que agrupa
// as abas "por pessoa". Ordem de força:
//   1º o AUTOR, quando ele também consta como requerente (caso normal: a pessoa
//      abre o próprio chamado — desempata quando há vários requerentes);
//   2º o primeiro REQUERENTE do team, seja ele do marketing ou não;
//   3º o AUTOR (chamado sem requerente no team);
//   4º um ATRIBUÍDO (chamado sem autor nem requerente — dado velho do GLPI).
// null só quando o chamado não tem ator nenhum.
//
// Não exige mais que a pessoa esteja em GLPI_TRACKED_USER_IDS: exigir isso fazia
// o chamado ser atribuído a quem ATENDEU (fallback pro atribuído), então a coluna
// "Solicitante" mostrava o técnico do marketing no lugar de quem pediu.
function attributedUserId(t: GlpiTicketRaw): number | null {
  const team = t.team ?? [];
  const requesters = team.filter((m) => hasRole(m, "requester"));
  const authorId = t.user_recipient?.id ?? 0;
  if (authorId && requesters.some((m) => m.id === authorId)) return authorId;
  if (requesters.length > 0) return requesters[0].id;
  if (authorId) return authorId;
  return team.find((m) => hasRole(m, "assigned"))?.id ?? null;
}

// Um chamado é demanda do marketing se está na entidade Marketing ou se um dos
// atores é do time rastreado (pega o que o time abre em outra entidade).
function isMarketingDemand(t: GlpiTicketRaw): boolean {
  if (t.entity?.id === DEFAULT_ENTITY_ID) return true;
  if (TRACKED_USER_IDS.includes(t.user_recipient?.id ?? 0)) return true;
  return (t.team ?? []).some((m) => TRACKED_USER_IDS.includes(m.id));
}

// Mapeia o ticket cru do GLPI → colunas do GlpiTicket (mesma forma no sync completo
// e no syncOneTicket pós-escrita). `attributedId` = usuário de marketing dono da demanda.
function buildTicketData(t: GlpiTicketRaw, users: Map<number, { login: string; name: string }>, attributedId: number) {
  const resolved = users.get(attributedId);
  const actor = (t.team ?? []).find((m) => m.id === attributedId);
  const requesterLogin = resolved?.login ?? actor?.name ?? t.user_recipient?.name ?? "";
  // attributedId 0 = chamado sem ator nenhum no GLPI (dado antigo). Fica no espelho
  // com rótulo próprio em vez de virar uma aba "0" sem nome.
  const requesterName =
    attributedId > 0
      ? (resolved?.name ?? actor?.display_name ?? actor?.name ?? requesterLogin ?? String(attributedId))
      : "(sem solicitante)";
  const assignees = (t.team ?? [])
    .filter((m) => hasRole(m, "assigned"))
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
    requesterId: attributedId,
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
  const users = await resolveUsers();

  // União de dois filtros escaláveis (autor rastreado OU entidade Marketing).
  // O requerente não é filtrável via RSQL, então trazemos esses dois conjuntos e
  // filtramos localmente por requerente/autor rastreado.
  const [porAutor, porEntidade] = await Promise.all([
    glpiGetAll<GlpiTicketRaw>("/Assistance/Ticket", { filter: `user_recipient.id=in=(${TRACKED_USER_IDS.join(",")})`, fields: FIELDS }),
    glpiGetAll<GlpiTicketRaw>("/Assistance/Ticket", { filter: `entity.id==${DEFAULT_ENTITY_ID}`, fields: FIELDS }),
  ]);
  const byId = new Map<number, GlpiTicketRaw>();
  for (const t of [...porAutor, ...porEntidade]) byId.set(t.id, t);

  let processed = 0;
  let errors = 0;
  const seen: number[] = [];

  for (const t of byId.values()) {
    if (!isMarketingDemand(t)) continue;
    try {
      const data = buildTicketData(t, users, attributedUserId(t) ?? 0);
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
  const users = await resolveUsers();
  const t = await glpiGetOne<GlpiTicketRaw>(`/Assistance/Ticket/${glpiId}`, FIELDS);
  if (!t || !t.id) return;
  const data = buildTicketData(t, users, attributedUserId(t) ?? 0);
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
