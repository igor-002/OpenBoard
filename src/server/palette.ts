// Busca da paleta de comandos (Ctrl+K). Varre as entidades que fazem sentido
// "ir para": projetos, tarefas/atividades, clientes e chamados do GLPI.
//
// Tudo em UMA consulta por tipo, com limite curto: a paleta busca a cada tecla,
// então o custo por chamada importa mais que a completude do resultado.
import "server-only";
import { db } from "@/lib/db";
import { notasVisiveisWhere } from "@/server/notas";

export type PaletteKind = "projeto" | "tarefa" | "cliente" | "chamado" | "nota";

export interface PaletteHit {
  kind: PaletteKind;
  id: string;
  titulo: string;
  sub: string | null; // linha de apoio (cliente do projeto, projeto da tarefa…)
  href: string;
}

const POR_TIPO = 5;

// `userId` existe por causa das notas: elas são privadas, então o filtro de
// visibilidade tem que entrar na query — nunca dá pra buscar "do workspace".
export async function searchPalette(workspaceId: string, q: string, userId: string): Promise<PaletteHit[]> {
  const termo = q.trim();
  if (termo.length < 2) return [];
  const contains = { contains: termo, mode: "insensitive" as const };

  const [projetos, tarefas, clientes, chamados, notas] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, OR: [{ name: contains }, { client: contains }] },
      select: { id: true, name: true, client: true, status: true },
      take: POR_TIPO,
      orderBy: { createdAt: "desc" },
    }),
    db.task.findMany({
      where: { workspaceId, title: contains },
      select: { id: true, title: true, projectId: true, project: { select: { name: true } }, column: true },
      take: POR_TIPO,
      orderBy: { createdAt: "desc" },
    }),
    db.ixcCliente.findMany({
      where: { OR: [{ razao: contains }, { cnpjCpf: contains }] },
      select: { id: true, razao: true, cnpjCpf: true },
      take: POR_TIPO,
      orderBy: { razao: "asc" },
    }),
    db.glpiTicket.findMany({
      where: { isDeleted: false, name: contains },
      select: { glpiId: true, name: true, statusName: true },
      take: POR_TIPO,
      orderBy: { dateCreation: "desc" },
    }),
    db.note.findMany({
      where: {
        workspaceId,
        // Duas condições OR na mesma query precisam ir dentro de AND, senão a
        // segunda sobrescreve a primeira — e a busca vazaria nota de outra pessoa.
        AND: [
          notasVisiveisWhere(workspaceId, userId),
          { OR: [{ title: contains }, { resumo: contains }] },
        ],
      },
      // Sem `body`: listagem não carrega o markdown inteiro.
      select: { id: true, title: true, resumo: true, authorId: true },
      take: POR_TIPO,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return [
    ...projetos.map((p) => ({
      kind: "projeto" as const,
      id: p.id,
      titulo: p.name,
      sub: p.client || null,
      href: `/projects/${p.id}`,
    })),
    ...tarefas.map((t) => ({
      kind: "tarefa" as const,
      id: t.id,
      titulo: t.title,
      sub: t.project?.name ?? "Atividade avulsa",
      // Tarefa de projeto abre o projeto; atividade avulsa vive em /atividades.
      href: t.projectId ? `/projects/${t.projectId}` : "/atividades",
    })),
    ...clientes.map((c) => ({
      kind: "cliente" as const,
      id: c.id,
      titulo: c.razao,
      sub: c.cnpjCpf,
      href: `/atividades?cliente=${c.id}`,
    })),
    ...chamados.map((t) => ({
      kind: "chamado" as const,
      id: String(t.glpiId),
      titulo: t.name,
      sub: `#${t.glpiId} · ${t.statusName}`,
      href: `/marketing/demandas/${t.glpiId}`,
    })),
    ...notas.map((n) => ({
      kind: "nota" as const,
      id: n.id,
      titulo: n.title || "Sem título",
      sub: n.resumo || (n.authorId === userId ? null : "compartilhada com você"),
      href: `/notas?n=${n.id}`,
    })),
  ];
}
