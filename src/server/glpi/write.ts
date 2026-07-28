// Escrita no GLPI (fase 2). Cria chamado, posta acompanhamento, muda status e
// atribui responsável — sempre re-espelhando o chamado afetado no mirror local.
// Requer que o perfil do usuário de serviço tenha DIREITO DE ESCRITA no GLPI
// (o v1 era só-leitura); sem isso a API responde ERROR_RIGHT_MISSING.
import "server-only";
import { glpiPost, glpiPatch, glpiDelete, glpiGet, DEFAULT_ENTITY_ID, TRACKED_USER_IDS } from "@/lib/glpi";
import { db } from "@/lib/db";
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
  assigneeId?: number; // técnico que já sai atribuído (opcional)
  type?: number; // 1 Incidente, 2 Requisição (default)
  urgency?: number; // 1..5 (default 3)
  dueAt?: string | null; // prazo "YYYY-MM-DD". Guardado local + acompanhamento no GLPI.
  dueSetById?: string | null; // preenchido pela action com o usuário logado (nunca pelo cliente)
}

// Cria um chamado no GLPI (entidade Marketing) e retorna o id novo.
//
// ATENÇÃO ao solicitante: `user_recipient` é read-only na prática — o GLPI grava
// nele o usuário AUTENTICADO (o de serviço), ignorando o que a gente manda. O
// solicitante de verdade é um TeamMember role="requester". Sem isso o chamado
// nasce órfão: `attributedTrackedId` não acha requerente rastreado, cai no autor
// (o user de serviço, que não é rastreado) e o chamado SOME do espelho no próximo
// full sync.
export async function createTicket(input: CreateTicketInput): Promise<number | null> {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) throw new Error("Título obrigatório.");
  if (!TRACKED_USER_IDS.includes(input.requesterId)) {
    throw new Error("Solicitante inválido (precisa ser um usuário rastreado do marketing).");
  }
  const urgency = input.urgency ?? 3;
  const created = await glpiPost<{ id?: number }>(`/Assistance/Ticket`, {
    name,
    content,
    entity: { id: DEFAULT_ENTITY_ID },
    type: input.type ?? 2,
    urgency,
    // O GLPI normalmente recalcula priority a partir de urgency × impact; mandamos
    // junto pra escolha do formulário valer quando o cálculo estiver desligado.
    priority: urgency,
  });
  const newId = created?.id ?? null;
  if (!newId) return null;

  await addTeamMember(newId, input.requesterId, "requester");
  if (input.assigneeId) await addTeamMember(newId, input.assigneeId, "assigned");
  await syncOneTicket(newId);

  if (input.dueAt) await setTicketDue(newId, input.dueAt, input.dueSetById);
  return newId;
}

// Adiciona um ator ao chamado sem re-sincronizar (o chamador sincroniza no fim).
async function addTeamMember(glpiId: number, userId: number, role: string): Promise<void> {
  await glpiPost(`/Assistance/Ticket/${glpiId}/TeamMember`, { type: "User", id: userId, role });
}

// ── Prazo de conclusão ───────────────────────────────────────────────────────
// A API v2.1 não expõe campo de prazo no Ticket, então o prazo vive no espelho
// local (GlpiTicket.dueAt) e é anunciado no chamado por acompanhamento, pra quem
// acompanha só pelo GLPI enxergar. `null` remove o prazo.
export async function setTicketDue(glpiId: number, dueAt: string | null, userId?: string | null): Promise<void> {
  const due = parseDue(dueAt);

  const updated = await db.glpiTicket.updateMany({
    where: { glpiId },
    data: { dueAt: due, dueSetById: due ? (userId ?? null) : null },
  });
  if (updated.count === 0) throw new Error("Chamado não encontrado no espelho local.");

  await addFollowup(
    glpiId,
    due ? `Prazo para conclusão definido: ${due.toLocaleDateString("pt-BR")}.` : "Prazo para conclusão removido.",
  );
}

// "YYYY-MM-DD" do <input type="date"> vira meio-dia LOCAL — mesma convenção do
// quadro. Meia-noite viraria o dia anterior em fuso negativo.
function parseDue(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Prazo inválido.");
  return d;
}

// Muda o status do chamado (1 Novo, 2 Em atend., 4 Pendente, 5 Solucionado, 6 Fechado).
//
// CONFERE O RESULTADO. A API v2.1 marca `status.id` como readOnly: o PATCH volta
// 200 OK e o status NÃO muda — verificado com 5 formatos de payload × 5 status de
// destino (`urgency` no mesmo PATCH muda normal, então não é permissão; pela tela
// do GLPI o mesmo usuário consegue). Sem esta conferência a escrita "dá certo"
// silenciosamente, o espelho ressincroniza com o valor velho e quem chamou acha
// que mudou — foi assim que o arrastar do quadro passou a mentir.
export async function updateStatus(glpiId: number, statusId: number): Promise<void> {
  await glpiPatch(`/Assistance/Ticket/${glpiId}`, { status: { id: statusId } });
  await syncOneTicket(glpiId); // relê o chamado → espelho com o status REAL de agora
  const agora = await db.glpiTicket.findUnique({ where: { glpiId }, select: { statusId: true } });
  if (agora && agora.statusId !== statusId && !mesmoAtendimento(agora.statusId, statusId)) {
    throw new Error(
      `O GLPI aceitou a requisição mas manteve o status em "${STATUS_NOME[agora.statusId] ?? agora.statusId}". ` +
        `A API v2.1 não permite gravar status direto.`,
    );
  }
}

// 2 e 3 são "Em atendimento" (atribuído/planejado) — o GLPI escolhe entre os dois.
const mesmoAtendimento = (a: number, b: number) => [2, 3].includes(a) && [2, 3].includes(b);

const STATUS_NOME: Record<number, string> = {
  1: "Novo",
  2: "Em atendimento",
  3: "Em atendimento",
  4: "Pendente",
  5: "Solucionado",
  6: "Fechado",
};

// ── Status pelos MECANISMOS do GLPI ──────────────────────────────────────────
// Como `status` não é gravável, o jeito certo é provocar a CAUSA e deixar o GLPI
// calcular o status. Testado nesta instância em 2026-07-28:
//
//   remover o atribuído          → 1 Novo
//   atribuir um técnico          → 2 Em atendimento
//   registrar uma solução        → 5 Solucionado
//
// 4 (Pendente) e 6 (Fechado) não têm mecanismo equivalente na v2.1 — dependem da
// API v1 (ver glpi-api-v1-referencia.md). Uma vez Solucionado, atribuir/desatribuir
// deixa de mexer no status: o GLPI para de recalcular depois da resolução.
export type StatusMecanismo =
  | { status: 1 }
  | { status: 2; assigneeId: number }
  | { status: 5; solucao: string };

export function statusPrecisaDe(statusId: number): "nada" | "responsavel" | "solucao" | null {
  if (statusId === 1) return "nada";
  if (statusId === 2 || statusId === 3) return "responsavel";
  if (statusId === 5) return "solucao";
  return null; // 4 e 6: sem caminho na v2.1
}

export async function aplicarStatus(glpiId: number, m: StatusMecanismo): Promise<void> {
  if (m.status === 1) {
    const atuais = await glpiGet<{ id: number; role: string }>(`/Assistance/Ticket/${glpiId}/TeamMember`);
    const atribuidos = atuais.data.filter((x) => String(x.role ?? "").toLowerCase().includes("assigned"));
    if (!atribuidos.length) throw new Error("O chamado já está sem responsável — nada a fazer pra voltar a Novo.");
    for (const a of atribuidos) {
      await glpiDelete(`/Assistance/Ticket/${glpiId}/TeamMember`, { type: "User", id: a.id, role: "assigned" });
    }
  } else if (m.status === 2) {
    await addTeamMember(glpiId, m.assigneeId, "assigned");
  } else {
    const texto = m.solucao.trim();
    if (!texto) throw new Error("A solução não pode ficar vazia.");
    await glpiPost(`/Assistance/Ticket/${glpiId}/Timeline/Solution`, { content: texto });
  }

  await syncOneTicket(glpiId);
  const agora = await db.glpiTicket.findUnique({ where: { glpiId }, select: { statusId: true } });
  if (agora && agora.statusId !== m.status && !mesmoAtendimento(agora.statusId, m.status)) {
    throw new Error(
      `A ação foi aplicada, mas o GLPI deixou o chamado em "${STATUS_NOME[agora.statusId] ?? agora.statusId}" ` +
        `em vez de "${STATUS_NOME[m.status]}".`,
    );
  }
}

// Atribui um técnico (role=assigned) ao chamado.
export async function setAssignee(glpiId: number, userId: number, role = "assigned"): Promise<void> {
  await addTeamMember(glpiId, userId, role);
  await syncOneTicket(glpiId);
}

// Remove um técnico do chamado.
export async function removeAssignee(glpiId: number, userId: number, role = "assigned"): Promise<void> {
  await glpiDelete(`/Assistance/Ticket/${glpiId}/TeamMember`, { type: "User", id: userId, role });
  await syncOneTicket(glpiId);
}
