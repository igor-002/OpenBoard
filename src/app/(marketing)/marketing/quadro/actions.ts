"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ensureDefaultBoard,
  createCard,
  updateCard,
  deleteCard,
  moveCard,
  setCardLabels,
  createLabel,
  deleteLabel,
  contarCardsDaEtiqueta,
  addAttachment,
  deleteAttachment,
  createColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
  reorderColumn,
  setColumnGlpiStatus,
  type AttachmentDTO,
} from "@/server/marketing/board";
import { aplicarStatus, statusPrecisaDe, type StatusMecanismo } from "@/server/glpi/write";
import { getTicketDetail, type TicketDetail } from "@/server/glpi/detail";
import { v1AnexarNoChamado } from "@/lib/glpi-v1";
import { requireModuleUser } from "@/lib/permissions";

export type BoardActionState = { ok: boolean; error?: string; id?: string };
export type AttachmentActionState = { ok: boolean; error?: string; attachment?: AttachmentDTO };

const P = "/marketing/quadro";
function fail(e: unknown): BoardActionState {
  return { ok: false, error: e instanceof Error ? e.message : "Falha na operação." };
}

export async function createCardAction(input: {
  columnId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  kind?: "interna" | "glpi";
  glpiId?: number | null;
  labelIds?: string[];
}): Promise<BoardActionState> {
  const user = await requireUser();
  try {
    const dueAt = input.dueAt ? new Date(`${input.dueAt}T12:00:00`) : null;
    const r = await createCard({ ...input, dueAt, createdById: user.id });
    revalidatePath(P);
    return { ok: true, id: r.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCardAction(
  cardId: string,
  patch: { title?: string; description?: string | null; dueAt?: string | null; glpiId?: number | null; kind?: "interna" | "glpi" },
): Promise<BoardActionState> {
  await requireUser();
  try {
    const dueAt = patch.dueAt === undefined ? undefined : patch.dueAt ? new Date(`${patch.dueAt}T12:00:00`) : null;
    await updateCard(cardId, { ...patch, dueAt });
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCardAction(cardId: string): Promise<BoardActionState> {
  await requireUser();
  try {
    await deleteCard(cardId);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Mover card. Card de chamado indo pra coluna mapeada também muda o status no
// GLPI — mas como `status` não é gravável na v2.1, isso acontece provocando a
// CAUSA (atribuir alguém, remover o responsável, registrar solução). Por isso o
// cliente manda `extra` quando a coluna exige responsável ou solução.
//
// Falha no GLPI NÃO desfaz o move local: o card fica onde o usuário soltou e a
// mensagem explica. Desfazer em silêncio foi justamente o que escondeu o bug.
export async function moveCardAction(
  cardId: string,
  toColumnId: string,
  toIndex: number,
  extra?: { solucao?: string },
): Promise<BoardActionState> {
  await requireUser();
  let escrever: { glpiId: number; statusId: number } | null = null;
  try {
    escrever = await moveCard(cardId, toColumnId, toIndex);
    revalidatePath(P);
  } catch (e) {
    return fail(e);
  }
  if (!escrever) return { ok: true };

  const { glpiId, statusId } = escrever;
  let mecanismo: StatusMecanismo;
  if (statusPrecisaDe(statusId) === "solucao") {
    if (!extra?.solucao?.trim()) return { ok: false, error: "Descreva a solução para concluir o chamado." };
    mecanismo = { status: 5, solucao: extra.solucao };
  } else {
    mecanismo = { status: statusId };
  }

  try {
    await aplicarStatus(glpiId, mecanismo);
    revalidatePath(P);
    revalidatePath("/marketing/demandas");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return { ok: false, error: `Card movido, mas o chamado #${glpiId} não mudou de status: ${msg}` };
  }
}

// Detalhe AO VIVO do chamado, pro card do quadro mostrar descrição e linha do
// tempo sem mandar o usuário pra outra tela. Busca no GLPI (não no espelho), que
// é onde as interações ficam.
export async function carregarChamadoAction(glpiId: number): Promise<TicketDetail | null> {
  await requireUser();
  try {
    return await getTicketDetail(glpiId);
  } catch {
    return null;
  }
}

// Anexa um arquivo direto no chamado do GLPI (aparece na linha do tempo pra todo
// mundo que acompanha por lá). Diferente do anexo do cartão, que é interno do
// quadro e não sai daqui.
export async function anexarNoChamadoAction(form: FormData): Promise<BoardActionState> {
  await requireModuleUser("marketing");
  try {
    const glpiId = Number(form.get("glpiId"));
    const file = form.get("file");
    if (!Number.isInteger(glpiId) || glpiId <= 0) throw new Error("Chamado inválido.");
    if (!(file instanceof File)) throw new Error("Arquivo inválido.");
    if (file.size > MAX_ANEXO) throw new Error(`Arquivo acima de ${MAX_ANEXO / 1024 / 1024} MB.`);
    const bytes = Buffer.from(await file.arrayBuffer());
    await v1AnexarNoChamado(glpiId, { nome: file.name, mime: file.type, bytes });
    revalidatePath(P);
    revalidatePath(`/marketing/demandas/${glpiId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const MAX_ANEXO = 20 * 1024 * 1024;

// Quantos cartões usam a etiqueta — pra o aviso de exclusão dizer o tamanho do
// estrago antes de acontecer, em vez de depois.
export async function contarCardsDaEtiquetaAction(labelId: string): Promise<number> {
  await requireUser();
  try {
    return await contarCardsDaEtiqueta(labelId);
  } catch {
    return 0;
  }
}

export async function deleteLabelAction(labelId: string): Promise<BoardActionState> {
  await requireUser();
  try {
    await deleteLabel(labelId);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setColumnGlpiStatusAction(columnId: string, glpiStatusId: number | null): Promise<BoardActionState> {
  await requireUser();
  try {
    await setColumnGlpiStatus(columnId, glpiStatusId);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setCardLabelsAction(cardId: string, labelIds: string[]): Promise<BoardActionState> {
  await requireUser();
  try {
    await setCardLabels(cardId, labelIds);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createLabelAction(name: string, color: string): Promise<BoardActionState> {
  await requireUser();
  try {
    const boardId = await ensureDefaultBoard();
    const r = await createLabel(boardId, name, color);
    revalidatePath(P);
    return { ok: true, id: r.id };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadAttachmentAction(form: FormData): Promise<AttachmentActionState> {
  const user = await requireUser();
  try {
    const cardId = String(form.get("cardId") ?? "");
    const file = form.get("file");
    if (!cardId) throw new Error("Cartão inválido.");
    if (!(file instanceof File)) throw new Error("Arquivo inválido.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const attachment = await addAttachment({
      cardId,
      filename: file.name,
      mime: file.type,
      bytes,
      createdById: user.id,
    });
    revalidatePath(P);
    return { ok: true, attachment };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha no upload." };
  }
}

export async function createColumnAction(name: string): Promise<BoardActionState> {
  await requireUser();
  try {
    const boardId = await ensureDefaultBoard();
    const r = await createColumn(boardId, name);
    revalidatePath(P);
    return { ok: true, id: r.id };
  } catch (e) {
    return fail(e);
  }
}

export async function renameColumnAction(columnId: string, name: string): Promise<BoardActionState> {
  await requireUser();
  try {
    await renameColumn(columnId, name);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteColumnAction(columnId: string): Promise<BoardActionState> {
  await requireUser();
  try {
    await deleteColumn(columnId);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moveColumnAction(columnId: string, dir: -1 | 1): Promise<BoardActionState> {
  await requireUser();
  try {
    await moveColumn(columnId, dir);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderColumnAction(draggedId: string, targetId: string, before: boolean): Promise<BoardActionState> {
  await requireUser();
  try {
    await reorderColumn(draggedId, targetId, before);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type GlpiHit = { id: number; name: string; statusName: string };

// Autocomplete pro campo GLPI do card: busca no espelho local por nº ou título.
export async function searchGlpiTicketsAction(q: string): Promise<GlpiHit[]> {
  await requireUser();
  const term = q.trim();
  if (term.length < 2) return [];
  const n = Number(term);
  const isNum = Number.isInteger(n) && n > 0;
  const rows = await db.glpiTicket.findMany({
    where: isNum
      ? { OR: [{ glpiId: n }, { name: { contains: term, mode: "insensitive" } }] }
      : { name: { contains: term, mode: "insensitive" } },
    select: { glpiId: true, name: true, statusName: true },
    orderBy: { glpiId: "desc" },
    take: 8,
  });
  return rows.map((r) => ({ id: r.glpiId, name: r.name, statusName: r.statusName }));
}

export async function deleteAttachmentAction(id: string): Promise<BoardActionState> {
  await requireUser();
  try {
    await deleteAttachment(id);
    revalidatePath(P);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
