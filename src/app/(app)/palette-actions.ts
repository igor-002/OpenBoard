"use server";

// Ações da paleta de comandos (Ctrl+K): buscar, criar tarefa e criar atividade.
// Ficam separadas das actions de cada tela porque a paleta é global — chamada de
// qualquer página do app.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { requireToolUser, hasModule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { searchPalette, type PaletteHit } from "@/server/palette";
import { criarDemanda, linkDemanda, membrosDaEquipe } from "@/server/demandas";
import { normalizaMarkdownDigitado, resumoDoMarkdown } from "@/server/notas";

export type PaletteCreateState = { ok: boolean; error?: string; href?: string };

export async function paletteSearchAction(q: string): Promise<PaletteHit[]> {
  const user = await requireUser();
  try {
    return await searchPalette(user.workspaceId, q, user.id, { chamados: hasModule(user, "marketing") });
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

// Demanda rápida pela paleta. Passa pelo mesmo `criarDemanda` das outras telas;
// a paleta só decide os padrões: fica com quem digitou e, se vier `realMinutes`,
// nasce resolvida (registro de algo já feito).
export async function paletteCriarDemandaAction(input: {
  title: string;
  tipoId?: string | null;
  projectId?: string | null;
  clienteId?: string | null;
  dueDate?: string | null;
  priority?: "high" | "med" | "low";
  estimatedMinutes?: number | null;
  realMinutes?: number | null;
}): Promise<PaletteCreateState> {
  const user = await requireUser();
  const jaFeita = !!input.realMinutes && input.realMinutes > 0;
  const membros = await membrosDaEquipe(user.workspaceId);
  const podeReceber = membros.some((m) => m.id === user.id);
  const r = await criarDemanda(user, {
    title: input.title,
    origem: "planejada",
    priority: input.priority ?? "med",
    // Quem está fora da equipe pode registrar demanda, mas ela nasce sem dono.
    // Registro de algo já feito continua no nome de quem efetivamente o fez.
    assigneeId: jaFeita || podeReceber ? user.id : null,
    tipoId: input.tipoId || null,
    projectId: input.projectId || null,
    ixcClienteId: input.clienteId || null,
    dueDate: input.dueDate || null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    jaFeita: jaFeita ? { realMinutes: input.realMinutes!, solucao: input.title } : null,
  });
  if (!r.ok) return { ok: false, error: r.error };

  for (const p of ["/dashboard", "/atividades", "/kanban", "/reports", "/projects"]) revalidatePath(p);
  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, href: linkDemanda(r.numero) };
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
