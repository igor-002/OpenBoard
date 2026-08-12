"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type AcknowledgementActionState = { ok?: boolean; error?: string };

export async function acknowledgeTaskDemand(acknowledgementId: string): Promise<AcknowledgementActionState> {
  const user = await requireUser();
  const updated = await db.taskAcknowledgement.updateMany({
    where: {
      id: acknowledgementId,
      userId: user.id,
      receivedAt: null,
      task: { assigneeId: user.id, workspaceId: user.workspaceId },
    },
    data: { receivedAt: new Date() },
  });
  if (updated.count !== 1) return { error: "Esta demanda já foi confirmada ou não está disponível." };

  const acknowledgement = await db.taskAcknowledgement.findUnique({
    where: { id: acknowledgementId },
    select: { taskId: true },
  });
  if (!acknowledgement) return { error: "Demanda não encontrada." };
  await db.taskComment.create({
    data: {
      taskId: acknowledgement.taskId,
      authorId: user.id,
      body: "✅ Confirmou recebimento desta demanda.",
    },
  });
  revalidatePath("/kanban");
  revalidatePath("/atividades");
  revalidatePath("/dashboard");
  return { ok: true };
}
