"use server";

// Ações da paleta de comandos (Ctrl+K): buscar, criar tarefa e criar atividade.
// Ficam separadas das actions de cada tela porque a paleta é global — chamada de
// qualquer página do app.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { requireToolUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { searchPalette, type PaletteHit } from "@/server/palette";
import { normalizaMarkdownDigitado, resumoDoMarkdown } from "@/server/notas";

export type PaletteCreateState = { ok: boolean; error?: string; href?: string };

export async function paletteSearchAction(q: string): Promise<PaletteHit[]> {
  const user = await requireUser();
  try {
    return await searchPalette(user.workspaceId, q, user.id);
  } catch {
    return [];
  }
}

// Opções dos formulários rápidos, buscadas junto quando a paleta abre.
export interface PaletteOpcoes {
  projetos: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
}

export async function paletteOpcoesAction(): Promise<PaletteOpcoes> {
  const user = await requireUser();
  const [projetos, tipos] = await Promise.all([
    db.project.findMany({
      where: { workspaceId: user.workspaceId, status: { not: "done" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.taskType.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);
  return {
    projetos: projetos.map((p) => ({ id: p.id, nome: p.name })),
    tipos: tipos.map((t) => ({ id: t.id, nome: t.name })),
  };
}

// Tarefa rápida: título obrigatório, resto opcional. Sem projeto ela nasce como
// atividade avulsa (Task aceita projectId null), que é o mesmo modelo de /atividades.
export async function paletteCriarTarefaAction(input: {
  title: string;
  projectId?: string | null;
  dueDate?: string | null;
}): Promise<PaletteCreateState> {
  const user = await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Escreva o título da tarefa." };

  let projectId: string | null = null;
  if (input.projectId) {
    const p = await db.project.findFirst({
      where: { id: input.projectId, workspaceId: user.workspaceId },
      select: { id: true },
    });
    if (!p) return { ok: false, error: "Projeto inválido." };
    projectId = p.id;
  }

  const due = parseData(input.dueDate);
  if (input.dueDate && !due) return { ok: false, error: "Prazo inválido." };

  // Entra no topo da coluna "a fazer" — quem captura rápido quer ver na frente.
  const primeiro = await db.task.findFirst({
    where: { workspaceId: user.workspaceId, projectId, column: "todo" },
    orderBy: { order: "asc" },
    select: { order: true },
  });

  const task = await db.task.create({
    data: {
      workspaceId: user.workspaceId,
      projectId,
      title,
      column: "todo",
      assigneeId: user.id,
      dueDate: due,
      order: (primeiro?.order ?? 0) - 1,
      origem: projectId ? "planejada" : "avulsa",
    },
    select: { id: true, projectId: true },
  });

  revalidatePath("/projects");
  revalidatePath("/atividades");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true, href: task.projectId ? `/projects/${task.projectId}` : "/atividades" };
}

// Atividade da equipe: exige `tipo` (é o que os relatórios agrupam), então a
// paleta pede o tipo — sem ele o registro não serve pro /reports.
//
// `realMinutes` liga o registro retroativo: a atividade já nasce concluída e o
// startedAt é ancorado pra trás (doneAt − duração), que é como o resto do sistema
// calcula tempo real. Sem isso, lançar algo já feito daria um tempo errado,
// contado da criação até o clique em concluir.
export async function paletteCriarAtividadeAction(input: {
  title: string;
  tipoId: string;
  projectId?: string | null;
  clienteId?: string | null;
  priority?: "high" | "med" | "low";
  estimatedMinutes?: number | null;
  realMinutes?: number | null;
}): Promise<PaletteCreateState> {
  const user = await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Escreva o título da atividade." };

  const tipo = await db.taskType.findFirst({ where: { id: input.tipoId, active: true }, select: { id: true } });
  if (!tipo) return { ok: false, error: "Escolha o tipo da atividade." };

  let ixcClienteId: string | null = null;
  if (input.clienteId) {
    const c = await db.ixcCliente.findUnique({ where: { id: input.clienteId }, select: { id: true } });
    if (!c) return { ok: false, error: "Cliente inválido." };
    ixcClienteId = c.id;
  }

  let projectId: string | null = null;
  if (input.projectId) {
    const p = await db.project.findFirst({ where: { id: input.projectId, workspaceId: user.workspaceId }, select: { id: true } });
    if (!p) return { ok: false, error: "Projeto inválido." };
    projectId = p.id;
  }

  const jaFeita = !!input.realMinutes && input.realMinutes > 0;
  const agora = new Date();

  await db.task.create({
    data: {
      workspaceId: user.workspaceId,
      projectId,
      title,
      column: jaFeita ? "done" : "todo",
      priority: input.priority ?? "med",
      assigneeId: user.id,
      origem: "avulsa",
      tipoId: tipo.id,
      ixcClienteId,
      estimatedMinutes: input.estimatedMinutes ?? null,
      startedAt: jaFeita ? new Date(agora.getTime() - input.realMinutes! * 60_000) : null,
      doneAt: jaFeita ? agora : null,
      report: jaFeita ? title : null,
    },
  });

  revalidatePath("/atividades");
  revalidatePath("/reports");
  return { ok: true, href: "/atividades" };
}

// Nota rápida: título + o texto já digitado ali mesmo. O corpo é markdown —
// a paleta é um campo simples, mas o que sai daqui abre formatado no editor.
export async function paletteCriarNotaAction(input: {
  title: string;
  body?: string;
  projectId?: string | null;
}): Promise<PaletteCreateState> {
  const user = await requireToolUser("gestao.notas");
  const title = input.title.trim().slice(0, 200);
  if (!title) return { ok: false, error: "Escreva um título." };
  const body = normalizaMarkdownDigitado((input.body ?? "").slice(0, 200_000));

  if (input.projectId) {
    const p = await db.project.findFirst({
      where: { id: input.projectId, workspaceId: user.workspaceId },
      select: { id: true },
    });
    if (!p) return { ok: false, error: "Projeto inválido." };
  }

  const nota = await db.note.create({
    data: {
      workspaceId: user.workspaceId,
      authorId: user.id,
      title,
      body,
      resumo: resumoDoMarkdown(body),
      projectId: input.projectId || null,
    },
    select: { id: true },
  });

  revalidatePath("/notas");
  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, href: `/notas?n=${nota.id}` };
}

// "YYYY-MM-DD" vira meio-dia LOCAL — mesma convenção do quadro do marketing;
// meia-noite viraria o dia anterior em fuso negativo.
function parseData(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
