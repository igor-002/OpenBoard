"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestLead } from "@/server/comercial/leads";
import { analisarConversaLead } from "@/server/comercial/analise";
import { isLeadStage } from "@/lib/leads";

export type LeadActionState = { ok?: boolean; error?: string; id?: string; created?: boolean; matchedBy?: string | null };

// Criação manual de lead pela UI — passa pelo mesmo ingest (com dedup) do webhook.
export async function createLeadManual(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  await requireUser();
  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 2) return { error: "Informe o nome do lead." };
  const valorStr = String(formData.get("valor") ?? "").replace(",", ".");
  const r = await ingestLead({
    nome,
    empresa: String(formData.get("empresa") ?? "") || null,
    cnpjCpf: String(formData.get("cnpjCpf") ?? "") || null,
    contato: String(formData.get("contato") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    origem: String(formData.get("origem") ?? "") || "manual",
    valorEstimadoCents: Math.round((parseFloat(valorStr) || 0) * 100),
    observacoes: String(formData.get("observacoes") ?? "") || null,
  });
  revalidatePath("/comercial/leads");
  return { ok: true, id: r.id, created: r.created, matchedBy: r.matchedBy };
}

// Move um lead para outro estágio (drag no Kanban).
export async function moveLeadStage(id: string, stage: string): Promise<LeadActionState> {
  await requireUser();
  if (!isLeadStage(stage)) return { error: "Estágio inválido." };
  const max = await db.lead.aggregate({ where: { stage }, _max: { order: true } });
  await db.lead.update({ where: { id }, data: { stage, order: (max._max.order ?? 0) + 1 } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

// Define o responsável do lead.
export async function assignLead(id: string, userId: string | null): Promise<LeadActionState> {
  await requireUser();
  await db.lead.update({ where: { id }, data: { assignedUserId: userId || null } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

export async function deleteLead(id: string): Promise<LeadActionState> {
  await requireAdmin();
  await db.lead.delete({ where: { id } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

// Roda a análise IA da conversa do lead (sob demanda, pela página de detalhe).
export async function analisarLead(id: string): Promise<LeadActionState> {
  await requireUser();
  const r = await analisarConversaLead(id);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/comercial/leads/${id}`);
  return { ok: true };
}
