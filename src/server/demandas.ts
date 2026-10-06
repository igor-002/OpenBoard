// Demanda (Task) — o ÚNICO lugar que cria, muda status e troca responsável.
// Toda tela (Hoje, lista, quadro, paleta, painel de detalhe) passa por aqui, pra
// regra de solução, carimbos de tempo, aviso ao responsável e histórico serem os
// mesmos não importa de onde a ação veio.
import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/server/notifications";
import { emitAppEvent } from "@/server/events";
import { isAberta, STATUS_DEMANDA } from "@/lib/meta";
import type { Priority, TaskColumn, TaskOrigin, AvatarUser } from "@/lib/types";

export type Ator = { id: string; name: string; workspaceId: string };
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string; falta?: "solucao" | "motivo" };

// Endereço da demanda: abre o painel de detalhe por cima da lista.
export function linkDemanda(numero: number): string {
  return `/atividades?d=${numero}`;
}

// Avisa o responsável e abre a confirmação de recebimento. Confirmação pendente
// de um dono anterior perde o sentido, então é descartada antes.
async function avisaResponsavel(taskId: string, numero: number, assigneeId: string, title: string, ator: Ator) {
  await db.taskAcknowledgement.deleteMany({ where: { taskId, receivedAt: null, userId: { not: assigneeId } } });
  if (assigneeId === ator.id) return;
  await db.taskAcknowledgement.upsert({
    where: { taskId_userId: { taskId, userId: assigneeId } },
    create: { taskId, userId: assigneeId },
    update: { receivedAt: null, createdAt: new Date() },
  });
  const link = linkDemanda(numero);
  await notify([assigneeId], { type: "task_assigned", title: `Demanda #${numero} atribuída a você`, body: title, link });
  emitAppEvent({ kind: "demanda_atribuida", recipientIds: [assigneeId], actorName: ator.name, entity: title, link });
}

export type NovaDemanda = {
  title: string;
  description?: string | null;
  solicitante?: string | null;
  origem: TaskOrigin;
  priority: Priority;
  assigneeId?: string | null;
  tipoId?: string | null;
  projectId?: string | null;
  ixcClienteId?: string | null;
  dueDate?: string | null; // YYYY-MM-DD
  estimatedMinutes?: number | null;
  // Registrar algo que JÁ foi feito: nasce resolvida, com o início ancorado pra
  // trás pela duração informada (o tempo real do sistema é sempre doneAt − startedAt).
  jaFeita?: { realMinutes: number; solucao: string } | null;
  iniciar?: boolean; // nasce em atendimento
};

export async function criarDemanda(ator: Ator, d: NovaDemanda): Promise<Resultado<{ id: string; numero: number }>> {
  const title = d.title.trim().slice(0, 200);
  if (title.length < 2) return { ok: false, error: "Escreva o que precisa ser feito." };
  const ws = ator.workspaceId;

  let assigneeId: string | null = null;
  if (d.assigneeId) {
    const u = await db.user.findFirst({ where: { id: d.assigneeId, workspaceId: ws, active: true }, select: { id: true } });
    if (!u) return { ok: false, error: "Responsável inválido." };
    assigneeId = u.id;
  }
  let tipoId: string | null = null;
  if (d.tipoId) {
    const t = await db.taskType.findFirst({ where: { id: d.tipoId, active: true }, select: { id: true } });
    if (!t) return { ok: false, error: "Tipo inválido." };
    tipoId = t.id;
  }
  let projectId: string | null = null;
  if (d.projectId) {
    const p = await db.project.findFirst({ where: { id: d.projectId, workspaceId: ws }, select: { id: true } });
    if (!p) return { ok: false, error: "Projeto inválido." };
    projectId = p.id;
  }
  let ixcClienteId: string | null = null;
  if (d.ixcClienteId) {
    const c = await db.ixcCliente.findUnique({ where: { id: d.ixcClienteId }, select: { id: true } });
    if (!c) return { ok: false, error: "Cliente inválido." };
    ixcClienteId = c.id;
  }
  let dueDate: Date | null = null;
  if (d.dueDate) {
    dueDate = /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) ? new Date(`${d.dueDate}T12:00:00`) : null;
    if (!dueDate || Number.isNaN(+dueDate)) return { ok: false, error: "Prazo inválido." };
  }
  if (d.jaFeita && d.jaFeita.solucao.trim().length < 5) {
    return { ok: false, error: "Descreva o que foi feito.", falta: "solucao" };
  }
  // Já feita ou em atendimento sem dono não existe: quem registra é quem fez.
  if ((d.jaFeita || d.iniciar) && !assigneeId) assigneeId = ator.id;

  const agora = new Date();
  const column: TaskColumn = d.jaFeita ? "done" : d.iniciar ? "doing" : "todo";
  const primeiro = await db.task.findFirst({ where: { workspaceId: ws, column }, orderBy: { order: "asc" }, select: { order: true } });

  const task = await db.task.create({
    data: {
      workspaceId: ws,
      creatorId: ator.id,
      title,
      description: d.description?.trim().slice(0, 5000) || null,
      solicitante: d.solicitante?.trim().slice(0, 120) || null,
      origem: d.origem,
      priority: d.priority,
      column,
      assigneeId,
      tipoId,
      projectId,
      ixcClienteId,
      dueDate,
      estimatedMinutes: d.estimatedMinutes ?? null,
      startedAt: d.jaFeita ? new Date(+agora - d.jaFeita.realMinutes * 60_000) : d.iniciar ? agora : null,
      doneAt: d.jaFeita ? agora : null,
      report: d.jaFeita ? d.jaFeita.solucao.trim().slice(0, 5000) : null,
      order: (primeiro?.order ?? 0) - 1, // topo da coluna: o que acabou de chegar fica na frente
      events: { create: { actorId: ator.id, kind: "created", to: column } },
    },
    select: { id: true, numero: true },
  });

  if (assigneeId && !d.jaFeita) await avisaResponsavel(task.id, task.numero, assigneeId, title, ator);
  emitAppEvent({
    kind: "task_created",
    workspaceId: ws,
    actorId: ator.id,
    actorName: ator.name,
    entity: `#${task.numero} ${title}`,
    link: linkDemanda(task.numero),
  });
  return { ok: true, id: task.id, numero: task.numero };
}

// Troca o responsável (null = volta pra "sem dono"). Sempre registra e avisa.
export async function atribuirDemanda(ator: Ator, taskId: string, assigneeId: string | null): Promise<Resultado> {
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: ator.workspaceId },
    select: { id: true, numero: true, title: true, assigneeId: true },
  });
  if (!task) return { ok: false, error: "Demanda não encontrada." };

  let novo: string | null = null;
  if (assigneeId) {
    const u = await db.user.findFirst({ where: { id: assigneeId, workspaceId: ator.workspaceId, active: true }, select: { id: true } });
    if (!u) return { ok: false, error: "Responsável inválido." };
    novo = u.id;
  }
  if (novo === task.assigneeId) return { ok: true };

  await db.$transaction([
    db.task.update({ where: { id: taskId }, data: { assigneeId: novo } }),
    db.taskEvent.create({ data: { taskId, actorId: ator.id, kind: "assignee", from: task.assigneeId, to: novo } }),
  ]);
  if (novo) await avisaResponsavel(taskId, task.numero, novo, task.title, ator);
  else await db.taskAcknowledgement.deleteMany({ where: { taskId, receivedAt: null } });
  return { ok: true };
}

// Muda o status. Regras, iguais em qualquer tela:
//  · Resolvida exige a solução (texto do que foi feito).
//  · Aguardando e Cancelada exigem o motivo.
//  · Reabrir guarda a solução antiga no histórico e limpa o campo.
export async function mudarStatusDemanda(
  ator: Ator,
  taskId: string,
  para: TaskColumn,
  extra: { solucao?: string; motivo?: string } = {},
): Promise<Resultado> {
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: ator.workspaceId },
    select: { id: true, column: true, startedAt: true, doneAt: true, report: true, assigneeId: true },
  });
  if (!task) return { ok: false, error: "Demanda não encontrada." };
  if (!(para in STATUS_DEMANDA)) return { ok: false, error: "Status inválido." };
  if (task.column === para) return { ok: true };

  const solucao = extra.solucao?.trim() ?? "";
  const motivo = extra.motivo?.trim() ?? "";
  if (para === "done" && solucao.length < 5) return { ok: false, error: "Descreva o que foi feito para resolver.", falta: "solucao" };
  if (para === "waiting" && motivo.length < 3) return { ok: false, error: "Diga o que está aguardando.", falta: "motivo" };
  if (para === "canceled" && motivo.length < 3) return { ok: false, error: "Diga por que foi cancelada.", falta: "motivo" };

  const agora = new Date();
  const reabrindo = !isAberta(task.column) && isAberta(para);

  await db.$transaction([
    db.task.update({
      where: { id: taskId },
      data: {
        column: para,
        // Início real = 1ª entrada em atendimento. Resolver direto da fila fica sem
        // duração (não se inventa tempo).
        startedAt: task.startedAt ?? (para === "doing" ? agora : null),
        doneAt: para === "done" ? agora : null,
        canceledAt: para === "canceled" ? agora : null,
        waitingReason: para === "waiting" ? motivo.slice(0, 300) : null,
        report: para === "done" ? solucao.slice(0, 5000) : reabrindo ? null : task.report,
        // Quem põe a mão numa demanda sem dono vira o dono.
        assigneeId: task.assigneeId ?? (para === "doing" || para === "done" ? ator.id : null),
      },
    }),
    db.taskEvent.create({
      data: {
        taskId,
        actorId: ator.id,
        kind: "status",
        from: task.column,
        to: para,
        note: para === "done" ? null : motivo || (reabrindo && task.report ? `Solução anterior: ${task.report}`.slice(0, 2000) : null),
      },
    }),
  ]);
  return { ok: true };
}

// ---------- Leitura do detalhe ----------

export type DemandaEvento =
  | { tipo: "comentario"; id: string; quando: Date; autor: AvatarUser | null; autorId: string | null; texto: string }
  | { tipo: "evento"; id: string; quando: Date; autor: AvatarUser | null; texto: string; nota: string | null };

export type DemandaDetalhe = {
  id: string;
  numero: number;
  title: string;
  description: string | null;
  solicitante: string | null;
  column: TaskColumn;
  priority: Priority;
  origem: TaskOrigin;
  waitingReason: string | null;
  solucao: string | null;
  assigneeId: string | null;
  assignee: AvatarUser | null;
  criador: string | null;
  tipoId: string | null;
  tipoName: string | null;
  projectId: string | null;
  projectName: string | null;
  cliente: { id: string; razao: string; ixcId: string | null } | null;
  createdAt: Date;
  startedAt: Date | null;
  doneAt: Date | null;
  dueDate: Date | null;
  dueIso: string | null;
  estimatedMinutes: number | null;
  realMinutes: number | null;
  vistaEm: Date | null; // quando o responsável confirmou que viu
  aguardandoVer: boolean;
  subtasks: { id: string; title: string; done: boolean }[];
  linha: DemandaEvento[];
  opcoes: {
    membros: { id: string; name: string }[];
    tipos: { id: string; name: string }[];
    projetos: { id: string; name: string }[];
  };
};

const AUTOR = { select: { name: true, initials: true, color: true } } as const;

export async function getDemanda(workspaceId: string, numero: number): Promise<DemandaDetalhe | null> {
  const t = await db.task.findFirst({
    where: { workspaceId, numero },
    include: {
      assignee: AUTOR,
      creator: { select: { name: true } },
      tipo: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      ixcCliente: { select: { id: true, razao: true, ixcId: true } },
      subtasks: { orderBy: { order: "asc" }, select: { id: true, title: true, done: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: AUTOR } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: AUTOR } },
      acknowledgements: { select: { userId: true, receivedAt: true } },
    },
  });
  if (!t) return null;

  const [membros, tipos, projetos] = await Promise.all([
    db.user.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { workspaceId, status: { not: "done" } }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
  ]);
  const nomeDe = new Map(membros.map((m) => [m.id, m.name]));

  const linha: DemandaEvento[] = [
    ...t.comments.map((c) => ({ tipo: "comentario" as const, id: c.id, quando: c.createdAt, autor: c.author, autorId: c.authorId, texto: c.body })),
    ...t.events.map((e) => {
      let texto: string;
      if (e.kind === "created") texto = "abriu a demanda";
      else if (e.kind === "assignee") texto = e.to ? `passou para ${nomeDe.get(e.to) ?? "outra pessoa"}` : "deixou sem dono";
      else texto = `mudou para ${STATUS_DEMANDA[e.to as TaskColumn]?.label ?? e.to}`;
      return { tipo: "evento" as const, id: e.id, quando: e.createdAt, autor: e.actor, texto, nota: e.note };
    }),
  ].sort((a, b) => +a.quando - +b.quando);

  const ack = t.acknowledgements.find((a) => a.userId === t.assigneeId);
  return {
    id: t.id,
    numero: t.numero,
    title: t.title,
    description: t.description,
    solicitante: t.solicitante,
    column: t.column,
    priority: t.priority,
    origem: t.origem,
    waitingReason: t.waitingReason,
    solucao: t.report,
    assigneeId: t.assigneeId,
    assignee: t.assignee,
    criador: t.creator?.name ?? null,
    tipoId: t.tipo?.id ?? null,
    tipoName: t.tipo?.name ?? null,
    projectId: t.project?.id ?? null,
    projectName: t.project?.name ?? null,
    cliente: t.ixcCliente,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    doneAt: t.doneAt,
    dueDate: t.dueDate,
    dueIso: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    estimatedMinutes: t.estimatedMinutes,
    realMinutes: t.startedAt && t.doneAt ? Math.max(0, Math.round((+t.doneAt - +t.startedAt) / 60000)) : null,
    vistaEm: ack?.receivedAt ?? null,
    aguardandoVer: !!ack && !ack.receivedAt,
    subtasks: t.subtasks,
    linha,
    opcoes: { membros, tipos, projetos },
  };
}
