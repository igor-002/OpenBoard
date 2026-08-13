import "server-only";
import { z } from "zod";
import { Prisma, type ProjectStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import { emitAppEvent } from "@/server/events";

const SOURCE = "ploomes";

// Nome do autor nos toasts — a integração não tem usuário logado.
const ACTOR = "Ploomes";

// Status no contrato da API: minúsculo e em PT, separado do label da UI
// (STATUS_META) de propósito — mudar a UI não pode quebrar o consumidor.
const STATUS_API: Record<ProjectStatus, string> = {
  planned: "planejado",
  progress: "em andamento",
  review: "em revisão",
  done: "concluído",
};

function isValidDate(value: string): boolean {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateOrNull = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, "Data inválida"),
  z.null(),
]);

export const ploomesProjectSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  source: z.literal(SOURCE),
  ploomes: z.object({
    dealId: z.number().int().positive(),
    contactId: z.number().int().positive(),
    pipelineId: z.number().int().positive(),
    dealTitle: z.string().trim().min(1).max(500),
  }),
  client: z.object({
    externalId: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(300),
    email: z.string().trim().email().max(320).nullable(),
    phone: z.string().trim().min(1).max(50).nullable(),
    document: z.string().trim().min(1).max(50).nullable(),
  }),
  project: z.object({
    name: z.string().trim().min(1).max(300),
    categoryId: z.string().trim().min(1),
    status: z.literal("planejado"),
    startDate: dateOrNull,
    dueDate: dateOrNull,
    teamUserIds: z.array(z.string().trim().min(1)).max(100),
  }),
  notifications: z.object({
    userIds: z.array(z.string().trim().min(1)).max(100),
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
  }),
});

export type PloomesProjectInput = z.infer<typeof ploomesProjectSchema>;

export class IntegrationError extends Error {
  constructor(public readonly status: 404 | 409, public readonly code: string) {
    super(code);
  }
}

type IntegrationResult = {
  created: boolean;
  idempotent?: true;
  client: { id: string; name: string };
  project: { id: string; name: string; status: string };
  // Quantas notificações ESTA chamada criou — replay devolve 0 de propósito.
  // O total histórico fica em IntegrationEvent.notificationsCreated.
  notificationsCreated: number;
};

const normalizeEmail = (value: string | null) => value?.trim().toLowerCase() || null;
const normalizeDocument = (value: string | null) => value?.replace(/\D/g, "") || null;
const normalizePhone = (value: string | null) => value?.replace(/\D/g, "") || null;
const dateValue = (value: string | null) => (value ? new Date(`${value}T12:00:00`) : null);

async function resultFromEvent(eventId: string): Promise<IntegrationResult> {
  const event = await db.integrationEvent.findUnique({ where: { id: eventId } });
  if (!event?.clientId || !event.projectId) throw new IntegrationError(409, "idempotency_result_unavailable");
  const [client, project] = await Promise.all([
    db.projectClient.findUnique({ where: { id: event.clientId }, select: { id: true, name: true } }),
    db.project.findUnique({ where: { id: event.projectId }, select: { id: true, name: true, status: true } }),
  ]);
  if (!client || !project) throw new IntegrationError(409, "idempotency_result_unavailable");
  return {
    created: false,
    idempotent: true,
    client,
    // Status atual do projeto, não o que ele tinha na criação: o replay
    // devolve o estado real de hoje.
    project: { id: project.id, name: project.name, status: STATUS_API[project.status] },
    notificationsCreated: 0,
  };
}

async function existingResult(input: PloomesProjectInput, idempotencyKey: string): Promise<IntegrationResult | null> {
  const records = await db.integrationEvent.findMany({
    where: {
      source: SOURCE,
      OR: [{ eventId: input.eventId }, { idempotencyKey }],
    },
    select: { id: true, eventId: true, idempotencyKey: true },
  });
  if (!records.length) return null;
  if (records.length > 1) throw new IntegrationError(409, "idempotency_conflict");
  const record = records[0];
  if (record.idempotencyKey === idempotencyKey && record.eventId !== input.eventId) {
    throw new IntegrationError(409, "idempotency_conflict");
  }
  return resultFromEvent(record.id);
}

async function resolveClient(tx: Prisma.TransactionClient, workspaceId: string, input: PloomesProjectInput["client"]) {
  // Toda busca de cliente é presa ao workspace da integração: cliente de outro
  // workspace nunca casa, nem para dar conflito.
  const byExternal = await tx.projectClient.findUnique({
    where: { workspaceId_externalId: { workspaceId, externalId: input.externalId } },
  });
  if (byExternal) return byExternal;

  const documentNorm = normalizeDocument(input.document);
  const emailNorm = normalizeEmail(input.email);
  const matches = documentNorm || emailNorm
    ? await tx.projectClient.findMany({
        where: {
          workspaceId,
          OR: [documentNorm ? { documentNorm } : undefined, emailNorm ? { emailNorm } : undefined].filter(Boolean) as Prisma.ProjectClientWhereInput[],
        },
      })
    : [];
  if (matches.length > 1) throw new IntegrationError(409, "client_match_conflict");
  const existing = matches[0];
  if (existing) {
    if (existing.externalId && existing.externalId !== input.externalId) {
      throw new IntegrationError(409, "client_external_conflict");
    }
    return tx.projectClient.update({ where: { id: existing.id }, data: { externalId: input.externalId } });
  }

  return tx.projectClient.create({
    data: {
      workspaceId,
      externalId: input.externalId,
      name: input.name,
      email: input.email,
      emailNorm,
      phone: normalizePhone(input.phone),
      document: input.document,
      documentNorm,
    },
  });
}

export async function createPloomesProject(
  workspaceId: string,
  input: PloomesProjectInput,
  idempotencyKey: string,
): Promise<IntegrationResult> {
  const prior = await existingResult(input, idempotencyKey);
  if (prior) return prior;

  try {
    const outcome = await db.$transaction(async (tx) => {
      // Unique event row is the transaction's idempotency lock.
      const event = await tx.integrationEvent.create({
        data: { workspaceId, source: SOURCE, eventId: input.eventId, idempotencyKey },
      });

      const category = await tx.projectCategory.findFirst({
        where: { id: input.project.categoryId, workspaceId, active: true },
      });
      if (!category) throw new IntegrationError(404, "category_not_found");

      const teamUserIds = [...new Set(input.project.teamUserIds)];
      const notificationUserIds = [...new Set(input.notifications.userIds)];
      const requiredUserIds = [...new Set([...teamUserIds, ...notificationUserIds])];
      const users = await tx.user.findMany({
        where: { id: { in: requiredUserIds }, workspaceId, active: true },
        select: { id: true },
      });
      if (users.length !== requiredUserIds.length) throw new IntegrationError(404, "user_not_found");

      const dealId = String(input.ploomes.dealId);
      const existingDeal = await tx.project.findUnique({ where: { source_externalDealId: { source: SOURCE, externalDealId: dealId } } });
      if (existingDeal) throw new IntegrationError(409, "external_deal_conflict");

      const client = await resolveClient(tx, workspaceId, input.client);
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: input.project.name,
          client: client.name,
          clientId: client.id,
          tag: category.name,
          categoryId: category.id,
          status: "planned",
          startDate: dateValue(input.project.startDate),
          dueDate: dateValue(input.project.dueDate),
          source: SOURCE,
          externalDealId: dealId,
          members: teamUserIds.length
            ? { create: teamUserIds.map((userId, order) => ({ userId, order, isLead: false })) }
            : undefined,
        },
      });
      // createMany direto (e não notify()) porque o helper não aceita um
      // TransactionClient: a notificação tem que cair junto com o projeto ou
      // nenhum dos dois. O `type` é o mesmo do projeto criado na mão, pro sino
      // reaproveitar o ícone.
      const notifications = await tx.notification.createMany({
        data: notificationUserIds.map((userId) => ({
          userId,
          type: "project_created",
          title: input.notifications.title,
          body: input.notifications.message,
          link: `/projects/${project.id}`,
        })),
      });
      await tx.integrationEvent.update({
        where: { id: event.id },
        data: { clientId: client.id, projectId: project.id, notificationsCreated: notifications.count },
      });

      return {
        result: {
          created: true,
          client: { id: client.id, name: client.name },
          project: { id: project.id, name: project.name, status: STATUS_API.planned },
          notificationsCreated: notifications.count,
        } satisfies IntegrationResult,
        recipientIds: notificationUserIds,
        link: `/projects/${project.id}`,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Toast em tempo real só depois do commit — antes disso o projeto ainda não
    // existe para quem receber o evento e clicar no link.
    if (outcome.recipientIds.length) {
      emitAppEvent({
        kind: "project_created",
        recipientIds: outcome.recipientIds,
        actorName: ACTOR,
        entity: outcome.result.project.name,
        link: outcome.link,
      });
    }
    return outcome.result;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      const replay = await existingResult(input, idempotencyKey);
      if (replay) return replay;
      const deal = await db.project.findUnique({
        where: { source_externalDealId: { source: SOURCE, externalDealId: String(input.ploomes.dealId) } },
        select: { id: true },
      });
      if (deal) throw new IntegrationError(409, "external_deal_conflict");
    }
    throw error;
  }
}
