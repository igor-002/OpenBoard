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
  addAttachment,
  deleteAttachment,
  createColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
  reorderColumn,
  type AttachmentDTO,
} from "@/server/marketing/board";

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

export async function moveCardAction(cardId: string, toColumnId: string, toIndex: number): Promise<BoardActionState> {
  await requireUser();
  try {
    await moveCard(cardId, toColumnId, toIndex);
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
