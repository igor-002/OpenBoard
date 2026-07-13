"use server";

import { revalidatePath } from "next/cache";
import { requireModuleUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { notify } from "@/server/notifications";
import { emitAppEvent } from "@/server/events";

export type CrossActionState = { ok?: boolean; error?: string; id?: string };

// B1 ⭐ — cria projeto de implantação (onboarding) a partir de um cliente IXC.
// Lead = User vinculado ao vendedor do contrato mais recente (se houver). Idempotente.
export async function createOnboardingProject(clienteIxcId: string): Promise<CrossActionState> {
  const user = await requireModuleUser("comercial");
  const cliente = await db.ixcCliente.findUnique({ where: { ixcId: clienteIxcId }, select: { razao: true } });
  if (!cliente) return { error: "Cliente não encontrado." };

  const existing = await db.project.findFirst({ where: { workspaceId: user.workspaceId, ixcClienteId: clienteIxcId }, select: { id: true } });
  if (existing) return { ok: true, id: existing.id };

  const contrato = await db.contrato.findFirst({ where: { clienteIxcId, vendedorIxcId: { not: null } }, orderBy: { dataCadastro: "desc" }, select: { vendedorIxcId: true } });
  let leadUserId: string | null = null;
  if (contrato?.vendedorIxcId) {
    const v = await db.vendedor.findUnique({ where: { ixcId: contrato.vendedorIxcId }, select: { userId: true } });
    if (v?.userId) {
      const inWs = await db.user.findFirst({ where: { id: v.userId, workspaceId: user.workspaceId }, select: { id: true } });
      leadUserId = inWs?.id ?? null;
    }
  }

  const created = await db.project.create({
    data: {
      workspaceId: user.workspaceId,
      name: `Implantação — ${cliente.razao}`,
      client: cliente.razao,
      tag: "Onboarding",
      status: "planned",
      startDate: new Date(),
      ixcClienteId: clienteIxcId,
      creatorId: user.id,
      members: leadUserId ? { create: [{ userId: leadUserId, isLead: true, order: 0 }] } : undefined,
    },
  });

  if (leadUserId && leadUserId !== user.id) {
    await notify([leadUserId], { type: "project_member", title: "Projeto de implantação criado", body: created.name, link: `/projects/${created.id}` });
  }
  emitAppEvent({ kind: "project_created", workspaceId: user.workspaceId, actorId: user.id, actorName: user.name, entity: created.name, link: `/projects/${created.id}` });

  revalidatePath("/comercial/clientes");
  revalidatePath(`/comercial/clientes/${clienteIxcId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true, id: created.id };
}

// A2 — vincula/desvincula um projeto existente do workspace a um cliente IXC.
export async function linkProjectToCliente(projectId: string, clienteIxcId: string | null): Promise<CrossActionState> {
  const user = await requireModuleUser("comercial");
  const p = await db.project.findFirst({ where: { id: projectId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!p) return { error: "Projeto não encontrado." };
  await db.project.update({ where: { id: projectId }, data: { ixcClienteId: clienteIxcId } });
  if (clienteIxcId) revalidatePath(`/comercial/clientes/${clienteIxcId}`);
  revalidatePath("/comercial/clientes");
  return { ok: true };
}

// B2/B3 — cria tarefa de cobrança/retenção num projeto vinculado ao cliente.
export async function criarTarefaCobranca(projectId: string, titulo: string): Promise<CrossActionState> {
  const user = await requireModuleUser("comercial");
  const p = await db.project.findFirst({ where: { id: projectId, workspaceId: user.workspaceId }, select: { id: true, name: true, ixcClienteId: true } });
  if (!p) return { error: "Projeto não encontrado." };
  const t = titulo.trim();
  if (t.length < 2) return { error: "Informe um título." };

  const max = await db.task.aggregate({ where: { projectId, column: "todo" }, _max: { order: true } });
  await db.task.create({
    data: { workspaceId: user.workspaceId, projectId, title: t, column: "todo", priority: "high", order: (max._max.order ?? 0) + 1 },
  });
  if (p.ixcClienteId) revalidatePath(`/comercial/clientes/${p.ixcClienteId}`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: projectId };
}
