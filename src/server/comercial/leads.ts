// Backend de Leads (funil comercial). Server-only.
// Reads do board + lógica de ingest com dedup (chamada pela UI e pelo webhook
// POST /api/comercial/leads). Ver src/lib/leads.ts p/ estágios e normalizadores.
import "server-only";
import { db } from "@/lib/db";
import { LEAD_STAGES, isLeadStage, normDoc, normPhone, normEmail, type LeadStage } from "@/lib/leads";
import type { Prisma } from "@/generated/prisma";

export type LeadCard = {
  id: string;
  nome: string;
  empresa: string | null;
  cnpjCpf: string | null;
  contato: string | null;
  email: string | null;
  origem: string | null;
  valorEstimadoCents: number;
  observacoes: string | null;
  stage: LeadStage;
  motivoPerda: string | null;
  ixcClienteId: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  lastContactAt: Date;
  stageChangedAt: Date; // quando entrou no estágio atual (tempo em fila)
  finalizadoAt: Date | null; // atendimento encerrado no AtendAI (conversa completa já chegou)
  createdAt: Date;
};
export type LeadStageCol = { id: LeadStage; label: string; c: string; cards: LeadCard[]; total: number; valorCents: number };
export type LeadsBoard = { stages: LeadStageCol[]; total: number };

export async function getLeadsBoard(): Promise<LeadsBoard> {
  const leads = await db.lead.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
  const uids = [...new Set(leads.map((l) => l.assignedUserId).filter((x): x is string => !!x))];
  const users = uids.length ? await db.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.name]));

  const cols = new Map<LeadStage, LeadStageCol>(LEAD_STAGES.map((s) => [s.id, { id: s.id, label: s.label, c: s.c, cards: [], total: 0, valorCents: 0 }]));
  for (const l of leads) {
    const stage: LeadStage = isLeadStage(l.stage) ? l.stage : "novo";
    const col = cols.get(stage)!;
    col.cards.push({
      id: l.id, nome: l.nome, empresa: l.empresa, cnpjCpf: l.cnpjCpf, contato: l.contato, email: l.email,
      origem: l.origem, valorEstimadoCents: l.valorEstimadoCents, observacoes: l.observacoes, stage, motivoPerda: l.motivoPerda,
      ixcClienteId: l.ixcClienteId, assignedUserId: l.assignedUserId, assignedUserName: l.assignedUserId ? uMap.get(l.assignedUserId) ?? null : null,
      lastContactAt: l.lastContactAt, stageChangedAt: l.stageChangedAt, finalizadoAt: l.finalizadoAt, createdAt: l.createdAt,
    });
    col.total += 1;
    col.valorCents += l.valorEstimadoCents;
  }
  return { stages: [...cols.values()], total: leads.length };
}

// ── Ingest + dedup ───────────────────────────────────────────────────────────
export type LeadInput = {
  nome: string;
  empresa?: string | null;
  cnpjCpf?: string | null;
  contato?: string | null;
  email?: string | null;
  origem?: string | null;
  valorEstimadoCents?: number;
  observacoes?: string | null;
  externalId?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;     // hint p/ casar atendente AtendAI → User (por nome)
  assignedUserEmail?: string | null;    // hint p/ casar por e-mail (prioritário)
  assignedUserUsername?: string | null; // hint AtendAI: username == prefixo do e-mail no OpenBoard
  mensagens?: LeadMensagemInput[] | null; // conversa do AtendAI (acumula, dedup por externalId)
  eventoUltimo?: string | null;           // tipo do último evento do AtendAI
  finalizado?: boolean;                   // evento de finalização do atendimento
  payload?: unknown;
};

export type LeadMensagemInput = {
  externalId: string;              // id da mensagem no AtendAI
  mensagem: string;
  remetente?: string | null;
  tipo?: string | null;
  mensagemBot?: boolean;
  sentAt?: Date | null;
};

// Extrai mensagens do payload cru do AtendAI (`payload.data.mensagensAtendimento`).
// Usado p/ backfill de leads antigos (criados antes da tabela LeadMensagem existir).
export function extractMensagensFromPayload(payload: unknown): LeadMensagemInput[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const arr = data && Array.isArray(data.mensagensAtendimento) ? (data.mensagensAtendimento as Record<string, unknown>[]) : [];
  return arr
    .filter((m) => m.id != null && typeof m.mensagem === "string" && m.mensagem)
    .map((m) => ({
      externalId: String(m.id),
      mensagem: String(m.mensagem),
      remetente: typeof m.remetente === "string" ? m.remetente : null,
      tipo: typeof m.tipo_mensagem === "string" ? m.tipo_mensagem : null,
      mensagemBot: m.mensagem_bot === true || m.mensagem_ia === true,
      sentAt: typeof m.data_envio === "string" ? new Date(m.data_envio) : null,
    }));
}

// Garante que as mensagens do lead estão na tabela; se vazias, backfill do payload.
export async function ensureMensagens(leadId: string, payload?: unknown): Promise<void> {
  const n = await db.leadMensagem.count({ where: { leadId } });
  if (n > 0) return;
  const fromPayload = extractMensagensFromPayload(payload);
  if (fromPayload.length) await upsertMensagens(leadId, fromPayload);
}

// Grava/atualiza as mensagens da conversa, dedup por externalId (id do AtendAI).
// Chamada tanto no create quanto no re-toque → acumula entre re-entradas de fila.
async function upsertMensagens(leadId: string, mensagens?: LeadMensagemInput[] | null): Promise<void> {
  if (!mensagens?.length) return;
  for (const m of mensagens) {
    if (!m.externalId || !m.mensagem) continue;
    const data = {
      remetente: m.remetente ?? null,
      mensagem: m.mensagem,
      tipo: m.tipo ?? null,
      mensagemBot: !!m.mensagemBot,
      sentAt: m.sentAt ?? null,
    };
    await db.leadMensagem.upsert({
      where: { externalId: m.externalId },
      create: { leadId, externalId: m.externalId, ...data },
      update: { leadId, ...data },
    });
  }
}

// Resolve o responsável: id > e-mail > username(==prefixo e-mail) > nome exato > nome começa-com. null se não achar.
async function resolveAssignedUserId(input: Pick<LeadInput, "assignedUserId" | "assignedUserName" | "assignedUserEmail" | "assignedUserUsername">): Promise<string | null> {
  if (input.assignedUserId) return input.assignedUserId;
  const email = input.assignedUserEmail?.trim().toLowerCase();
  if (email) {
    const u = await db.user.findFirst({ where: { email }, select: { id: true } });
    if (u) return u.id;
  }
  // username do AtendAI ("cesar.augusto") == prefixo do e-mail no OpenBoard ("cesar.augusto@...").
  const username = input.assignedUserUsername?.trim().toLowerCase();
  if (username) {
    const u = await db.user.findFirst({ where: { email: { startsWith: `${username}@`, mode: "insensitive" } }, select: { id: true } });
    if (u) return u.id;
  }
  const name = input.assignedUserName?.trim();
  if (name) {
    // nome exato
    const exact = await db.user.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (exact) return exact.id;
    // AtendAI manda só o 1º nome (ex. "Cesar") → casa com User cujo nome começa com isso ("Cesar Marinho").
    const starts = await db.user.findFirst({ where: { name: { startsWith: name, mode: "insensitive" } }, select: { id: true } });
    if (starts) return starts.id;
  }
  return null;
}
export type IngestResult = { created: boolean; id: string; matchedBy: string | null };

// Procura um lead já existente pelas chaves de dedup (ordem de força).
export async function findDuplicateLead(input: { externalId?: string | null; cnpjCpf?: string | null; contato?: string | null; email?: string | null }): Promise<{ id: string; by: string } | null> {
  if (input.externalId) {
    const l = await db.lead.findFirst({ where: { externalId: input.externalId }, select: { id: true } });
    if (l) return { id: l.id, by: "externalId" };
  }
  const doc = normDoc(input.cnpjCpf);
  if (doc) {
    const l = await db.lead.findFirst({ where: { cnpjCpfNorm: doc }, select: { id: true } });
    if (l) return { id: l.id, by: "cnpjCpf" };
  }
  const phone = normPhone(input.contato);
  if (phone) {
    const l = await db.lead.findFirst({ where: { contatoNorm: phone }, select: { id: true } });
    if (l) return { id: l.id, by: "contato" };
  }
  const email = normEmail(input.email);
  if (email) {
    const l = await db.lead.findFirst({ where: { emailNorm: email }, select: { id: true } });
    if (l) return { id: l.id, by: "email" };
  }
  return null;
}

// Casa um doc (CPF/CNPJ normalizado) a um cliente IXC. IxcCliente.cnpjCpf vem
// formatado, então normaliza em JS (varredura — ok p/ volume baixo de ingest).
async function matchIxcClienteByDoc(doc: string | null): Promise<string | null> {
  if (!doc) return null;
  const clientes = await db.ixcCliente.findMany({ where: { cnpjCpf: { not: null } }, select: { ixcId: true, cnpjCpf: true } });
  const hit = clientes.find((c) => (c.cnpjCpf ?? "").replace(/\D/g, "") === doc);
  return hit?.ixcId ?? null;
}

// Cria um lead OU, se já existir (dedup), registra um novo "toque" e retorna o existente.
// Idempotente o suficiente p/ ser chamado direto pelo webhook do chat.
export async function ingestLead(input: LeadInput): Promise<IngestResult> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("nome é obrigatório");

  const assignedUserId = await resolveAssignedUserId(input);

  const dup = await findDuplicateLead(input);
  if (dup) {
    const atual = await db.lead.findUnique({ where: { id: dup.id }, select: { observacoes: true } });
    const carimbo = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] novo contato via ${input.origem ?? "ingest"}${input.observacoes ? `: ${input.observacoes}` : ""}`;
    const observacoes = [atual?.observacoes, carimbo].filter(Boolean).join("\n");
    // re-toque: atualiza o responsável se veio um atendente (reflete quem assumiu agora).
    await db.lead.update({
      where: { id: dup.id },
      data: {
        lastContactAt: new Date(),
        observacoes,
        ...(assignedUserId ? { assignedUserId } : {}),
        ...(input.eventoUltimo ? { eventoUltimo: input.eventoUltimo } : {}),
        ...(input.finalizado ? { finalizadoAt: new Date() } : {}),
      },
    });
    await upsertMensagens(dup.id, input.mensagens);
    return { created: false, id: dup.id, matchedBy: dup.by };
  }

  const doc = normDoc(input.cnpjCpf);
  const ixcClienteId = await matchIxcClienteByDoc(doc);
  const max = await db.lead.aggregate({ where: { stage: "novo" }, _max: { order: true } });

  const lead = await db.lead.create({
    data: {
      nome,
      empresa: input.empresa?.trim() || null,
      cnpjCpf: input.cnpjCpf?.trim() || null,
      cnpjCpfNorm: doc,
      contato: input.contato?.trim() || null,
      contatoNorm: normPhone(input.contato),
      email: input.email?.trim() || null,
      emailNorm: normEmail(input.email),
      origem: input.origem?.trim() || null,
      externalId: input.externalId?.trim() || null,
      valorEstimadoCents: Math.max(0, Math.round(input.valorEstimadoCents ?? 0)),
      observacoes: input.observacoes?.trim() || null,
      stage: "novo",
      order: (max._max.order ?? 0) + 1,
      ixcClienteId,
      assignedUserId: assignedUserId || null,
      eventoUltimo: input.eventoUltimo || null,
      finalizadoAt: input.finalizado ? new Date() : null,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  await upsertMensagens(lead.id, input.mensagens);
  // histórico: entrada no funil (base dos relatórios de tempo em fila)
  await db.leadStageEvent.create({ data: { leadId: lead.id, fromStage: null, toStage: "novo" } });
  return { created: true, id: lead.id, matchedBy: null };
}

// Move o lead de estágio registrando o histórico (única forma correta de mudar stage).
// motivoPerda: gravado ao entrar em "perdido"; limpo ao sair (lead reaberto).
export async function changeLeadStage(id: string, stage: LeadStage, movedByUserId?: string | null, motivoPerda?: string | null): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id }, select: { stage: true } });
  if (!lead || lead.stage === stage) return;
  const max = await db.lead.aggregate({ where: { stage }, _max: { order: true } });
  const motivo = stage === "perdido" ? (motivoPerda?.trim() || null) : null;
  await db.$transaction([
    db.lead.update({ where: { id }, data: { stage, stageChangedAt: new Date(), order: (max._max.order ?? 0) + 1, motivoPerda: motivo } }),
    db.leadStageEvent.create({ data: { leadId: id, fromStage: lead.stage, toStage: stage, movedByUserId: movedByUserId ?? null } }),
  ]);
}

// Ordena a conversa cronologicamente. Chave primária = id numérico do AtendAI
// (externalId; auto-incremento, sempre presente) — robusto quando `sentAt` (data_envio)
// vem null p/ parte das mensagens (nesse caso `sentAt asc` do Postgres jogava os null
// pro fim e bagunçava a ordem). Fallback: sentAt, depois createdAt.
export function sortConversa<T extends { externalId: string; sentAt: Date | null; createdAt: Date }>(ms: T[]): T[] {
  return [...ms].sort((a, b) => {
    const na = Number(a.externalId), nb = Number(b.externalId);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    const ta = a.sentAt?.getTime() ?? a.createdAt.getTime();
    const tb = b.sentAt?.getTime() ?? b.createdAt.getTime();
    return ta - tb;
  });
}

// Detalhe de um lead p/ a página /comercial/leads/[id]: lead + conversa + responsável.
// Se o lead não tem mensagens na tabela (criado antes da feature), faz backfill do payload.
export type LeadStageHistItem = { id: string; fromStage: string | null; toStage: string; movedByName: string | null; at: Date; durationMs: number | null };

export async function getLeadDetail(id: string) {
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return null;
  await ensureMensagens(id, lead.payload);
  const [raw, user, events] = await Promise.all([
    db.leadMensagem.findMany({ where: { leadId: id } }),
    lead.assignedUserId ? db.user.findUnique({ where: { id: lead.assignedUserId }, select: { name: true } }) : Promise.resolve(null),
    db.leadStageEvent.findMany({ where: { leadId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  const moverIds = [...new Set(events.map((e) => e.movedByUserId).filter((x): x is string => !!x))];
  const movers = moverIds.length ? await db.user.findMany({ where: { id: { in: moverIds } }, select: { id: true, name: true } }) : [];
  const mMap = new Map(movers.map((u) => [u.id, u.name]));
  // duração em cada estágio = intervalo até o próximo evento (último = até agora)
  const historico: LeadStageHistItem[] = events.map((e, i) => ({
    id: e.id,
    fromStage: e.fromStage,
    toStage: e.toStage,
    movedByName: e.movedByUserId ? mMap.get(e.movedByUserId) ?? null : null,
    at: e.createdAt,
    durationMs: (i < events.length - 1 ? events[i + 1].createdAt.getTime() : Date.now()) - e.createdAt.getTime(),
  }));
  return { lead, mensagens: sortConversa(raw), assignedUserName: user?.name ?? null, historico };
}
