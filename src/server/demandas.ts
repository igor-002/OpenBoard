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
import { glpiTicketUrl } from "@/lib/glpi";
import { abrirChamadoDaDemanda, listarRegras } from "@/server/glpi/regras";

export type Ator = { id: string; name: string; workspaceId: string };
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string; falta?: "solucao" | "motivo" };

// Pessoas que podem receber demanda: quem está marcado como da equipe. Usuário de
// outra área (Comercial, Marketing) tem login no mesmo sistema mas não entra aqui.
// `incluir` mantém na lista quem já é responsável por algo mesmo sem ser da
// equipe, pra seletor não ficar sem o valor atual. Enquanto ninguém for marcado,
// devolve todos os ativos — sistema recém-configurado não pode ficar sem opções.
export async function membrosDaEquipe(
  workspaceId: string,
  incluir: (string | null | undefined)[] = [],
): Promise<{ id: string; name: string; initials: string; color: string; jobTitle: string; equipe: boolean }[]> {
  const select = { id: true, name: true, initials: true, color: true, jobTitle: true, equipe: true } as const;
  const ids = incluir.filter((x): x is string => !!x);
  const marcados = await db.user.count({ where: { workspaceId, active: true, equipe: true } });
  return db.user.findMany({
    where: marcados === 0 ? { workspaceId, active: true } : { workspaceId, OR: [{ active: true, equipe: true }, { id: { in: ids } }] },
    orderBy: { name: "asc" },
    select,
  });
}

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
  // Chamado no GLPI: ausente = pelas regras de /settings/glpi; null = não abrir;
  // id = abrir por essa regra mesmo que o gatilho dela não case.
  glpiRegraId?: string | null;
};

// `chamado` = nº do chamado aberto no GLPI junto com a demanda. `aviso` = a
// demanda foi criada mas o chamado não — a demanda nunca se perde por causa do GLPI.
export type DemandaCriada = { id: string; numero: number; chamado?: number | null; aviso?: string };

export async function criarDemanda(ator: Ator, d: NovaDemanda): Promise<Resultado<DemandaCriada>> {
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

  if (d.jaFeita || d.glpiRegraId === null) return { ok: true, id: task.id, numero: task.numero };
  const g = await abrirChamadoDaDemanda(ator, task.id, d.glpiRegraId ?? "auto");
  return g.ok
    ? { ok: true, id: task.id, numero: task.numero, chamado: g.chamado }
    : { ok: true, id: task.id, numero: task.numero, aviso: g.error };
}

// Troca o responsável (null = volta pra "sem dono"). Sempre registra e avisa.
// Passar pra alguém que é gatilho de regra do GLPI abre o chamado (se ainda não há).
export async function atribuirDemanda(
  ator: Ator,
  taskId: string,
  assigneeId: string | null,
): Promise<Resultado<{ chamado?: number | null; aviso?: string }>> {
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
  if (!novo) return { ok: true };
  const g = await abrirChamadoDaDemanda(ator, taskId, "auto");
  return g.ok ? { ok: true, chamado: g.chamado } : { ok: true, aviso: g.error };
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
  // Chamado aberto no GLPI por esta demanda. Status vem do espelho local (sync).
  chamado: { glpiId: number; status: string | null; responsaveis: string | null; url: string | null; fechaJunto: boolean } | null;
  opcoes: {
    regrasGlpi: { id: string; name: string }[]; // pra abrir chamado à mão (vazio se já tem)
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

  const [membros, tipos, projetos, ticket, regras] = await Promise.all([
    membrosDaEquipe(workspaceId, [t.assigneeId]),
    db.taskType.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { workspaceId, status: { not: "done" } }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
    t.glpiId ? db.glpiTicket.findUnique({ where: { glpiId: t.glpiId }, select: { statusName: true, assignees: true } }) : null,
    t.glpiId || !isAberta(t.column) ? [] : listarRegras(workspaceId, true),
  ]);
  // O histórico cita gente que pode ter saído da equipe: nomes vêm de todos.
  const todos = await db.user.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const nomeDe = new Map(todos.map((m) => [m.id, m.name]));

  const linha: DemandaEvento[] = [
    ...t.comments.map((c) => ({ tipo: "comentario" as const, id: c.id, quando: c.createdAt, autor: c.author, autorId: c.authorId, texto: c.body })),
    ...t.events.map((e) => {
      let texto: string;
      if (e.kind === "created") texto = "abriu a demanda";
      else if (e.kind === "glpi") texto = `abriu o chamado #${e.to} no GLPI`;
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
    chamado: t.glpiId
      ? {
          glpiId: t.glpiId,
          status: ticket?.statusName || null,
          responsaveis: ticket?.assignees || null,
          url: glpiTicketUrl(t.glpiId),
          fechaJunto: t.glpiFechaJunto,
        }
      : null,
    opcoes: {
      membros: membros.map((m) => ({ id: m.id, name: m.name })),
      tipos,
      projetos,
      regrasGlpi: regras.map((r) => ({ id: r.id, name: r.name })),
    },
  };
}
