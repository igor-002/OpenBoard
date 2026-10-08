// Lista de demandas — leitura para a tela /atividades, com filtros.
// O detalhe de cada uma vem de getDemanda (src/server/demandas.ts).
import "server-only";
import { db } from "@/lib/db";
import { COLUNAS_ABERTAS, ORIGENS, STATUS_DEMANDA } from "@/lib/meta";
import { membrosDaEquipe } from "@/server/demandas";
import type { Priority, TaskColumn, TaskOrigin, AvatarUser } from "@/lib/types";

export type AtividadeRow = {
  id: string;
  numero: number;
  title: string;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  solicitante: string | null;
  tipoName: string | null;
  clienteRazao: string | null;
  projectName: string | null;
  assignee: AvatarUser | null;
  createdAt: Date;
  startedAt: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  realMinutes: number | null; // doneAt − startedAt (null se não concluída/iniciada)
  acompanhamentos: number;
};

export type AtividadeFilters = {
  assigneeId?: string; // id do usuário, ou "nenhum" = sem dono
  tipoId?: string;
  origem?: string;
  status?: string; // um status, ou vazio (= em aberto) / "todas"
  clienteId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

export type AtividadesData = {
  rows: AtividadeRow[];
  limite: number; // teto de linhas; se rows.length === limite, há mais do que o mostrado
  tipos: { id: string; name: string }[];
  members: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  clientes: { id: string; razao: string }[]; // clientes já usados em demandas (filtro)
};

const LIMITE = 300;

function parseDay(s: string | undefined, endOfDay: boolean): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + (endOfDay ? "T23:59:59.999" : "T00:00:00"));
  return isNaN(+d) ? undefined : d;
}

export async function getAtividadesData(workspaceId: string, filters: AtividadeFilters): Promise<AtividadesData> {
  const origem = ORIGENS.find((o) => o === filters.origem);
  const from = parseDay(filters.from, false);
  const to = parseDay(filters.to, true);
  // Sem filtro de status a lista mostra o que ainda pede trabalho; o histórico
  // (resolvidas, canceladas) aparece quando a pessoa pede.
  const column =
    filters.status === "todas"
      ? undefined
      : filters.status && filters.status in STATUS_DEMANDA
        ? (filters.status as TaskColumn)
        : { in: COLUNAS_ABERTAS };

  const [rows, tipos, members, projects, clientesRaw] = await Promise.all([
    db.task.findMany({
      where: {
        workspaceId,
        ...(column ? { column } : {}),
        ...(filters.assigneeId === "nenhum" ? { assigneeId: null } : filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(filters.tipoId ? { tipoId: filters.tipoId } : {}),
        ...(origem ? { origem } : {}),
        ...(filters.clienteId ? { ixcClienteId: filters.clienteId } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
      include: {
        tipo: { select: { name: true } },
        ixcCliente: { select: { razao: true } },
        project: { select: { name: true } },
        assignee: { select: { name: true, initials: true, color: true } },
        _count: { select: { comments: true } },
      },
    }),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    // O filtro também precisa de quem está de fora mas é o responsável filtrado.
    membrosDaEquipe(workspaceId, [filters.assigneeId]),
    db.project.findMany({ where: { workspaceId, status: { not: "done" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({
      where: { workspaceId, ixcClienteId: { not: null } },
      distinct: ["ixcClienteId"],
      select: { ixcCliente: { select: { id: true, razao: true } } },
    }),
  ]);

  return {
    rows: rows.map((t) => ({
      id: t.id,
      numero: t.numero,
      title: t.title,
      column: t.column,
      priority: t.priority,
      origem: t.origem,
      solicitante: t.solicitante,
      tipoName: t.tipo?.name ?? null,
      clienteRazao: t.ixcCliente?.razao ?? null,
      projectName: t.project?.name ?? null,
      assignee: t.assignee,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      realMinutes: t.startedAt && t.doneAt ? Math.max(0, Math.round((+t.doneAt - +t.startedAt) / 60000)) : null,
      acompanhamentos: t._count.comments,
    })),
    limite: LIMITE,
    tipos,
    members: members.map((m) => ({ id: m.id, name: m.name })),
    projects,
    clientes: clientesRaw
      .map((r) => r.ixcCliente)
      .filter((c): c is { id: string; razao: string } => !!c)
      .sort((a, b) => a.razao.localeCompare(b.razao)),
  };
}
