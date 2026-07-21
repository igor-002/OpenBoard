// Leitura do espelho GLPI para a aba "Demandas" do Marketing. Só lê o banco local
// (o sync é quem fala com o GLPI). Sem dado inventado — tudo vem do GlpiTicket.
import { db } from "@/lib/db";

export { glpiConfigured } from "@/lib/glpi";

// GLPI: 1 Novo, 2 Em atendimento (atribuído), 3 Em atendimento (planejado),
// 4 Pendente, 5 Solucionado, 6 Fechado. "Aberto" = ainda não solucionado/fechado.
const OPEN_STATUSES = [1, 2, 3, 4];

export type StatusFilter = "abertos" | "pendentes" | "solucionados" | "fechados" | "todos";

function statusWhere(f: StatusFilter): { statusId?: { in: number[] } | number } {
  switch (f) {
    case "abertos":
      return { statusId: { in: OPEN_STATUSES } };
    case "pendentes":
      return { statusId: 4 };
    case "solucionados":
      return { statusId: 5 };
    case "fechados":
      return { statusId: 6 };
    default:
      return {};
  }
}

export interface TicketRow {
  glpiId: number;
  name: string;
  statusId: number;
  statusName: string;
  typeId: number;
  priority: number;
  requesterId: number;
  requesterName: string;
  assignees: string;
  entityName: string;
  dateCreation: string; // ISO
  dateMod: string | null;
  resolutionDuration: number | null;
}

export interface UserTab {
  requesterId: number;
  name: string;
  total: number;
  abertos: number;
}

export interface GlpiReport {
  users: UserTab[];
  stats: { total: number; abertos: number; pendentes: number; solucionados: number; fechados: number; avgResolutionH: number | null };
  tickets: TicketRow[];
  lastSync: { finishedAt: string | null; ok: boolean; processed: number } | null;
}

export async function getGlpiReport(opts: { requesterId?: number | null; status?: StatusFilter }): Promise<GlpiReport> {
  const status = opts.status ?? "abertos";
  const baseWhere = { isDeleted: false as const };

  // Abas por usuário (sempre todos os usuários com chamados, ignorando o filtro de status).
  const grouped = await db.glpiTicket.groupBy({
    by: ["requesterId"],
    where: baseWhere,
    _count: { _all: true },
  });
  const nameRows = await db.glpiTicket.findMany({
    where: baseWhere,
    distinct: ["requesterId"],
    select: { requesterId: true, requesterName: true },
  });
  const nameById = new Map(nameRows.map((r) => [r.requesterId, r.requesterName]));
  const openByUser = await db.glpiTicket.groupBy({
    by: ["requesterId"],
    where: { ...baseWhere, statusId: { in: OPEN_STATUSES } },
    _count: { _all: true },
  });
  const openMap = new Map(openByUser.map((g) => [g.requesterId, g._count._all]));
  const users: UserTab[] = grouped
    .map((g) => ({
      requesterId: g.requesterId,
      name: nameById.get(g.requesterId) || String(g.requesterId),
      total: g._count._all,
      abertos: openMap.get(g.requesterId) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Escopo atual (usuário selecionado, se houver) para stats + tabela.
  const scopeWhere = { ...baseWhere, ...(opts.requesterId ? { requesterId: opts.requesterId } : {}) };

  const [total, abertos, pendentes, solucionados, fechados, avgAgg] = await Promise.all([
    db.glpiTicket.count({ where: scopeWhere }),
    db.glpiTicket.count({ where: { ...scopeWhere, statusId: { in: OPEN_STATUSES } } }),
    db.glpiTicket.count({ where: { ...scopeWhere, statusId: 4 } }),
    db.glpiTicket.count({ where: { ...scopeWhere, statusId: 5 } }),
    db.glpiTicket.count({ where: { ...scopeWhere, statusId: 6 } }),
    db.glpiTicket.aggregate({
      where: { ...scopeWhere, resolutionDuration: { not: null, gt: 0 } },
      _avg: { resolutionDuration: true },
    }),
  ]);
  const avgSec = avgAgg._avg.resolutionDuration;
  const avgResolutionH = avgSec ? Math.round((avgSec / 3600) * 10) / 10 : null;

  const rows = await db.glpiTicket.findMany({
    where: { ...scopeWhere, ...statusWhere(status) },
    orderBy: { dateCreation: "desc" },
    take: 300,
  });
  const tickets: TicketRow[] = rows.map((t) => ({
    glpiId: t.glpiId,
    name: t.name,
    statusId: t.statusId,
    statusName: t.statusName,
    typeId: t.typeId,
    priority: t.priority,
    requesterId: t.requesterId,
    requesterName: t.requesterName,
    assignees: t.assignees,
    entityName: t.entityName,
    dateCreation: t.dateCreation.toISOString(),
    dateMod: t.dateMod?.toISOString() ?? null,
    resolutionDuration: t.resolutionDuration,
  }));

  const lastRun = await db.glpiSyncRun.findFirst({ orderBy: { startedAt: "desc" } });
  const lastSync = lastRun
    ? { finishedAt: lastRun.finishedAt?.toISOString() ?? null, ok: !lastRun.fatalError && !!lastRun.finishedAt, processed: lastRun.processed }
    : null;

  return { users, stats: { total, abertos, pendentes, solucionados, fechados, avgResolutionH }, tickets, lastSync };
}
