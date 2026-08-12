import "server-only";
import { db } from "@/lib/db";

export type PendingTaskAcknowledgement = {
  id: string;
  taskId: string;
  title: string;
  priority: "high" | "med" | "low";
  origem: "planejada" | "avulsa" | "presencial";
  projectName: string | null;
  tipoName: string | null;
  dueDate: Date | null;
  createdAt: Date;
  description: string | null;
};

export async function getPendingTaskAcknowledgements(userId: string): Promise<PendingTaskAcknowledgement[]> {
  const rows = await db.taskAcknowledgement.findMany({
    where: { userId, receivedAt: null, task: { assigneeId: userId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      taskId: true,
      createdAt: true,
      task: {
        select: {
          title: true,
          priority: true,
          origem: true,
          dueDate: true,
          project: { select: { name: true } },
          tipo: { select: { name: true } },
          comments: { orderBy: { createdAt: "asc" }, take: 1, select: { body: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    title: row.task.title,
    priority: row.task.priority,
    origem: row.task.origem,
    projectName: row.task.project?.name ?? null,
    tipoName: row.task.tipo?.name ?? null,
    dueDate: row.task.dueDate,
    createdAt: row.createdAt,
    description: row.task.comments[0]?.body ?? null,
  }));
}
