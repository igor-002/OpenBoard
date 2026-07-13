// Atividades da Equipe — leitura. Tarefas (com ou sem projeto) com tipo, origem,
// cliente e timeline, prontas pra filtro e relatório.
import "server-only";
import { db } from "@/lib/db";
import type { Priority, TaskColumn, TaskOrigin, AvatarUser } from "@/lib/types";

export type AtividadeComment = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: AvatarUser;
};

export type AtividadeRow = {
  id: string;
  title: string;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  tipoId: string | null;
  tipoName: string | null;
  clienteId: string | null;
  clienteRazao: string | null;
  clienteIxcId: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  assignee: AvatarUser | null;
  createdAt: Date;
  startedAt: Date | null;
  doneAt: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  realMinutes: number | null; // doneAt − startedAt (null se não concluída/iniciada)
  report: string | null;
  comments: AtividadeComment[];
};

export type AtividadeFilters = {
  assigneeId?: string;
  tipoId?: string;
  origem?: TaskOrigin;
  column?: TaskColumn;
  clienteId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

export type AtividadesStats = {
  abertas: number; // != done (workspace todo)
  concluidasMes: number; // doneAt no mês corrente
  avulsasMes: number; // criadas no mês com origem avulsa/presencial
  emAndamento: number; // column = doing
};

export type AtividadesData = {
  rows: AtividadeRow[];
  stats: AtividadesStats;
  tipos: { id: string; name: string }[];
  members: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  clientes: { id: string; razao: string }[]; // clientes já usados em atividades (filtro)
};

const ORIGENS = ["planejada", "avulsa", "presencial"] as const;
const COLUMNS = ["todo", "doing", "review", "done"] as const;

function parseDay(s: string | undefined, endOfDay: boolean): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + (endOfDay ? "T23:59:59.999" : "T00:00:00"));
  return isNaN(+d) ? undefined : d;
}

export async function getAtividadesData(workspaceId: string, filters: AtividadeFilters): Promise<AtividadesData> {
  const origem = ORIGENS.includes(filters.origem as (typeof ORIGENS)[number]) ? filters.origem : undefined;
  const column = COLUMNS.includes(filters.column as (typeof COLUMNS)[number]) ? filters.column : undefined;
  const from = parseDay(filters.from, false);
  const to = parseDay(filters.to, true);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [rows, abertas, concluidasMes, avulsasMes, emAndamento, tipos, members, projects, clientesRaw] = await Promise.all([
    db.task.findMany({
      where: {
        workspaceId,
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(filters.tipoId ? { tipoId: filters.tipoId } : {}),
        ...(origem ? { origem } : {}),
        ...(column ? { column } : {}),
        ...(filters.clienteId ? { ixcClienteId: filters.clienteId } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        tipo: { select: { id: true, name: true } },
        ixcCliente: { select: { id: true, razao: true, ixcId: true } },
        project: { select: { id: true, name: true } },
        assignee: { select: { name: true, initials: true, color: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, initials: true, color: true } } },
        },
      },
    }),
    db.task.count({ where: { workspaceId, column: { not: "done" } } }),
    db.task.count({ where: { workspaceId, column: "done", doneAt: { gte: monthStart } } }),
    db.task.count({ where: { workspaceId, origem: { in: ["avulsa", "presencial"] }, createdAt: { gte: monthStart } } }),
    db.task.count({ where: { workspaceId, column: "doing" } }),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({
      where: { workspaceId, ixcClienteId: { not: null } },
      distinct: ["ixcClienteId"],
      select: { ixcCliente: { select: { id: true, razao: true } } },
    }),
  ]);

  return {
    rows: rows.map((t) => ({
      id: t.id,
      title: t.title,
      column: t.column,
      priority: t.priority,
      origem: t.origem,
      tipoId: t.tipo?.id ?? null,
      tipoName: t.tipo?.name ?? null,
      clienteId: t.ixcCliente?.id ?? null,
      clienteRazao: t.ixcCliente?.razao ?? null,
      clienteIxcId: t.ixcCliente?.ixcId ?? null,
      projectId: t.project?.id ?? null,
      projectName: t.project?.name ?? null,
      assigneeId: t.assigneeId,
      assignee: t.assignee,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      doneAt: t.doneAt,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      realMinutes: t.startedAt && t.doneAt ? Math.max(0, Math.round((+t.doneAt - +t.startedAt) / 60000)) : null,
      report: t.report,
      comments: t.comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, authorId: c.authorId, author: c.author })),
    })),
    stats: { abertas, concluidasMes, avulsasMes, emAndamento },
    tipos,
    members,
    projects,
    clientes: clientesRaw
      .map((r) => r.ixcCliente)
      .filter((c): c is { id: string; razao: string } => !!c)
      .sort((a, b) => a.razao.localeCompare(b.razao)),
  };
}
