// Notas pessoais (/notas). Leitura e regra de acesso.
//
// REGRA CENTRAL: nota é privada do autor. Só chega em outra pessoa via NoteShare.
// Admin NÃO tem bypass aqui — de propósito, ao contrário de hasTool() em
// src/lib/permissions.ts. `gestao.notas` responde "pode usar a tela de notas";
// não responde "pode ler a nota da outra pessoa". Toda query desta feature passa
// por noteAccess() ou pelo filtro de visibilidade abaixo.
import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export type NoteAccess = "none" | "read" | "write" | "owner";

// Filtro de visibilidade para listagens: minhas + compartilhadas comigo.
export function notasVisiveisWhere(workspaceId: string, userId: string): Prisma.NoteWhereInput {
  return {
    workspaceId,
    OR: [{ authorId: userId }, { shares: { some: { userId } } }],
  };
}

// Filtro de EDIÇÃO: autor ou compartilhada com canEdit. Usado no where do
// updateMany do autosave — a permissão entra na mesma instrução que grava.
export function notasEditaveisWhere(workspaceId: string, userId: string): Prisma.NoteWhereInput {
  return {
    workspaceId,
    OR: [{ authorId: userId }, { shares: { some: { userId, canEdit: true } } }],
  };
}

export type NoteListItem = {
  id: string;
  title: string;
  resumo: string;
  tags: string[];
  pinned: boolean;
  updatedAt: Date;
  daOutraPessoa: boolean; // veio compartilhada
  autorNome: string;
  vinculo: { tipo: "projeto" | "cliente" | "tarefa"; label: string } | null;
};

export type NoteDetail = {
  id: string;
  title: string;
  body: string;
  version: number;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  autorNome: string;
  projectId: string | null;
  ixcClienteId: string | null;
  clienteNome: string | null; // já resolvido: o picker de cliente é busca, não lista
  taskId: string | null;
  aiResumo: string | null;
  aiAt: Date | null;
  aiModelo: string | null;
  shares: { userId: string; nome: string; iniciais: string; cor: string; canEdit: boolean }[];
  access: NoteAccess;
};

const SELECT_LISTA = {
  id: true,
  title: true,
  resumo: true,
  tags: true,
  pinned: true,
  updatedAt: true,
  authorId: true,
  author: { select: { name: true } },
  project: { select: { name: true } },
  cliente: { select: { razao: true } },
  task: { select: { title: true } },
} satisfies Prisma.NoteSelect;

function paraItem(n: Prisma.NoteGetPayload<{ select: typeof SELECT_LISTA }>, userId: string): NoteListItem {
  const vinculo = n.project
    ? ({ tipo: "projeto", label: n.project.name } as const)
    : n.cliente
      ? ({ tipo: "cliente", label: n.cliente.razao } as const)
      : n.task
        ? ({ tipo: "tarefa", label: n.task.title } as const)
        : null;
  return {
    id: n.id,
    title: n.title,
    resumo: n.resumo,
    tags: n.tags,
    pinned: n.pinned,
    updatedAt: n.updatedAt,
    daOutraPessoa: n.authorId !== userId,
    autorNome: n.author.name,
    vinculo,
  };
}

// Acesso de UM usuário a UMA nota. Devolve também a nota (evita 2ª consulta).
export async function noteAccess(userId: string, noteId: string) {
  const note = await db.note.findUnique({
    where: { id: noteId },
    include: {
      author: { select: { name: true } },
      cliente: { select: { razao: true } },
      shares: {
        select: {
          userId: true,
          canEdit: true,
          user: { select: { name: true, initials: true, color: true } },
        },
      },
    },
  });
  if (!note) return { note: null, access: "none" as NoteAccess };
  if (note.authorId === userId) return { note, access: "owner" as NoteAccess };
  const share = note.shares.find((s) => s.userId === userId);
  if (!share) return { note, access: "none" as NoteAccess };
  return { note, access: (share.canEdit ? "write" : "read") as NoteAccess };
}

export function podeEditar(a: NoteAccess) {
  return a === "owner" || a === "write";
}
export function podeVer(a: NoteAccess) {
  return a !== "none";
}

export type NotasFiltro = {
  q?: string;
  tag?: string;
  escopo?: "todas" | "minhas" | "compartilhadas";
  projectId?: string;
};

export async function listarNotas(
  workspaceId: string,
  userId: string,
  filtro: NotasFiltro = {},
): Promise<NoteListItem[]> {
  const where: Prisma.NoteWhereInput = { ...notasVisiveisWhere(workspaceId, userId) };

  if (filtro.escopo === "minhas") {
    where.OR = undefined;
    where.authorId = userId;
  } else if (filtro.escopo === "compartilhadas") {
    where.OR = undefined;
    where.authorId = { not: userId };
    where.shares = { some: { userId } };
  }

  const and: Prisma.NoteWhereInput[] = [];
  const termo = filtro.q?.trim();
  if (termo && termo.length >= 2) {
    const contains = { contains: termo, mode: "insensitive" as const };
    and.push({ OR: [{ title: contains }, { resumo: contains }, { body: contains }] });
  }
  if (filtro.tag) and.push({ tags: { has: filtro.tag } });
  if (filtro.projectId) and.push({ projectId: filtro.projectId });
  if (and.length) where.AND = and;

  const notas = await db.note.findMany({
    where,
    select: SELECT_LISTA,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 300,
  });
  return notas.map((n) => paraItem(n, userId));
}

export async function getNota(userId: string, noteId: string): Promise<NoteDetail | null> {
  const { note, access } = await noteAccess(userId, noteId);
  if (!note || !podeVer(access)) return null;
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    version: note.version,
    tags: note.tags,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    authorId: note.authorId,
    autorNome: note.author.name,
    projectId: note.projectId,
    ixcClienteId: note.ixcClienteId,
    clienteNome: note.cliente?.razao ?? null,
    taskId: note.taskId,
    aiResumo: note.aiResumo,
    aiAt: note.aiAt,
    aiModelo: note.aiModelo,
    shares: note.shares.map((s) => ({
      userId: s.userId,
      nome: s.user.name,
      iniciais: s.user.initials,
      cor: s.user.color,
      canEdit: s.canEdit,
    })),
    access,
  };
}

// Notas de um projeto que ESTE usuário pode ver (aba "Notas" do projeto).
export async function notasDoProjeto(
  workspaceId: string,
  userId: string,
  projectId: string,
): Promise<NoteListItem[]> {
  const notas = await db.note.findMany({
    where: { ...notasVisiveisWhere(workspaceId, userId), projectId },
    select: SELECT_LISTA,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  return notas.map((n) => paraItem(n, userId));
}

// Tags distintas que aparecem nas notas visíveis — alimenta o filtro da sidebar.
export async function tagsDoUsuario(workspaceId: string, userId: string): Promise<string[]> {
  const notas = await db.note.findMany({
    where: notasVisiveisWhere(workspaceId, userId),
    select: { tags: true },
    take: 300,
  });
  const set = new Set<string>();
  for (const n of notas) for (const t of n.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Opções dos seletores de vínculo. Só projeto e tarefa viram <select>: são
// listas curtas. Cliente NÃO entra aqui — o espelho do IXC tem milhares de
// linhas, e um select truncado só mostraria quem começa com "A". O picker de
// cliente é busca (searchClientes, o mesmo de /atividades).
export async function opcoesVinculo(workspaceId: string, userId: string) {
  const [projetos, tarefas] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, status: { not: "done" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.task.findMany({
      where: { workspaceId, assigneeId: userId, column: { not: "done" } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { projetos, tarefas };
}

// Texto puro das primeiras linhas do markdown — usado na lista e na busca.
// Tira marcações de bloco comuns; não precisa ser um parser, só ficar legível.
export function resumoDoMarkdown(md: string): string {
  const limpo = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.slice(0, 300);
}

// Markdown digitado à mão (paleta Ctrl+K) → markdown que o editor entende.
// No editor "[] " vira checkbox por input rule, mas em markdown a sintaxe é
// "- [ ] "; sem isto o "[]" chegaria na nota como texto cru.
export function normalizaMarkdownDigitado(md: string): string {
  return md
    .split("\n")
    .map((linha) =>
      linha.replace(/^(\s*)(?:[-*+]\s+)?\[([ xX]?)\]\s+/, (_m, espaco: string, marca: string) => {
        const feito = marca.toLowerCase() === "x" ? "x" : " ";
        return `${espaco}- [${feito}] `;
      }),
    )
    .join("\n");
}

// Título automático quando a pessoa não digitou um: 1ª linha com conteúdo.
export function tituloDoMarkdown(md: string): string {
  const linha = resumoDoMarkdown(md).slice(0, 80).trim();
  return linha || "Sem título";
}
