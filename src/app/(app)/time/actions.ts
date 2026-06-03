"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type TimerActionState = { ok?: boolean; error?: string };

const startSchema = z.object({
  projectId: z.string().min(1, "Escolha um projeto"),
  taskTitle: z.string().min(2, "Descreva a tarefa"),
});

const elapsed = (startedAt: Date) => Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));

export async function startTimer(_prev: TimerActionState, formData: FormData): Promise<TimerActionState> {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    projectId: formData.get("projectId"),
    taskTitle: formData.get("taskTitle"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const project = await db.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: user.workspaceId },
    select: { id: true },
  });
  if (!project) return { error: "Projeto inválido." };

  // Pausa qualquer timer já rodando deste usuário (um ativo por vez).
  const running = await db.timeLog.findMany({ where: { userId: user.id, status: "running" } });
  for (const r of running) {
    await db.timeLog.update({
      where: { id: r.id },
      data: { durationSec: r.durationSec + elapsed(r.startedAt), status: "paused" },
    });
  }

  await db.timeLog.create({
    data: {
      userId: user.id,
      projectId: parsed.data.projectId,
      taskTitle: parsed.data.taskTitle,
      durationSec: 0,
      startedAt: new Date(),
      status: "running",
    },
  });
  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Helpers que operam só em logs do próprio usuário.
async function ownLog(id: string, userId: string) {
  return db.timeLog.findFirst({ where: { id, userId } });
}

export async function pauseTimer(id: string): Promise<TimerActionState> {
  const user = await requireUser();
  const log = await ownLog(id, user.id);
  if (!log) return { error: "Apontamento não encontrado." };
  if (log.status !== "running") return { ok: true };
  await db.timeLog.update({
    where: { id },
    data: { durationSec: log.durationSec + elapsed(log.startedAt), status: "paused" },
  });
  revalidatePath("/time");
  return { ok: true };
}

export async function resumeTimer(id: string): Promise<TimerActionState> {
  const user = await requireUser();
  const log = await ownLog(id, user.id);
  if (!log) return { error: "Apontamento não encontrado." };
  if (log.status === "running") return { ok: true };
  await db.timeLog.update({ where: { id }, data: { startedAt: new Date(), status: "running" } });
  revalidatePath("/time");
  return { ok: true };
}

export async function finishTimer(id: string): Promise<TimerActionState> {
  const user = await requireUser();
  const log = await ownLog(id, user.id);
  if (!log) return { error: "Apontamento não encontrado." };
  const add = log.status === "running" ? elapsed(log.startedAt) : 0;
  await db.timeLog.update({
    where: { id },
    data: { durationSec: log.durationSec + add, status: "done" },
  });
  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { ok: true };
}
