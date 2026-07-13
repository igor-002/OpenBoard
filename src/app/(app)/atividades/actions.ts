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
  column: z.enum(["todo", "doing"]),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  ixcClienteId: z.string().optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(60000).optional(),
  dueDate: z.string().optional(),
  descricao: z.string().optional(),
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
    dueDate: formData.get("dueDate") || undefined,
    descricao: formData.get("descricao") || undefined,
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

  const count = await db.task.count({ where: { workspaceId: user.workspaceId, column: d.column } });
  const now = new Date();

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
      startedAt: d.column === "doing" ? now : null,
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
