// Sync GLPI → espelho local (GlpiTicket). Read-only. "Demanda do marketing" =
// chamado cujo REQUERENTE (ou autor) é um dos usuários rastreados — assim entram
// também os chamados que OUTRAS pessoas abrem PARA um usuário do marketing.
//
// O GLPI não deixa filtrar por requerente via RSQL (a lista de atores não é
// filtrável — só autor e entidade são). Então puxamos a UNIÃO de dois filtros
// escaláveis: autor∈rastreados OU entidade Marketing; e filtramos LOCALMENTE
// mantendo só os chamados cujo requerente/autor é rastreado, atribuindo a demanda
// a esse usuário de marketing (pro "por pessoa" agrupar certo).
import { db } from "@/lib/db";
import { glpiGetOne, glpiGetAll, glpiDate, glpiConfigured, TRACKED_USER_IDS, DEFAULT_ENTITY_ID } from "@/lib/glpi";

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

// role do ator, tolerante a variações do GLPI ("requester" / 1 / "requester_...").
const hasRole = (m: TeamMember, role: "requester" | "assigned") =>
  String(m.role ?? "").toLowerCase().includes(role);

// Usuário de marketing (rastreado) a quem a demanda pertence, em ordem de força:
// 1º um REQUERENTE rastreado (chamado aberto PARA ele); 2º o AUTOR, se rastreado;
// 3º um ATRIBUÍDO rastreado. null = não é demanda de ninguém do marketing → o
// chamado é descartado no sync.
//
// O 3º caso não é teoria: quando alguém de fora abre um chamado PARA o marketing,
// esta instância põe a pessoa do marketing no team só como `assigned`, sem
// `requester` nenhum — 20 chamados reais da entidade Marketing ficavam invisíveis
// por isso. Como o pool já é "autor rastreado OU entidade Marketing", cair pro
// atribuído não amplia o escopo além do que é demanda do time.
function attributedTrackedId(t: GlpiTicketRaw): number | null {
  const team = t.team ?? [];
  const req = team.find((m) => hasRole(m, "requester") && TRACKED_USER_IDS.includes(m.id));
  if (req) return req.id;
  const authorId = t.user_recipient?.id ?? 0;
  if (TRACKED_USER_IDS.includes(authorId)) return authorId;
  return team.find((m) => hasRole(m, "assigned") && TRACKED_USER_IDS.includes(m.id))?.id ?? null;
}

// Mapeia o ticket cru do GLPI → colunas do GlpiTicket (mesma forma no sync completo
// e no syncOneTicket pós-escrita). `attributedId` = usuário de marketing dono da demanda.
function buildTicketData(t: GlpiTicketRaw, users: Map<number, { login: string; name: string }>, attributedId: number) {
  const resolved = users.get(attributedId);
  const actor = (t.team ?? []).find((m) => m.id === attributedId);
  const requesterLogin = resolved?.login ?? actor?.name ?? t.user_recipient?.name ?? "";
  const requesterName = resolved?.name ?? actor?.display_name ?? actor?.name ?? requesterLogin;
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
  const users = await resolveTrackedUsers();

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
    const attributedId = attributedTrackedId(t);
    if (attributedId == null) continue; // requerente/autor não é do marketing → ignora
    try {
      const data = buildTicketData(t, users, attributedId);
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
  // Pós-escrita nossa: o ticket é sempre de um usuário rastreado; se não achar,
  // cai no autor pra não perder o chamado que acabamos de gravar.
  const attributedId = attributedTrackedId(t) ?? t.user_recipient?.id ?? 0;
  const data = buildTicketData(t, users, attributedId);
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
