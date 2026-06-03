"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
}

export async function markRead(id: string): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
}
