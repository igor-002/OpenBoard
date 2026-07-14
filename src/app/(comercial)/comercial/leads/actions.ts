"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requireModuleUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ingestLead, changeLeadStage } from "@/server/comercial/leads";
import { analisarConversaLead } from "@/server/comercial/analise";
import { isLeadStage } from "@/lib/leads";
import { ANEXO_MAX_BYTES, ANEXO_MIME, sanitizeNomeArquivo, validaAnexo } from "@/lib/anexos";

export type LeadActionState = { ok?: boolean; error?: string; id?: string; created?: boolean; matchedBy?: string | null };

// Criação manual de lead pela UI — passa pelo mesmo ingest (com dedup) do webhook.
export async function createLeadManual(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  await requireModuleUser("leads");
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

// Move um lead para outro estágio (drag no Kanban) — registra histórico p/ relatórios.
export async function moveLeadStage(id: string, stage: string): Promise<LeadActionState> {
  const user = await requireModuleUser("leads");
  if (!isLeadStage(stage)) return { error: "Estágio inválido." };
  await changeLeadStage(id, stage, user.id);
  revalidatePath("/comercial/leads");
  return { ok: true };
}

// Atualiza o valor estimado (R$) — AtendAI não manda valor, então o time
// preenche na mão ao qualificar o lead.
export async function updateLeadValor(id: string, valorReais: number): Promise<LeadActionState> {
  await requireModuleUser("leads");
  if (!Number.isFinite(valorReais) || valorReais < 0) return { error: "Valor inválido." };
  await db.lead.update({ where: { id }, data: { valorEstimadoCents: Math.round(valorReais * 100) } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

// Define o responsável do lead.
export async function assignLead(id: string, userId: string | null): Promise<LeadActionState> {
  await requireModuleUser("leads");
  await db.lead.update({ where: { id }, data: { assignedUserId: userId || null } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

export async function deleteLead(id: string): Promise<LeadActionState> {
  await requireAdmin();
  // FK loose (sem cascade) → apaga mensagens, histórico e anexos antes p/ não deixar órfãos.
  await db.leadMensagem.deleteMany({ where: { leadId: id } });
  await db.leadStageEvent.deleteMany({ where: { leadId: id } });
  await db.leadAnexo.deleteMany({ where: { leadId: id } });
  await db.lead.delete({ where: { id } });
  revalidatePath("/comercial/leads");
  return { ok: true };
}

// ── Anexos (propostas em PDF) ────────────────────────────────────────────────
// Sobe o PDF da proposta pro lead. Bytes vão pro Postgres (model LeadAnexo).
export async function uploadLeadAnexo(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const user = await requireModuleUser("leads");
  const leadId = String(formData.get("leadId") ?? "");
  const file = formData.get("arquivo");
  if (!leadId) return { error: "Lead não informado." };
  if (!(file instanceof File)) return { error: "Selecione um arquivo PDF." };

  const erro = validaAnexo({ name: file.name, type: file.type, size: file.size });
  if (erro) return { error: erro };

  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { error: "Lead não encontrado." };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Confere a assinatura do PDF ("%PDF-"): o mime do browser é palpite, isso não é.
  if (bytes.length > ANEXO_MAX_BYTES) return { error: "Arquivo muito grande." };
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { error: "O arquivo não é um PDF válido." };

  await db.leadAnexo.create({
    data: {
      leadId,
      nome: sanitizeNomeArquivo(file.name),
      mime: ANEXO_MIME,
      tamanho: bytes.length,
      data: bytes,
      uploadedById: user.id,
    },
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  return { ok: true };
}

// Apaga o anexo — delete de verdade (a linha some, os bytes vão junto).
export async function deleteLeadAnexo(id: string): Promise<LeadActionState> {
  await requireModuleUser("leads");
  const anexo = await db.leadAnexo.findUnique({ where: { id }, select: { leadId: true } });
  if (!anexo) return { error: "Anexo não encontrado." };
  await db.leadAnexo.delete({ where: { id } });
  revalidatePath(`/comercial/leads/${anexo.leadId}`);
  return { ok: true };
}

// Roda a análise IA da conversa do lead (sob demanda, pela página de detalhe).
export async function analisarLead(id: string): Promise<LeadActionState> {
  await requireModuleUser("leads");
  const r = await analisarConversaLead(id);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/comercial/leads/${id}`);
  return { ok: true };
}
