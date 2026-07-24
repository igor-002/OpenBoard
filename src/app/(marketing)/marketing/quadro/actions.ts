"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  ensureDefaultBoard,
  createCard,
  updateCard,
  deleteCard,
  moveCard,
  setCardLabels,
  createLabel,
} from "@/server/marketing/board";

export type BoardActionState = { ok: boolean; error?: string; id?: string };

const P = "/marketing/quadro";
function fail(e: unknown): BoardActionState {
  return { ok: false, error: e instanceof Error ? e.message : "Falha na operação." };
}

export async function createCardAction(input: { columnId: string; title: string; kind?: "interna" | "glpi"; glpiId?: number | null }): Promise<BoardActionState> {
  const user = await requireUser();
  try {
    const r = await createCard({ ...input, createdById: user.id });
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
