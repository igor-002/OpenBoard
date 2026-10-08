// Demanda do Principal → chamado no GLPI do Marketing.
//
// Uma REGRA diz quando abrir (gatilho: tipo e/ou responsável da demanda) e com
// quais parâmetros (técnico, requerente, categoria, tipo do chamado). Regra sem
// gatilho é só manual: aparece pra escolher na hora de abrir a demanda. Tudo é
// configurado em /settings/glpi.
//
// A volta: o sync do GLPI chama `fecharDemandasDoGlpi` — chamado solucionado lá
// resolve a demanda aqui, com o texto da solução de quem atendeu.
import "server-only";
import { db } from "@/lib/db";
import { glpiConfigured } from "@/lib/glpi";
import { notify } from "@/server/notifications";
import { ORIGEM_META } from "@/lib/meta";
import type { Priority } from "@/lib/types";
import { createTicket } from "./write";
import { getTicketDetail } from "./detail";

export type RegraGlpi = {
  id: string;
  name: string;
  active: boolean;
  tipoId: string | null;
  assigneeId: string | null;
  glpiAssigneeId: number | null;
  glpiRequesterId: number | null;
  glpiCategoryId: number | null;
  glpiType: number;
  fecharJunto: boolean;
};

const CAMPOS = {
  id: true,
  name: true,
  active: true,
  tipoId: true,
  assigneeId: true,
  glpiAssigneeId: true,
  glpiRequesterId: true,
  glpiCategoryId: true,
  glpiType: true,
  fecharJunto: true,
} as const;

export function listarRegras(workspaceId: string, soAtivas = false): Promise<RegraGlpi[]> {
  return db.glpiRegra.findMany({
    where: { workspaceId, ...(soAtivas ? { active: true } : {}) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: CAMPOS,
  });
}

// A regra casa quando TODO gatilho preenchido bate. Sem gatilho nenhum ela nunca
// dispara sozinha. Entre duas que casam, vence a mais específica (tipo + pessoa).
export function regraQueCasa<R extends Pick<RegraGlpi, "active" | "tipoId" | "assigneeId">>(
  regras: R[],
  demanda: { tipoId: string | null; assigneeId: string | null },
): R | null {
  const peso = (r: R) => (r.tipoId ? 1 : 0) + (r.assigneeId ? 1 : 0);
  return (
    regras
      .filter((r) => r.active && peso(r) > 0)
      .filter((r) => (!r.tipoId || r.tipoId === demanda.tipoId) && (!r.assigneeId || r.assigneeId === demanda.assigneeId))
      .sort((a, b) => peso(b) - peso(a))[0] ?? null
  );
}

// Prioridade da demanda → urgência do chamado (1..5).
const URGENCIA: Record<Priority, number> = { high: 4, med: 3, low: 2 };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// O GLPI guarda o conteúdo como HTML: quebra de linha crua some na tela dele.
const paragrafo = (s: string) => `<p>${esc(s).replace(/\r?\n/g, "<br>")}</p>`;

export type ChamadoAberto = { ok: true; chamado: number | null } | { ok: false; error: string };

// Abre o chamado de uma demanda. `escolha`: id de uma regra, ou "auto" pra usar a
// que casar (nenhuma casando = não abre, e isso não é erro).
export async function abrirChamadoDaDemanda(
  ator: { id: string; name: string; workspaceId: string },
  taskId: string,
  escolha: string,
): Promise<ChamadoAberto> {
  const auto = escolha === "auto";
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: ator.workspaceId },
    select: {
      id: true,
      numero: true,
      title: true,
      description: true,
      solicitante: true,
      origem: true,
      priority: true,
      dueDate: true,
      tipoId: true,
      assigneeId: true,
      glpiId: true,
      column: true,
      ixcCliente: { select: { razao: true } },
    },
  });
  if (!task) return { ok: false, error: "Demanda não encontrada." };
  if (task.glpiId) return auto ? { ok: true, chamado: null } : { ok: false, error: `Esta demanda já tem o chamado #${task.glpiId}.` };
  // Demanda encerrada não vira pedido novo pra ninguém.
  if (task.column === "done" || task.column === "canceled") {
    return auto ? { ok: true, chamado: null } : { ok: false, error: "Demanda encerrada não abre chamado." };
  }

  const regras = await listarRegras(ator.workspaceId, true);
  const regra = auto ? regraQueCasa(regras, task) : (regras.find((r) => r.id === escolha) ?? null);
  if (!regra) return auto ? { ok: true, chamado: null } : { ok: false, error: "Regra de chamado não encontrada (ou desativada)." };
  if (!glpiConfigured()) return { ok: false, error: "GLPI não configurado neste servidor." };

  const linhas = [
    paragrafo(task.description || task.title),
    paragrafo(
      [
        task.solicitante ? `Quem pediu: ${task.solicitante}` : null,
        `Chegou por: ${ORIGEM_META[task.origem].label}`,
        task.ixcCliente ? `Cliente: ${task.ixcCliente.razao}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    paragrafo(`Aberto pelo OpenBoard por ${ator.name} — demanda #${task.numero}.`),
  ];

  let glpiId: number | null;
  try {
    glpiId = await createTicket({
      name: task.title,
      content: linhas.join(""),
      requesterId: regra.glpiRequesterId ?? 0,
      requesterDeFora: true,
      assigneeId: regra.glpiAssigneeId ?? undefined,
      type: regra.glpiType,
      categoryId: regra.glpiCategoryId,
      urgency: URGENCIA[task.priority],
      dueAt: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      dueSetById: ator.id,
    });
  } catch (e) {
    return { ok: false, error: `GLPI recusou o chamado: ${(e as Error).message}` };
  }
  if (!glpiId) return { ok: false, error: "O GLPI não devolveu o número do chamado." };

  await db.$transaction([
    db.task.update({ where: { id: task.id }, data: { glpiId, glpiFechaJunto: regra.fecharJunto } }),
    db.taskEvent.create({ data: { taskId: task.id, actorId: ator.id, kind: "glpi", to: String(glpiId), note: regra.name } }),
  ]);
  return { ok: true, chamado: glpiId };
}

// Chamado solucionado/fechado no GLPI → demanda resolvida aqui. Roda no fim de
// cada sync, só sobre o espelho local (uma ida ao GLPI por demanda fechada, pra
// buscar o texto da solução).
//
// Quem reabre a demanda DEPOIS da solução não a vê fechar de novo no sync
// seguinte: mudança de status posterior à data da solução trava o fechamento.
export async function fecharDemandasDoGlpi(): Promise<number> {
  const abertas = await db.task.findMany({
    where: { glpiId: { not: null }, glpiFechaJunto: true, column: { in: ["todo", "doing", "waiting"] } },
    select: { id: true, numero: true, title: true, column: true, glpiId: true, creatorId: true, assigneeId: true },
  });
  if (abertas.length === 0) return 0;

  const tickets = await db.glpiTicket.findMany({
    where: { glpiId: { in: abertas.map((t) => t.glpiId as number) }, statusId: { in: [5, 6] }, isDeleted: false },
    select: { glpiId: true, dateSolve: true, dateClose: true, assignees: true },
  });
  const porId = new Map(tickets.map((t) => [t.glpiId, t]));

  let fechadas = 0;
  for (const task of abertas) {
    const ticket = porId.get(task.glpiId as number);
    const quando = ticket?.dateSolve ?? ticket?.dateClose;
    if (!ticket || !quando) continue;
    const mexeramDepois = await db.taskEvent.findFirst({
      where: { taskId: task.id, kind: "status", createdAt: { gt: quando } },
      select: { id: true },
    });
    if (mexeramDepois) continue;

    let solucao = "";
    try {
      const detalhe = await getTicketDetail(ticket.glpiId);
      solucao = detalhe?.timeline.filter((e) => e.kind === "Solução").pop()?.content ?? "";
    } catch {
      // sem o texto a demanda fecha do mesmo jeito, apontando pro chamado
    }
    const quem = ticket.assignees ? ` por ${ticket.assignees}` : "";
    const report = (solucao || `Resolvido no GLPI${quem} (chamado #${ticket.glpiId}).`).slice(0, 5000);

    await db.$transaction([
      db.task.update({
        where: { id: task.id },
        data: { column: "done", doneAt: quando, waitingReason: null, report },
      }),
      db.taskEvent.create({
        data: { taskId: task.id, kind: "status", from: task.column, to: "done", note: `Chamado #${ticket.glpiId} solucionado no GLPI${quem}` },
      }),
    ]);
    await notify([task.creatorId, task.assigneeId], {
      type: "task_assigned",
      title: `Demanda #${task.numero} resolvida no GLPI`,
      body: task.title,
      link: `/atividades?d=${task.numero}`,
    });
    fechadas++;
  }
  return fechadas;
}
