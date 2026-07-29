"use server";

// Atividades da Equipe — mutações. Status/comentários reusam as actions do
// kanban (moveTask, addTaskComment…), já workspace-scoped e com startedAt.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/server/notifications";
import { emitAppEvent } from "@/server/events";

export type AtividadeActionState = { ok?: boolean; error?: string };

const createSchema = z.object({
  title: z.string().min(2, "Informe um título"),
  tipoId: z.string().min(1, "Escolha um tipo"),
  origem: z.enum(["planejada", "avulsa", "presencial"]),
  priority: z.enum(["high", "med", "low"]),
  // "done" = registrar algo que JÁ foi feito (ver `realMinutes` abaixo).
  column: z.enum(["todo", "doing", "done"]),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  ixcClienteId: z.string().optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(60000).optional(),
  // Quanto tempo a atividade REALMENTE levou, informado por quem registra depois
  // do fato. O tempo real do sistema é sempre doneAt − startedAt, então em vez de
  // criar um campo paralelo (que os relatórios teriam de aprender a somar) a
  // gente ancora o startedAt pra trás: doneAt − realMinutes. Assim tudo que já lê
  // duração continua certo, sem tocar em nada.
  realMinutes: z.coerce.number().int().min(1).max(60000).optional(),
  dueDate: z.string().optional(),
  descricao: z.string().optional(),
  report: z.string().optional(), // relato, quando já nasce concluída
});

export async function createAtividade(_prev: AtividadeActionState, formData: FormData): Promise<AtividadeActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    tipoId: formData.get("tipoId"),
    origem: formData.get("origem") || "avulsa",
    priority: formData.get("priority") || "med",
    column: formData.get("column") || "todo",
    assigneeId: formData.get("assigneeId") || undefined,
    projectId: formData.get("projectId") || undefined,
    ixcClienteId: formData.get("ixcClienteId") || undefined,
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
    realMinutes: formData.get("realMinutes") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    descricao: formData.get("descricao") || undefined,
    report: formData.get("report") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const tipo = await db.taskType.findFirst({ where: { id: d.tipoId, active: true }, select: { id: true } });
  if (!tipo) return { error: "Tipo inválido." };

  // Projeto é opcional; se vier, precisa ser do workspace.
  let projectId: string | null = null;
  if (d.projectId) {
    const p = await db.project.findFirst({ where: { id: d.projectId, workspaceId: user.workspaceId }, select: { id: true } });
    if (!p) return { error: "Projeto inválido." };
    projectId = p.id;
  }

  let ixcClienteId: string | null = null;
  if (d.ixcClienteId) {
    const c = await db.ixcCliente.findUnique({ where: { id: d.ixcClienteId }, select: { id: true } });
    if (!c) return { error: "Cliente inválido." };
    ixcClienteId = c.id;
  }

  // Responsável default = quem registrou (membro cria pra si).
  let assigneeId = user.id;
  if (d.assigneeId) {
    const u = await db.user.findFirst({ where: { id: d.assigneeId, workspaceId: user.workspaceId }, select: { id: true } });
    if (!u) return { error: "Responsável inválido." };
    assigneeId = u.id;
  }

  if (d.column === "done" && !d.realMinutes) {
    return { error: "Informe quanto tempo a atividade levou." };
  }

  const count = await db.task.count({ where: { workspaceId: user.workspaceId, column: d.column } });
  const now = new Date();

  // Já concluída: ancora o início pra trás pelo tempo informado, pra o cálculo
  // padrão (doneAt − startedAt) devolver exatamente o que a pessoa digitou.
  const jaFeita = d.column === "done";
  const startedAt = jaFeita ? new Date(now.getTime() - d.realMinutes! * 60_000) : d.column === "doing" ? now : null;

  const task = await db.task.create({
    data: {
      workspaceId: user.workspaceId,
      projectId,
      title: d.title,
      column: d.column,
      priority: d.priority,
      origem: d.origem,
      tipoId: tipo.id,
      ixcClienteId,
      assigneeId,
      estimatedMinutes: d.estimatedMinutes ?? null,
      dueDate: d.dueDate ? new Date(d.dueDate + "T12:00:00") : null,
      startedAt,
      doneAt: jaFeita ? now : null,
      report: jaFeita ? d.report?.trim() || d.title : null,
      order: count,
    },
    select: { id: true },
  });

  // Descrição inicial vira a 1ª atualização da linha do tempo.
  if (d.descricao?.trim()) {
    await db.taskComment.create({ data: { taskId: task.id, authorId: user.id, body: d.descricao.trim().slice(0, 2000) } });
  }

  if (assigneeId !== user.id) {
    await notify([assigneeId], {
      type: "task_assigned",
      title: "Nova atividade atribuída a você",
      body: d.title,
      link: "/atividades",
    });
  }

  emitAppEvent({
    kind: "task_created",
    workspaceId: user.workspaceId,
    actorId: user.id,
    actorName: user.name,
    entity: d.title,
    link: "/atividades",
  });

  revalidatePath("/atividades");
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

const concludeSchema = z.object({
  report: z.string().min(5, "Descreva o que foi feito (relato de execução)."),
});

// Conclui a atividade com relato de execução (obrigatório).
export async function concludeAtividade(taskId: string, _prev: AtividadeActionState, formData: FormData): Promise<AtividadeActionState> {
  const user = await requireUser();
  const parsed = concludeSchema.safeParse({ report: formData.get("report") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: user.workspaceId },
    select: { id: true, column: true, doneAt: true },
  });
  if (!task) return { error: "Atividade não encontrada." };

  await db.task.update({
    where: { id: taskId },
    data: {
      column: "done",
      doneAt: task.column === "done" ? task.doneAt : new Date(),
      report: parsed.data.report.trim().slice(0, 5000),
    },
  });

  revalidatePath("/atividades");
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Atualiza só o relato (ex.: corrigir texto depois de concluir).
export async function updateReport(taskId: string, report: string): Promise<AtividadeActionState> {
  const user = await requireUser();
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!task) return { error: "Atividade não encontrada." };
  const r = report.trim();
  if (r.length < 5) return { error: "Relato muito curto." };
  await db.task.update({ where: { id: taskId }, data: { report: r.slice(0, 5000) } });
  revalidatePath("/atividades");
  return { ok: true };
}

// ---------- Editar / excluir ----------

// Opções do formulário de edição, buscadas quando o usuário clica em "Editar" —
// não valem o custo de vir junto com a lista inteira de atividades.
export interface OpcoesAtividade {
  tipos: { id: string; nome: string }[];
  projetos: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
}

export async function opcoesAtividadeAction(): Promise<OpcoesAtividade> {
  const user = await requireUser();
  const [tipos, projetos, usuarios] = await Promise.all([
    db.taskType.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
    db.project.findMany({
      where: { workspaceId: user.workspaceId, status: { not: "done" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.user.findMany({ where: { workspaceId: user.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    tipos: tipos.map((t) => ({ id: t.id, nome: t.name })),
    projetos: projetos.map((p) => ({ id: p.id, nome: p.name })),
    usuarios: usuarios.map((u) => ({ id: u.id, nome: u.name })),
  };
}

const editSchema = z.object({
  title: z.string().min(2, "Informe um título").optional(),
  tipoId: z.string().min(1).optional(),
  priority: z.enum(["high", "med", "low"]).optional(),
  origem: z.enum(["planejada", "avulsa", "presencial"]).optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  ixcClienteId: z.string().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(60000).nullable().optional(),
  realMinutes: z.coerce.number().int().min(1).max(60000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});
export type EditAtividadeInput = z.input<typeof editSchema>;

// Edita a atividade. Campo ausente = não mexe; `null` = limpa.
//
// `realMinutes` só vale pra atividade concluída, e é aplicado do mesmo jeito da
// criação: move o startedAt, mantendo doneAt − startedAt igual ao informado. Sem
// isso, corrigir um tempo lançado errado exigiria mexer no banco.
export async function editAtividade(taskId: string, input: EditAtividadeInput): Promise<AtividadeActionState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: user.workspaceId },
    select: { id: true, doneAt: true },
  });
  if (!task) return { error: "Atividade não encontrada." };

  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title.trim();
  if (d.priority !== undefined) data.priority = d.priority;
  if (d.origem !== undefined) data.origem = d.origem;
  if (d.estimatedMinutes !== undefined) data.estimatedMinutes = d.estimatedMinutes;
  if (d.dueDate !== undefined) data.dueDate = d.dueDate ? new Date(d.dueDate + "T12:00:00") : null;

  if (d.tipoId !== undefined) {
    const tipo = await db.taskType.findFirst({ where: { id: d.tipoId, active: true }, select: { id: true } });
    if (!tipo) return { error: "Tipo inválido." };
    data.tipoId = tipo.id;
  }
  if (d.projectId !== undefined) {
    if (d.projectId === null || d.projectId === "") data.projectId = null;
    else {
      const p = await db.project.findFirst({ where: { id: d.projectId, workspaceId: user.workspaceId }, select: { id: true } });
      if (!p) return { error: "Projeto inválido." };
      data.projectId = p.id;
    }
  }
  if (d.ixcClienteId !== undefined) {
    if (d.ixcClienteId === null || d.ixcClienteId === "") data.ixcClienteId = null;
    else {
      const c = await db.ixcCliente.findUnique({ where: { id: d.ixcClienteId }, select: { id: true } });
      if (!c) return { error: "Cliente inválido." };
      data.ixcClienteId = c.id;
    }
  }
  if (d.assigneeId !== undefined && d.assigneeId) {
    const u = await db.user.findFirst({ where: { id: d.assigneeId, workspaceId: user.workspaceId }, select: { id: true } });
    if (!u) return { error: "Responsável inválido." };
    data.assigneeId = u.id;
  }
  if (d.realMinutes !== undefined && d.realMinutes !== null) {
    if (!task.doneAt) return { error: "Só dá pra ajustar o tempo real de uma atividade concluída." };
    data.startedAt = new Date(task.doneAt.getTime() - d.realMinutes * 60_000);
  }

  if (Object.keys(data).length === 0) return { ok: true };
  await db.task.update({ where: { id: taskId }, data });
  revalidatePath("/atividades");
  revalidatePath("/kanban");
  revalidatePath("/reports");
  return { ok: true };
}

// Exclui a atividade. Comentários e subtarefas caem junto pelo cascade do schema.
export async function deleteAtividade(taskId: string): Promise<AtividadeActionState> {
  const user = await requireUser();
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!task) return { error: "Atividade não encontrada." };
  await db.task.delete({ where: { id: taskId } });
  revalidatePath("/atividades");
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}

// ---------- Clientes (busca + cadastro manual) ----------

export type ClienteHit = { id: string; razao: string; cnpjCpf: string | null; ixcId: string | null };

// Busca cliente no espelho local (IXC + manuais) por razão, CNPJ/CPF ou código IXC.
export async function searchClientes(q: string): Promise<ClienteHit[]> {
  await requireUser();
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const hits = await db.ixcCliente.findMany({
    where: {
      OR: [
        { razao: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ cnpjCpf: { contains: digits } }] : []),
        { ixcId: term },
      ],
    },
    take: 10,
    orderBy: { razao: "asc" },
    select: { id: true, razao: true, cnpjCpf: true, ixcId: true },
  });
  return hits;
}

const clienteSchema = z.object({
  razao: z.string().min(2, "Informe o nome/razão social"),
  cnpjCpf: z.string().optional(),
  uf: z.string().max(2).optional(),
});

export type ClienteCreateState = { ok?: boolean; error?: string; cliente?: ClienteHit };

// Cadastra cliente manual (fora do sync IXC — ixcId fica null, manual=true).
export async function createClienteManual(_prev: ClienteCreateState, formData: FormData): Promise<ClienteCreateState> {
  await requireUser();
  const parsed = clienteSchema.safeParse({
    razao: formData.get("razao"),
    cnpjCpf: formData.get("cnpjCpf") || undefined,
    uf: formData.get("uf") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const c = await db.ixcCliente.create({
    data: {
      manual: true,
      razao: parsed.data.razao.trim().slice(0, 200),
      cnpjCpf: parsed.data.cnpjCpf?.trim() || null,
      uf: parsed.data.uf?.trim().toUpperCase() || null,
    },
    select: { id: true, razao: true, cnpjCpf: true, ixcId: true },
  });
  return { ok: true, cliente: c };
}
