"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToolUser } from "@/lib/permissions";
import { notify } from "@/server/notifications";
import { emitAppEvent } from "@/server/events";
import {
  getNota,
  noteAccess,
  notasEditaveisWhere,
  notasVisiveisWhere,
  podeEditar,
  podeVer,
  resumoDoMarkdown,
  tituloDoMarkdown,
} from "@/server/notas";
import { extrairTarefas, perguntarSobreNota, resumirNota, type TarefaSugerida } from "@/server/notas-ai";

export type NotaState = { ok?: boolean; error?: string; id?: string };

const TOOL = "gestao.notas";
// Nota gigante não pode derrubar a listagem nem estourar o contexto da IA.
const MAX_BODY = 200_000;

// ── Helpers ────────────────────────────────────────────────────────────────

async function comAcesso(noteId: string, precisaEditar: boolean) {
  const user = await requireToolUser(TOOL);
  const { note, access } = await noteAccess(user.id, noteId);
  if (!note || !podeVer(access)) return { erro: "Nota não encontrada." as const };
  if (precisaEditar && !podeEditar(access)) return { erro: "Sem permissão para editar esta nota." as const };
  if (note.workspaceId !== user.workspaceId) return { erro: "Nota não encontrada." as const };
  return { user, note, access };
}

function revalidarNota(projectId?: string | null) {
  revalidatePath("/notas");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

// Vínculos precisam ser do mesmo workspace (cliente do IXC é global).
async function validaVinculos(
  workspaceId: string,
  v: { projectId?: string | null; ixcClienteId?: string | null; taskId?: string | null },
): Promise<string | null> {
  if (v.projectId) {
    const p = await db.project.findFirst({ where: { id: v.projectId, workspaceId }, select: { id: true } });
    if (!p) return "Projeto inválido.";
  }
  if (v.taskId) {
    const t = await db.task.findFirst({ where: { id: v.taskId, workspaceId }, select: { id: true } });
    if (!t) return "Tarefa inválida.";
  }
  if (v.ixcClienteId) {
    const c = await db.ixcCliente.findUnique({ where: { id: v.ixcClienteId }, select: { id: true } });
    if (!c) return "Cliente inválido.";
  }
  return null;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function criarNota(input: {
  title?: string;
  body?: string;
  projectId?: string | null;
  ixcClienteId?: string | null;
  taskId?: string | null;
}): Promise<NotaState> {
  const user = await requireToolUser(TOOL);
  const body = (input.body ?? "").slice(0, MAX_BODY);
  const title = (input.title ?? "").trim().slice(0, 200);

  const erro = await validaVinculos(user.workspaceId, input);
  if (erro) return { error: erro };

  const nota = await db.note.create({
    data: {
      workspaceId: user.workspaceId,
      authorId: user.id,
      // Título vazio de propósito: o campo mostra placeholder e o primeiro save
      // deriva o título da 1ª linha do texto (a lista exibe "Sem título").
      title: title || (body ? tituloDoMarkdown(body) : ""),
      body,
      resumo: resumoDoMarkdown(body),
      projectId: input.projectId || null,
      ixcClienteId: input.ixcClienteId || null,
      taskId: input.taskId || null,
    },
    select: { id: true },
  });

  revalidarNota(input.projectId);
  return { ok: true, id: nota.id };
}

const salvarSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  body: z.string().max(MAX_BODY),
  version: z.number().int().nonnegative(),
});

export type SalvarState =
  | { ok: true; version: number; savedAt: string }
  | { ok: false; error: string }
  | { ok: false; conflito: true; atual: { title: string; body: string; version: number; editorNome: string; quando: string } };

// Autosave. `version` é o token: o UPDATE só acontece se a linha ainda estiver
// na versão que o cliente carregou (compare-and-swap). Permissão e versão vão
// no MESMO where — não existe janela entre checar e gravar.
//
// NÃO revalida a rota: revalidar a cada tecla derrubaria a árvore do client
// em pleno digitar. Revalidação fica para criar/excluir/vincular/compartilhar.
export async function salvarNotaAction(input: z.input<typeof salvarSchema>): Promise<SalvarState> {
  const p = salvarSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Dados inválidos." };

  const user = await requireToolUser(TOOL);
  const body = p.data.body;
  const title = p.data.title.trim().slice(0, 200) || tituloDoMarkdown(body);

  const r = await db.note.updateMany({
    where: {
      id: p.data.id,
      version: p.data.version,
      ...notasEditaveisWhere(user.workspaceId, user.id),
    },
    data: {
      title,
      body,
      resumo: resumoDoMarkdown(body),
      version: { increment: 1 },
      lastEditorId: user.id,
    },
  });

  if (r.count === 1) {
    return { ok: true, version: p.data.version + 1, savedAt: new Date().toISOString() };
  }

  // count 0 = versão velha OU sem permissão. Distingue relendo com o filtro de leitura.
  const atual = await db.note.findFirst({
    where: { id: p.data.id, ...notasVisiveisWhere(user.workspaceId, user.id) },
    select: {
      title: true,
      body: true,
      version: true,
      updatedAt: true,
      lastEditorId: true,
    },
  });
  if (!atual) return { ok: false, error: "Nota não encontrada." };
  if (atual.version === p.data.version) return { ok: false, error: "Sem permissão para editar esta nota." };

  const editor = atual.lastEditorId
    ? await db.user.findUnique({ where: { id: atual.lastEditorId }, select: { name: true } })
    : null;

  return {
    ok: false,
    conflito: true,
    atual: {
      title: atual.title,
      body: atual.body,
      version: atual.version,
      editorNome: editor?.name ?? "Outra pessoa",
      quando: atual.updatedAt.toISOString(),
    },
  };
}

// Consulta minúscula usada quando a aba volta ao foco: se a versão do servidor
// subiu e não há alteração local, o client recarrega sozinho (evita conflito).
export async function versaoDaNota(noteId: string): Promise<number | null> {
  const user = await requireToolUser(TOOL);
  const n = await db.note.findFirst({
    where: { id: noteId, ...notasVisiveisWhere(user.workspaceId, user.id) },
    select: { version: true },
  });
  return n?.version ?? null;
}

// Recarrega o conteúdo de uma nota sem navegação RSC (troca de nota na lista).
export async function carregarNota(noteId: string) {
  const user = await requireToolUser(TOOL);
  return getNota(user.id, noteId);
}

export async function excluirNota(noteId: string): Promise<NotaState> {
  const r = await comAcesso(noteId, false);
  if ("erro" in r) return { error: r.erro };
  // Só o dono apaga. Quem recebeu compartilhado sai pelo "sair da nota".
  if (r.access !== "owner") return { error: "Só o autor pode excluir a nota." };

  await db.note.delete({ where: { id: noteId } });
  revalidarNota(r.note.projectId);
  return { ok: true };
}

export async function vincularNota(input: {
  id: string;
  projectId?: string | null;
  ixcClienteId?: string | null;
  taskId?: string | null;
}): Promise<NotaState> {
  const r = await comAcesso(input.id, false);
  if ("erro" in r) return { error: r.erro };
  if (r.access !== "owner") return { error: "Só o autor muda o vínculo da nota." };

  const erro = await validaVinculos(r.user.workspaceId, input);
  if (erro) return { error: erro };

  await db.note.update({
    where: { id: input.id },
    data: {
      projectId: input.projectId || null,
      ixcClienteId: input.ixcClienteId || null,
      taskId: input.taskId || null,
    },
  });

  revalidarNota(r.note.projectId);
  revalidarNota(input.projectId);
  return { ok: true };
}

export async function alternarPin(noteId: string): Promise<NotaState> {
  const r = await comAcesso(noteId, true);
  if ("erro" in r) return { error: r.erro };
  await db.note.update({ where: { id: noteId }, data: { pinned: !r.note.pinned } });
  revalidarNota(r.note.projectId);
  return { ok: true };
}

export async function definirTags(noteId: string, tags: string[]): Promise<NotaState> {
  const r = await comAcesso(noteId, true);
  if ("erro" in r) return { error: r.erro };

  const limpas = [...new Set(tags.map((t) => t.trim().replace(/^#/, "").slice(0, 30)).filter(Boolean))].slice(0, 12);
  await db.note.update({ where: { id: noteId }, data: { tags: limpas } });
  revalidarNota(r.note.projectId);
  return { ok: true };
}

// ── Compartilhamento ───────────────────────────────────────────────────────

export async function compartilharNota(noteId: string, userId: string, canEdit: boolean): Promise<NotaState> {
  const r = await comAcesso(noteId, false);
  if ("erro" in r) return { error: r.erro };
  if (r.access !== "owner") return { error: "Só o autor compartilha a nota." };
  if (userId === r.user.id) return { error: "A nota já é sua." };

  const destino = await db.user.findFirst({
    where: { id: userId, workspaceId: r.user.workspaceId },
    select: { id: true },
  });
  if (!destino) return { error: "Usuário inválido." };

  const jaTinha = await db.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId } },
    select: { canEdit: true },
  });

  await db.noteShare.upsert({
    where: { noteId_userId: { noteId, userId } },
    create: { noteId, userId, canEdit },
    update: { canEdit },
  });

  // Avisa só quando o acesso é novo — mudar de ver p/ editar não vira toast.
  if (!jaTinha) {
    const link = `/notas?n=${noteId}`;
    await notify([userId], {
      type: "nota_compartilhada",
      title: `${r.user.name} compartilhou uma nota com você`,
      body: r.note.title,
      link,
    });
    emitAppEvent({
      kind: "nota_compartilhada",
      recipientIds: [userId],
      actorName: r.user.name,
      entity: r.note.title || "Sem título",
      link,
    });
  }

  revalidatePath("/notas");
  return { ok: true };
}

export async function removerCompartilhamento(noteId: string, userId: string): Promise<NotaState> {
  const r = await comAcesso(noteId, false);
  if ("erro" in r) return { error: r.erro };
  // O dono remove qualquer um; quem recebeu pode remover a si mesmo ("sair").
  if (r.access !== "owner" && userId !== r.user.id) return { error: "Sem permissão." };

  await db.noteShare.deleteMany({ where: { noteId, userId } });
  revalidatePath("/notas");
  return { ok: true };
}

// Pessoas do workspace que podem receber a nota.
export async function usuariosParaCompartilhar(): Promise<{ id: string; nome: string; iniciais: string; cor: string; cargo: string }[]> {
  const user = await requireToolUser(TOOL);
  const users = await db.user.findMany({
    where: { workspaceId: user.workspaceId, id: { not: user.id } },
    select: { id: true, name: true, initials: true, color: true, jobTitle: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, nome: u.name, iniciais: u.initials, cor: u.color, cargo: u.jobTitle }));
}

// ── IA ─────────────────────────────────────────────────────────────────────

export async function resumirNotaAction(noteId: string): Promise<{ ok: true; resumo: string } | { ok: false; error: string }> {
  const user = await requireToolUser(TOOL);
  const r = await resumirNota(user.id, noteId);
  if (r.ok) revalidatePath("/notas");
  return r;
}

export async function perguntarNotaAction(
  noteId: string,
  pergunta: string,
): Promise<{ ok: true; resposta: string } | { ok: false; error: string }> {
  const user = await requireToolUser(TOOL);
  return perguntarSobreNota(user.id, noteId, pergunta);
}

export async function extrairTarefasAction(
  noteId: string,
): Promise<{ ok: true; tarefas: TarefaSugerida[] } | { ok: false; error: string }> {
  const user = await requireToolUser(TOOL);
  return extrairTarefas(user.id, noteId);
}

// Cria as Task escolhidas pela pessoa (a IA só sugere).
export async function criarTarefasDaNotaAction(
  noteId: string,
  tarefas: TarefaSugerida[],
): Promise<{ ok?: boolean; error?: string; criadas?: number }> {
  const r = await comAcesso(noteId, false);
  if ("erro" in r) return { error: r.erro };

  const lista = tarefas
    .map((t) => ({ titulo: t.titulo.trim().slice(0, 160), prazo: t.prazo }))
    .filter((t) => t.titulo)
    .slice(0, 10);
  if (!lista.length) return { error: "Nenhuma tarefa selecionada." };

  // Entram no topo do "A fazer", como na captura rápida da paleta.
  const menor = await db.task.aggregate({
    where: { workspaceId: r.user.workspaceId, projectId: r.note.projectId, column: "todo" },
    _min: { order: true },
  });
  let ordem = (menor._min.order ?? 0) - 1;

  for (const t of lista) {
    const due = t.prazo ? new Date(`${t.prazo}T12:00:00`) : null;
    await db.task.create({
      data: {
        workspaceId: r.user.workspaceId,
        projectId: r.note.projectId,
        title: t.titulo,
        column: "todo",
        assigneeId: r.user.id,
        order: ordem--,
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        origem: r.note.projectId ? "planejada" : "avulsa",
      },
    });
  }

  revalidatePath("/kanban");
  revalidatePath("/atividades");
  if (r.note.projectId) revalidatePath(`/projects/${r.note.projectId}`);
  return { ok: true, criadas: lista.length };
}
