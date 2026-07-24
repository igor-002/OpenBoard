// Quadro de Demandas do Marketing (Kanban tipo Trello). Server-only. Fluxo próprio
// do time — colunas != status do GLPI. Card interno OU linkado a um chamado GLPI
// (glpiId → GlpiTicket, join só-leitura pra puxar status/atribuído ao vivo do espelho).
import "server-only";
import { db } from "@/lib/db";

const BOARD_SLUG = "marketing";

// Colunas + etiquetas iniciais (do Trello atual do time). Criadas no 1º acesso.
const DEFAULT_COLUMNS = [
  "Backlog (Ideias)",
  "Daily",
  "Novos",
  "Pendente",
  "Atribuídos ao Setor",
  "Concluído",
  "Material Pronto",
];
const DEFAULT_LABELS: { name: string; color: string }[] = [
  { name: "ATENÇÃO", color: "#f59e0b" },
  { name: "EVENTO", color: "#f2691f" },
  { name: "ALERTA", color: "#e5484d" },
  { name: "LIVRE", color: "#16a34a" },
  { name: "EDIÇÃO PENDENTE", color: "#0d9488" },
  { name: "VIDEO PRONTO", color: "#7a5ae0" },
];

// Garante o quadro padrão (colunas + etiquetas) no 1º acesso — sem seed manual,
// funciona em prod novo. Idempotente pelo slug único.
export async function ensureDefaultBoard(): Promise<string> {
  const existing = await db.mktBoard.findUnique({ where: { slug: BOARD_SLUG }, select: { id: true } });
  if (existing) return existing.id;
  const board = await db.mktBoard.create({
    data: {
      name: "Demandas do Marketing",
      slug: BOARD_SLUG,
      columns: { create: DEFAULT_COLUMNS.map((name, i) => ({ name, order: i })) },
      labels: { create: DEFAULT_LABELS.map((l, i) => ({ ...l, order: i })) },
    },
    select: { id: true },
  });
  return board.id;
}

export type LabelDTO = { id: string; name: string; color: string };
export type CardDTO = {
  id: string;
  title: string;
  description: string | null;
  kind: string; // interna | glpi
  glpiId: number | null;
  dueAt: string | null;
  order: number;
  labels: LabelDTO[];
  glpi: { statusId: number; statusName: string; requesterName: string; assignees: string } | null;
};
export type ColumnDTO = { id: string; name: string; order: number; cards: CardDTO[] };
export type BoardDTO = { id: string; name: string; columns: ColumnDTO[]; labels: LabelDTO[] };

export async function getBoard(): Promise<BoardDTO> {
  const boardId = await ensureDefaultBoard();
  const [columns, labels] = await Promise.all([
    db.mktColumn.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
      include: {
        cards: {
          orderBy: { order: "asc" },
          include: { labels: { orderBy: { order: "asc" }, select: { id: true, name: true, color: true } } },
        },
      },
    }),
    db.mktLabel.findMany({ where: { boardId }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } }),
  ]);

  // Join só-leitura dos cards GLPI → status/atribuído ao vivo do espelho.
  const glpiIds = columns.flatMap((c) => c.cards).map((c) => c.glpiId).filter((x): x is number => x != null);
  const tickets = glpiIds.length
    ? await db.glpiTicket.findMany({
        where: { glpiId: { in: glpiIds } },
        select: { glpiId: true, statusId: true, statusName: true, requesterName: true, assignees: true },
      })
    : [];
  const byGlpi = new Map(tickets.map((t) => [t.glpiId, t]));

  const board = await db.mktBoard.findUniqueOrThrow({ where: { id: boardId }, select: { id: true, name: true } });
  return {
    id: board.id,
    name: board.name,
    labels,
    columns: columns.map((col) => ({
      id: col.id,
      name: col.name,
      order: col.order,
      cards: col.cards.map((c) => {
        const g = c.glpiId != null ? byGlpi.get(c.glpiId) : null;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          kind: c.kind,
          glpiId: c.glpiId,
          dueAt: c.dueAt?.toISOString() ?? null,
          order: c.order,
          labels: c.labels,
          glpi: g ? { statusId: g.statusId, statusName: g.statusName, requesterName: g.requesterName, assignees: g.assignees } : null,
        };
      }),
    })),
  };
}

// próximo `order` no fim da coluna (cards novos entram embaixo).
async function nextOrder(columnId: string): Promise<number> {
  const last = await db.mktCard.findFirst({ where: { columnId }, orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? -1) + 1;
}

export async function createCard(input: {
  columnId: string;
  title: string;
  kind?: "interna" | "glpi";
  glpiId?: number | null;
  createdById?: string | null;
}): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("Título obrigatório.");
  const kind = input.kind === "glpi" ? "glpi" : "interna";
  const card = await db.mktCard.create({
    data: {
      columnId: input.columnId,
      title,
      kind,
      glpiId: kind === "glpi" ? input.glpiId ?? null : null,
      order: await nextOrder(input.columnId),
      createdById: input.createdById ?? null,
    },
    select: { id: true },
  });
  return card;
}

export async function updateCard(
  cardId: string,
  patch: { title?: string; description?: string | null; dueAt?: Date | null; glpiId?: number | null; kind?: "interna" | "glpi" },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Título não pode ficar vazio.");
    data.title = t;
  }
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt;
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.glpiId !== undefined) data.glpiId = patch.glpiId;
  await db.mktCard.update({ where: { id: cardId }, data });
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.mktCard.delete({ where: { id: cardId } });
}

// Move o card pra uma coluna/posição. Reindexa a coluna destino de forma simples
// (volume baixo por coluna). O card entra na posição `toIndex` (0 = topo).
export async function moveCard(cardId: string, toColumnId: string, toIndex: number): Promise<void> {
  const card = await db.mktCard.findUnique({ where: { id: cardId }, select: { id: true } });
  if (!card) return;
  const others = await db.mktCard.findMany({
    where: { columnId: toColumnId, id: { not: cardId } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = Math.max(0, Math.min(toIndex, others.length));
  const ordered = [...others.slice(0, idx).map((c) => c.id), cardId, ...others.slice(idx).map((c) => c.id)];
  await db.$transaction([
    db.mktCard.update({ where: { id: cardId }, data: { columnId: toColumnId } }),
    ...ordered.map((id, i) => db.mktCard.update({ where: { id }, data: { order: i } })),
  ]);
}

export async function setCardLabels(cardId: string, labelIds: string[]): Promise<void> {
  await db.mktCard.update({ where: { id: cardId }, data: { labels: { set: labelIds.map((id) => ({ id })) } } });
}

export async function createLabel(boardId: string, name: string, color: string): Promise<{ id: string }> {
  const n = name.trim();
  if (!n) throw new Error("Nome da etiqueta obrigatório.");
  const last = await db.mktLabel.findFirst({ where: { boardId }, orderBy: { order: "desc" }, select: { order: true } });
  return db.mktLabel.create({
    data: { boardId, name: n, color: color || "#6b7280", order: (last?.order ?? -1) + 1 },
    select: { id: true },
  });
}
