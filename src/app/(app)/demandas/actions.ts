"use server";

// Ações de demanda usadas por todas as telas. A regra mora em
// src/server/demandas.ts; aqui é só sessão, validação de entrada e revalidação.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAnyToolUser, TOOLS_DEMANDA } from "@/lib/permissions";
import {
  criarDemanda,
  atribuirDemanda,
  mudarStatusDemanda,
  getDemanda,
  type DemandaDetalhe,
  type Resultado,
} from "@/server/demandas";

const ORIGENS = ["planejada", "avulsa", "presencial", "whatsapp", "telefone", "monitoramento"] as const;
const STATUS = ["todo", "doing", "waiting", "done", "canceled"] as const;

function revalida(projectId?: string | null) {
  for (const p of ["/dashboard", "/atividades", "/kanban", "/reports"]) revalidatePath(p);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

const novaSchema = z.object({
  title: z.string().trim().min(2, "Escreva o que precisa ser feito.").max(200),
  description: z.string().max(5000).nullish(),
  solicitante: z.string().max(120).nullish(),
  origem: z.enum(ORIGENS),
  priority: z.enum(["high", "med", "low"]),
  assigneeId: z.string().nullish(),
  tipoId: z.string().nullish(),
  projectId: z.string().nullish(),
  ixcClienteId: z.string().nullish(),
  dueDate: z.string().nullish(),
  estimatedMinutes: z.coerce.number().int().min(1).max(60000).nullish(),
  iniciar: z.boolean().optional(),
  jaFeita: z.object({ realMinutes: z.coerce.number().int().min(1).max(60000), solucao: z.string() }).nullish(),
});
export type NovaDemandaInput = z.input<typeof novaSchema>;

export async function criarDemandaAction(input: NovaDemandaInput): Promise<Resultado<{ id: string; numero: number }>> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const parsed = novaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await criarDemanda(user, parsed.data);
  if (r.ok) revalida(parsed.data.projectId);
  return r;
}

export async function atribuirDemandaAction(taskId: string, assigneeId: string | null): Promise<Resultado> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const r = await atribuirDemanda(user, taskId, assigneeId || null);
  if (r.ok) revalida();
  return r;
}

export async function mudarStatusAction(
  taskId: string,
  para: string,
  extra: { solucao?: string; motivo?: string } = {},
): Promise<Resultado> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const status = z.enum(STATUS).safeParse(para);
  if (!status.success) return { ok: false, error: "Status inválido." };
  const r = await mudarStatusDemanda(user, taskId, status.data, extra);
  if (r.ok) revalida();
  return r;
}

export async function carregarDemandaAction(numero: number): Promise<DemandaDetalhe | null> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return getDemanda(user.workspaceId, numero);
}

const editaSchema = z.object({
  title: z.string().trim().min(2, "Título muito curto.").max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  solicitante: z.string().max(120).nullable().optional(),
  origem: z.enum(ORIGENS).optional(),
  priority: z.enum(["high", "med", "low"]).optional(),
  tipoId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  ixcClienteId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(60000).nullable().optional(),
  solucao: z.string().trim().min(5, "Solução muito curta.").max(5000).optional(),
  // Só pra demanda resolvida: corrige o tempo gasto movendo o início.
  realMinutes: z.coerce.number().int().min(1).max(60000).optional(),
});
export type EditaDemandaInput = z.input<typeof editaSchema>;

// Edita campos descritivos. Campo ausente = não mexe; null = limpa. Status e
// responsável NÃO passam por aqui — têm ação própria, com histórico e aviso.
export async function editarDemandaAction(taskId: string, input: EditaDemandaInput): Promise<Resultado> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const parsed = editaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ws = user.workspaceId;

  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: ws }, select: { id: true, column: true, doneAt: true, projectId: true } });
  if (!task) return { ok: false, error: "Demanda não encontrada." };

  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description?.trim() || null;
  if (d.solicitante !== undefined) data.solicitante = d.solicitante?.trim() || null;
  if (d.origem !== undefined) data.origem = d.origem;
  if (d.priority !== undefined) data.priority = d.priority;
  if (d.estimatedMinutes !== undefined) data.estimatedMinutes = d.estimatedMinutes;
  if (d.dueDate !== undefined) {
    if (d.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return { ok: false, error: "Prazo inválido." };
    data.dueDate = d.dueDate ? new Date(`${d.dueDate}T12:00:00`) : null;
  }
  if (d.tipoId !== undefined) {
    if (d.tipoId && !(await db.taskType.findFirst({ where: { id: d.tipoId, active: true }, select: { id: true } }))) {
      return { ok: false, error: "Tipo inválido." };
    }
    data.tipoId = d.tipoId || null;
  }
  if (d.projectId !== undefined) {
    if (d.projectId && !(await db.project.findFirst({ where: { id: d.projectId, workspaceId: ws }, select: { id: true } }))) {
      return { ok: false, error: "Projeto inválido." };
    }
    data.projectId = d.projectId || null;
  }
  if (d.ixcClienteId !== undefined) {
    if (d.ixcClienteId && !(await db.ixcCliente.findUnique({ where: { id: d.ixcClienteId }, select: { id: true } }))) {
      return { ok: false, error: "Cliente inválido." };
    }
    data.ixcClienteId = d.ixcClienteId || null;
  }
  if (d.solucao !== undefined) {
    if (task.column !== "done") return { ok: false, error: "Só dá pra editar a solução de uma demanda resolvida." };
    data.report = d.solucao;
  }
  if (d.realMinutes !== undefined) {
    if (!task.doneAt) return { ok: false, error: "Só dá pra ajustar o tempo de uma demanda resolvida." };
    data.startedAt = new Date(+task.doneAt - d.realMinutes * 60_000);
  }

  if (Object.keys(data).length) await db.task.update({ where: { id: taskId }, data });
  revalida(task.projectId);
  return { ok: true };
}

// Excluir apaga histórico e some dos relatórios — é correção de engano, não
// encerramento. O caminho normal pra demanda que não vai ser feita é Cancelar.
export async function excluirDemandaAction(taskId: string): Promise<Resultado> {
  const user = await requireAnyToolUser(TOOLS_DEMANDA);
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: user.workspaceId },
    select: { id: true, creatorId: true, projectId: true },
  });
  if (!task) return { ok: false, error: "Demanda não encontrada." };
  if (user.role !== "admin" && task.creatorId !== user.id) {
    return { ok: false, error: "Só quem abriu a demanda ou um administrador pode excluir. Use Cancelar." };
  }
  await db.task.delete({ where: { id: taskId } });
  revalida(task.projectId);
  return { ok: true };
}
