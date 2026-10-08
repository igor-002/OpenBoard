// Tela "Hoje" — o que o gestor precisa ver ao abrir o sistema: o que chegou e
// ainda não tem dono, o que cada pessoa está fazendo agora e o que travou.
// Tudo lido de Task; nada aqui é estimado ou inventado.
import "server-only";
import { COLUNAS_ABERTAS, isAtrasada } from "@/lib/meta";
import { membrosDaEquipe } from "@/server/demandas";
import { db } from "@/lib/db";
import type { Priority, TaskColumn, TaskOrigin, AvatarUser } from "@/lib/types";

export type HojeTask = {
  id: string;
  numero: number;
  title: string;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  assigneeId: string | null;
  assigneeName: string | null;
  contexto: string | null; // cliente, senão projeto, senão tipo
  createdAt: Date;
  startedAt: Date | null;
  doneAt: Date | null;
  dueDate: Date | null;
  atrasada: boolean;
  // Atribuída por outra pessoa e o responsável ainda não confirmou que viu.
  semConfirmacao: boolean;
};

export type HojePessoa = AvatarUser & {
  name: string;
  id: string;
  jobTitle: string;
  fazendo: HojeTask[];
  fila: HojeTask[]; // só as primeiras; `filaTotal` tem a contagem real
  filaTotal: number;
  atrasadas: number;
  feitasHoje: number;
};

export type HojeData = {
  semDono: HojeTask[];
  semConfirmacao: HojeTask[];
  atrasadas: HojeTask[];
  pessoas: HojePessoa[];
  feitasHoje: HojeTask[];
  totais: { fazendo: number; aguardando: number; fila: number; atrasadas: number; feitasHoje: number };
  membros: { id: string; name: string }[];
  projetosAtivos: number;
  // Falso enquanto ninguém foi marcado como da equipe: a tela mostra todo mundo.
  equipeDefinida: boolean;
  // Todos os usuários ativos, pra tela de escolher a equipe.
  usuarios: { id: string; name: string; jobTitle: string; equipe: boolean }[];
  agora: number; // relógio do servidor no momento da leitura (base dos "há 2h")
};

const FILA_VISIVEL = 3;
const PESO: Record<Priority, number> = { high: 0, med: 1, low: 2 };

// Ordem de fila: prioridade, depois prazo mais próximo, depois a mais antiga.
function porUrgencia(a: HojeTask, b: HojeTask): number {
  return (
    PESO[a.priority] - PESO[b.priority] ||
    (a.dueDate ? +a.dueDate : Infinity) - (b.dueDate ? +b.dueDate : Infinity) ||
    +a.createdAt - +b.createdAt
  );
}

export async function getHojeData(workspaceId: string): Promise<HojeData> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const include = {
    assignee: { select: { name: true } },
    tipo: { select: { name: true } },
    project: { select: { name: true } },
    ixcCliente: { select: { razao: true } },
    acknowledgements: { where: { receivedAt: null }, select: { userId: true } },
  } as const;

  const [abertasRaw, feitasRaw, usuarios, projetosAtivos] = await Promise.all([
    db.task.findMany({ where: { workspaceId, column: { in: COLUNAS_ABERTAS } }, orderBy: { createdAt: "asc" }, take: 1000, include }),
    db.task.findMany({ where: { workspaceId, column: "done", doneAt: { gte: inicioDoDia } }, orderBy: { doneAt: "desc" }, include }),
    db.user.findMany({
      where: { workspaceId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, jobTitle: true, equipe: true },
    }),
    db.project.count({ where: { workspaceId, status: { in: ["progress", "review"] } } }),
  ]);

  const toTask = (t: (typeof abertasRaw)[number]): HojeTask => ({
    id: t.id,
    numero: t.numero,
    title: t.title,
    column: t.column,
    priority: t.priority,
    origem: t.origem,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    // Aguardando mostra o motivo; senão quem pediu, cliente, projeto ou tipo.
    contexto: (t.column === "waiting" ? t.waitingReason : null) ?? t.solicitante ?? t.ixcCliente?.razao ?? t.project?.name ?? t.tipo?.name ?? null,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    doneAt: t.doneAt,
    dueDate: t.dueDate,
    atrasada: isAtrasada(t.column, t.dueDate, inicioDoDia),
    semConfirmacao: !!t.assigneeId && t.acknowledgements.some((a) => a.userId === t.assigneeId),
  });

  // Equipe marcada + quem, mesmo de fora, está com demanda aberta ou resolveu
  // algo hoje — trabalho em andamento não pode sumir da tela.
  const users = await membrosDaEquipe(workspaceId, [...abertasRaw, ...feitasRaw].map((t) => t.assigneeId));
  const equipeDefinida = usuarios.some((u) => u.equipe);

  const abertas = abertasRaw.map(toTask);
  const feitasHoje = feitasRaw.map(toTask);

  const pessoas: HojePessoa[] = users.map((u) => {
    const minhas = abertas.filter((t) => t.assigneeId === u.id);
    const fila = minhas.filter((t) => t.column === "todo").sort(porUrgencia);
    return {
      ...u,
      // Aguardando fica junto do que está em atendimento: saiu da fila e não fechou.
      fazendo: minhas.filter((t) => t.column !== "todo").sort((a, b) => +(a.startedAt ?? a.createdAt) - +(b.startedAt ?? b.createdAt)),
      fila: fila.slice(0, FILA_VISIVEL),
      filaTotal: fila.length,
      atrasadas: minhas.filter((t) => t.atrasada).length,
      feitasHoje: feitasHoje.filter((t) => t.assigneeId === u.id).length,
    };
  });

  // Quem tem coisa em andamento sobe; quem está sem nada desce.
  pessoas.sort(
    (a, b) =>
      Number(b.fazendo.length > 0) - Number(a.fazendo.length > 0) ||
      Number(b.filaTotal + b.feitasHoje > 0) - Number(a.filaTotal + a.feitasHoje > 0) ||
      a.name.localeCompare(b.name),
  );

  return {
    semDono: abertas.filter((t) => !t.assigneeId).sort(porUrgencia),
    semConfirmacao: abertas.filter((t) => t.semConfirmacao).sort(porUrgencia),
    atrasadas: abertas.filter((t) => t.atrasada && t.assigneeId).sort((a, b) => +a.dueDate! - +b.dueDate!),
    pessoas,
    feitasHoje,
    totais: {
      fazendo: abertas.filter((t) => t.column === "doing").length,
      aguardando: abertas.filter((t) => t.column === "waiting").length,
      fila: abertas.filter((t) => t.column === "todo").length,
      atrasadas: abertas.filter((t) => t.atrasada).length,
      feitasHoje: feitasHoje.length,
    },
    // Opções de "passar para": só a equipe, sem os de fora que apareceram acima.
    membros: users.filter((u) => u.equipe || !equipeDefinida).map((u) => ({ id: u.id, name: u.name })),
    equipeDefinida,
    usuarios,
    projetosAtivos,
    agora: Date.now(),
  };
}
