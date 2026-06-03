import "server-only";
import { db } from "@/lib/db";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export async function getNotifications(userId: string): Promise<{ items: NotificationItem[]; unread: number }> {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, unread };
}

// Cria notificações para vários destinatários (ignora nulos/duplicados).
export async function notify(
  userIds: (string | null | undefined)[],
  data: { type: string; title: string; body?: string; link?: string },
): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  await db.notification.createMany({
    data: ids.map((userId) => ({ userId, type: data.type, title: data.title, body: data.body, link: data.link })),
  });
}
