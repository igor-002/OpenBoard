// Quadro de Demandas do Marketing (Kanban tipo Trello). Server-only. Fluxo próprio
// do time — colunas != status do GLPI. Card interno OU linkado a um chamado GLPI
// (glpiId → GlpiTicket, join só-leitura pra puxar status/atribuído ao vivo do espelho).
import "server-only";
import { db } from "@/lib/db";

const BOARD_SLUG = "marketing";

// Colunas + etiquetas iniciais (do Trello atual do time). Criadas no 1º acesso.
// `glpi` = status do GLPI que a coluna representa; null = coluna só do time.
// `done` = coluna de saída (card ganha doneAt e some depois de 2 dias).
const DEFAULT_COLUMNS: { name: string; glpi: number | null; done?: boolean }[] = [
  { name: "Backlog (Ideias)", glpi: null },
  { name: "Daily", glpi: null },
  { name: "Novos", glpi: 1 }, // Novo
  { name: "Pendente", glpi: 4 }, // Pendente
  { name: "Atribuídos ao Setor", glpi: 2 }, // Em atendimento (2 e 3)
  { name: "Concluído", glpi: 5, done: true }, // Solucionado
  { name: "Material Pronto", glpi: 6, done: true }, // Fechado
];

// GLPI 3 (Em atendimento — planejado) mora na mesma coluna do 2.
const GLPI_STATUS_ALIAS: Record<number, number> = { 3: 2 };
export const normalizeGlpiStatus = (id: number) => GLPI_STATUS_ALIAS[id] ?? id;

// Status ainda "vivos" — só esses viram card automaticamente. Chamado antigo já
// fechado não precisa entupir o quadro; se reabrir, entra no próximo carregamento.
const GLPI_OPEN_STATUSES = [1, 2, 3, 4];

// Quanto tempo um card concluído fica visível antes de sair do quadro.
export const DIAS_MOSTRA_CONCLUIDO = 2;
const MS_MOSTRA_CONCLUIDO = DIAS_MOSTRA_CONCLUIDO * 86_400_000;
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
      columns: {
        create: DEFAULT_COLUMNS.map((c, i) => ({ name: c.name, order: i, glpiStatusId: c.glpi, isDone: c.done ?? false })),
      },
      labels: { create: DEFAULT_LABELS.map((l, i) => ({ ...l, order: i })) },
    },
    select: { id: true },
  });
  return board.id;
}

export type LabelDTO = { id: string; name: string; color: string };
export type AttachmentDTO = { id: string; filename: string; mime: string; size: number };
export type CardDTO = {
  id: string;
  title: string;
  description: string | null;
  kind: string; // interna | glpi
  glpiId: number | null;
  dueAt: string | null;
  order: number;
  labels: LabelDTO[];
  attachments: AttachmentDTO[];
  glpi: { statusId: number; statusName: string; requesterName: string; assignees: string } | null;
};
export type ColumnDTO = {
  id: string;
  name: string;
  order: number;
  glpiStatusId: number | null;
  isDone: boolean;
  cards: CardDTO[];
};
export type BoardDTO = {
  id: string;
  name: string;
  columns: ColumnDTO[];
  labels: LabelDTO[];
  hiddenDone: number; // concluídas escondidas por passarem do corte
  showingDone: boolean;
  doneAfterDays: number; // dias que uma concluída fica visível (vai no DTO pra não duplicar no client)
};

// ── Ingestão + reconciliação dos chamados GLPI ───────────────────────────────
// O quadro é o ÚNICO kanban do marketing: todo chamado aberto do espelho vira
// card sozinho, sem ninguém linkar na mão (era o gargalo do modelo antigo).
//
// Reconciliação: card do GLPI parado numa coluna MAPEADA cujo status não bate
// mais volta pra coluna certa. Card em coluna não mapeada (Backlog, Daily) fica
// onde está — é o time usando o quadro do jeito dele, não erro de sincronia.
async function ingestGlpiCards(boardId: string): Promise<void> {
  const columns = await db.mktColumn.findMany({
    where: { boardId },
    orderBy: { order: "asc" },
    select: { id: true, glpiStatusId: true, isDone: true },
  });
  if (!columns.length) return;
  const colForStatus = new Map<number, string>();
  for (const c of columns) if (c.glpiStatusId != null) colForStatus.set(c.glpiStatusId, c.id);
  if (!colForStatus.size) return; // nenhuma coluna mapeada → nada a fazer
  const mapeada = new Set(columns.filter((c) => c.glpiStatusId != null).map((c) => c.id));
  const saida = new Set(columns.filter((c) => c.isDone).map((c) => c.id));

  const [espelho, existentes] = await Promise.all([
    db.glpiTicket.findMany({
      where: { isDeleted: false },
      select: { glpiId: true, name: true, statusId: true, dueAt: true },
    }),
    db.mktCard.findMany({
      where: { column: { boardId }, glpiId: { not: null } },
      select: { id: true, glpiId: true, columnId: true, doneAt: true },
    }),
  ]);
  const cardByGlpi = new Map(existentes.map((c) => [c.glpiId!, c]));

  // Reserva de `order` no fim de cada coluna, sem uma consulta por card.
  const ordemBase = new Map<string, number>();
  async function proximaOrdem(colId: string): Promise<number> {
    if (!ordemBase.has(colId)) {
      const last = await db.mktCard.findFirst({ where: { columnId: colId }, orderBy: { order: "desc" }, select: { order: true } });
      ordemBase.set(colId, (last?.order ?? -1) + 1);
    }
    const n = ordemBase.get(colId)!;
    ordemBase.set(colId, n + 1);
    return n;
  }

  // 1) chamados ABERTOS ainda sem card. Já solucionado/fechado não entra: seria
  //    despejar anos de histórico direto na coluna de saída.
  const novos = espelho.filter((t) => GLPI_OPEN_STATUSES.includes(t.statusId) && !cardByGlpi.has(t.glpiId));
  const data = [];
  for (const t of novos) {
    const colId = colForStatus.get(normalizeGlpiStatus(t.statusId));
    if (!colId) continue;
    data.push({ columnId: colId, title: t.name, kind: "glpi", glpiId: t.glpiId, dueAt: t.dueAt, order: await proximaOrdem(colId) });
  }
  if (data.length) await db.mktCard.createMany({ data });

  // 2) cards em coluna mapeada cujo status mudou POR FORA (inclusive pra
  //    solucionado/fechado — senão o chamado resolvido no GLPI ficaria preso na
  //    coluna antiga pra sempre). Coluna do time não é tocada.
  const porId = new Map(espelho.map((t) => [t.glpiId, t]));
  for (const card of existentes) {
    if (!mapeada.has(card.columnId)) continue;
    const t = porId.get(card.glpiId!);
    if (!t) continue;
    const alvo = colForStatus.get(normalizeGlpiStatus(t.statusId));
    if (!alvo || alvo === card.columnId) continue;
    await db.mktCard.update({
      where: { id: card.id },
      data: { columnId: alvo, order: await proximaOrdem(alvo), ...doneAtPatch(saida.has(alvo), card.doneAt) },
    });
  }
}

// Card que entra numa coluna de saída marca a hora (base do "some depois de 2
// dias"); voltando pro fluxo, limpa. Já concluído que anda entre colunas de saída
// mantém a hora original — reentrar em "Material Pronto" não renova o prazo.
function doneAtPatch(paraSaida: boolean, atual: Date | null): { doneAt?: Date | null } {
  if (paraSaida) return atual ? {} : { doneAt: new Date() };
  return atual ? { doneAt: null } : {};
}

// `includeDone` traz também as concluídas velhas (botão "ver concluídas"). Por
// padrão o quadro esconde card com doneAt anterior ao corte, pra não poluir.
export async function getBoard(opts: { includeDone?: boolean } = {}): Promise<BoardDTO> {
  const boardId = await ensureDefaultBoard();
  await ingestGlpiCards(boardId);
  const corte = new Date(Date.now() - MS_MOSTRA_CONCLUIDO);
  const cardWhere = opts.includeDone ? {} : { OR: [{ doneAt: null }, { doneAt: { gte: corte } }] };
  const [columns, labels, ocultas] = await Promise.all([
    db.mktColumn.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
      include: {
        cards: {
          where: cardWhere,
          orderBy: { order: "asc" },
          include: {
            labels: { orderBy: { order: "asc" }, select: { id: true, name: true, color: true } },
            attachments: { orderBy: { createdAt: "asc" }, select: { id: true, filename: true, mime: true, size: true } },
          },
        },
      },
    }),
    db.mktLabel.findMany({ where: { boardId }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } }),
    db.mktCard.count({ where: { column: { boardId }, doneAt: { lt: corte } } }),
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
    hiddenDone: ocultas,
    showingDone: !!opts.includeDone,
    doneAfterDays: DIAS_MOSTRA_CONCLUIDO,
    columns: columns.map((col) => ({
      id: col.id,
      name: col.name,
      order: col.order,
      glpiStatusId: col.glpiStatusId,
      isDone: col.isDone,
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
          attachments: c.attachments,
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
  description?: string | null;
  dueAt?: Date | null;
  kind?: "interna" | "glpi";
  glpiId?: number | null;
  labelIds?: string[];
  createdById?: string | null;
}): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("Título obrigatório.");
  const kind = input.kind === "glpi" ? "glpi" : "interna";
  const card = await db.mktCard.create({
    data: {
      columnId: input.columnId,
      title,
      description: input.description?.trim() || null,
      dueAt: input.dueAt ?? null,
      kind,
      glpiId: kind === "glpi" ? input.glpiId ?? null : null,
      order: await nextOrder(input.columnId),
      createdById: input.createdById ?? null,
      labels: input.labelIds?.length ? { connect: input.labelIds.map((id) => ({ id })) } : undefined,
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
//
// Devolve o status do GLPI a escrever quando o card é de chamado E a coluna
// destino está mapeada num status diferente do atual. Quem chama (a action) faz
// a escrita — este módulo não fala com a API do GLPI.
export async function moveCard(
  cardId: string,
  toColumnId: string,
  toIndex: number,
): Promise<{ glpiId: number; statusId: number } | null> {
  const card = await db.mktCard.findUnique({
    where: { id: cardId },
    select: { id: true, glpiId: true, columnId: true, doneAt: true },
  });
  if (!card) return null;
  const destino = await db.mktColumn.findUnique({
    where: { id: toColumnId },
    select: { glpiStatusId: true, isDone: true },
  });
  const others = await db.mktCard.findMany({
    where: { columnId: toColumnId, id: { not: cardId } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = Math.max(0, Math.min(toIndex, others.length));
  const ordered = [...others.slice(0, idx).map((c) => c.id), cardId, ...others.slice(idx).map((c) => c.id)];
  await db.$transaction([
    db.mktCard.update({
      where: { id: cardId },
      data: { columnId: toColumnId, ...doneAtPatch(!!destino?.isDone, card.doneAt) },
    }),
    ...ordered.map((id, i) => db.mktCard.update({ where: { id }, data: { order: i } })),
  ]);

  if (card.glpiId == null || card.columnId === toColumnId) return null;
  if (destino?.glpiStatusId == null) return null; // coluna do time: só parqueia
  const atual = await db.glpiTicket.findUnique({ where: { glpiId: card.glpiId }, select: { statusId: true } });
  if (atual && normalizeGlpiStatus(atual.statusId) === destino.glpiStatusId) return null;
  return { glpiId: card.glpiId, statusId: destino.glpiStatusId };
}

// Mapeia (ou desmapeia, com null) a coluna num status do GLPI. Um status só pode
// estar em uma coluna — senão a reconciliação ficaria não-determinística.
export async function setColumnGlpiStatus(columnId: string, glpiStatusId: number | null): Promise<void> {
  const col = await db.mktColumn.findUnique({ where: { id: columnId }, select: { boardId: true } });
  if (!col) throw new Error("Coluna não encontrada.");
  if (glpiStatusId != null) {
    const normalizado = normalizeGlpiStatus(glpiStatusId);
    const jaUsado = await db.mktColumn.findFirst({
      where: { boardId: col.boardId, glpiStatusId: normalizado, id: { not: columnId } },
      select: { name: true },
    });
    if (jaUsado) throw new Error(`Esse status já é da coluna "${jaUsado.name}".`);
    await db.mktColumn.update({ where: { id: columnId }, data: { glpiStatusId: normalizado } });
    return;
  }
  await db.mktColumn.update({ where: { id: columnId }, data: { glpiStatusId: null } });
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

// ── Colunas (gerenciáveis pela UI) ─────────────────────────────────────────────
export async function createColumn(boardId: string, name: string): Promise<{ id: string }> {
  const n = name.trim();
  if (!n) throw new Error("Nome da coluna obrigatório.");
  const last = await db.mktColumn.findFirst({ where: { boardId }, orderBy: { order: "desc" }, select: { order: true } });
  return db.mktColumn.create({ data: { boardId, name: n, order: (last?.order ?? -1) + 1 }, select: { id: true } });
}

export async function renameColumn(columnId: string, name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Nome da coluna não pode ficar vazio.");
  await db.mktColumn.update({ where: { id: columnId }, data: { name: n } });
}

// Só remove coluna vazia — evita apagar cards por engano.
export async function deleteColumn(columnId: string): Promise<void> {
  const count = await db.mktCard.count({ where: { columnId } });
  if (count > 0) throw new Error("Mova ou exclua os cartões antes de remover a coluna.");
  await db.mktColumn.delete({ where: { id: columnId } });
}

// Move a coluna uma posição pra esquerda (-1) ou direita (+1), trocando `order` com a vizinha.
export async function moveColumn(columnId: string, dir: -1 | 1): Promise<void> {
  const col = await db.mktColumn.findUnique({ where: { id: columnId }, select: { id: true, boardId: true, order: true } });
  if (!col) return;
  const neighbor = await db.mktColumn.findFirst({
    where: { boardId: col.boardId, order: dir < 0 ? { lt: col.order } : { gt: col.order } },
    orderBy: { order: dir < 0 ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return; // já é a primeira/última
  await db.$transaction([
    db.mktColumn.update({ where: { id: col.id }, data: { order: neighbor.order } }),
    db.mktColumn.update({ where: { id: neighbor.id }, data: { order: col.order } }),
  ]);
}

// Reordena por DnD: coloca a coluna arrastada antes/depois da coluna alvo. Reindexa tudo.
export async function reorderColumn(draggedId: string, targetId: string, before: boolean): Promise<void> {
  if (draggedId === targetId) return;
  const dragged = await db.mktColumn.findUnique({ where: { id: draggedId }, select: { boardId: true } });
  if (!dragged) return;
  const cols = await db.mktColumn.findMany({ where: { boardId: dragged.boardId }, orderBy: { order: "asc" }, select: { id: true } });
  const without = cols.filter((c) => c.id !== draggedId).map((c) => c.id);
  const ti = without.indexOf(targetId);
  if (ti < 0) return;
  const insertAt = before ? ti : ti + 1;
  const ordered = [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
  await db.$transaction(ordered.map((id, i) => db.mktColumn.update({ where: { id }, data: { order: i } })));
}

// ── Anexos ────────────────────────────────────────────────────────────────────
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB — guardado no Postgres.

export async function addAttachment(input: {
  cardId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
  createdById?: string | null;
}): Promise<AttachmentDTO> {
  if (input.bytes.length === 0) throw new Error("Arquivo vazio.");
  if (input.bytes.length > MAX_ATTACHMENT_BYTES) throw new Error("Arquivo acima de 20 MB.");
  const card = await db.mktCard.findUnique({ where: { id: input.cardId }, select: { id: true } });
  if (!card) throw new Error("Cartão não encontrado.");
  const a = await db.mktCardAttachment.create({
    data: {
      cardId: input.cardId,
      filename: input.filename.slice(0, 200) || "arquivo",
      mime: input.mime || "application/octet-stream",
      size: input.bytes.length,
      data: new Uint8Array(input.bytes),
      createdById: input.createdById ?? null,
    },
    select: { id: true, filename: true, mime: true, size: true },
  });
  return a;
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.mktCardAttachment.delete({ where: { id } });
}

export async function getAttachmentBytes(id: string): Promise<{ filename: string; mime: string; data: Buffer } | null> {
  const a = await db.mktCardAttachment.findUnique({ where: { id }, select: { filename: true, mime: true, data: true } });
  if (!a) return null;
  return { filename: a.filename, mime: a.mime, data: Buffer.from(a.data) };
}
