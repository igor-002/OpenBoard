// Escrita no GLPI (fase 2). Cria chamado, posta acompanhamento, muda status e
// atribui responsável — sempre re-espelhando o chamado afetado no mirror local.
// Requer que o perfil do usuário de serviço tenha DIREITO DE ESCRITA no GLPI
// (o v1 era só-leitura); sem isso a API responde ERROR_RIGHT_MISSING.
import "server-only";
import { glpiPost, glpiPatch, glpiDelete, DEFAULT_ENTITY_ID, TRACKED_USER_IDS } from "@/lib/glpi";
import { syncOneTicket } from "./sync";

// Posta um acompanhamento (followup) no chamado.
export async function addFollowup(glpiId: number, content: string, isPrivate = false): Promise<void> {
  const body = content.trim();
  if (!body) throw new Error("Acompanhamento vazio.");
  await glpiPost(`/Assistance/Ticket/${glpiId}/Timeline/Followup`, { content: body, is_private: isPrivate });
  await syncOneTicket(glpiId);
}

export interface CreateTicketInput {
  name: string;
  content: string;
  requesterId: number; // deve ser um dos GLPI_TRACKED_USER_IDS (senão some do mirror no próximo full sync)
  type?: number; // 1 Incidente, 2 Requisição (default)
  urgency?: number; // 1..5 (default 3)
}

// Cria um chamado no GLPI (entidade Marketing) e retorna o id novo.
export async function createTicket(input: CreateTicketInput): Promise<number | null> {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) throw new Error("Título obrigatório.");
  if (!TRACKED_USER_IDS.includes(input.requesterId)) {
    throw new Error("Solicitante inválido (precisa ser um usuário rastreado do marketing).");
  }
  const created = await glpiPost<{ id?: number }>(`/Assistance/Ticket`, {
    name,
    content,
    entity: { id: DEFAULT_ENTITY_ID },
    type: input.type ?? 2,
    urgency: input.urgency ?? 3,
    user_recipient: { id: input.requesterId },
  });
  const newId = created?.id ?? null;
  if (newId) await syncOneTicket(newId);
  return newId;
}

// Muda o status do chamado (1 Novo, 2 Em atend., 4 Pendente, 5 Solucionado, 6 Fechado).
export async function updateStatus(glpiId: number, statusId: number): Promise<void> {
  await glpiPatch(`/Assistance/Ticket/${glpiId}`, { status: { id: statusId } });
  await syncOneTicket(glpiId);
}

// Atribui um técnico (role=assigned) ao chamado.
export async function setAssignee(glpiId: number, userId: number, role = "assigned"): Promise<void> {
  await glpiPost(`/Assistance/Ticket/${glpiId}/TeamMember`, { type: "User", id: userId, role });
  await syncOneTicket(glpiId);
}

// Remove um técnico do chamado.
export async function removeAssignee(glpiId: number, userId: number, role = "assigned"): Promise<void> {
  await glpiDelete(`/Assistance/Ticket/${glpiId}/TeamMember`, { type: "User", id: userId, role });
  await syncOneTicket(glpiId);
}
