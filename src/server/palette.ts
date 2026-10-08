// Busca da paleta de comandos (Ctrl+K). Varre as entidades que fazem sentido
// "ir para": projetos, demandas, clientes, notas e chamados do GLPI.
//
// Tudo em UMA consulta por tipo, com limite curto: a paleta busca a cada tecla,
// então o custo por chamada importa mais que a completude do resultado.
import "server-only";
import { db } from "@/lib/db";
import { notasVisiveisWhere } from "@/server/notas";
import { linkDemanda } from "@/server/demandas";
import { STATUS_DEMANDA } from "@/lib/meta";

export type PaletteKind = "projeto" | "tarefa" | "cliente" | "chamado" | "nota";

export interface PaletteHit {
  kind: PaletteKind;
  id: string;
  titulo: string;
  sub: string | null; // linha de apoio (cliente do projeto, status da demanda…)
  href: string;
}

const POR_TIPO = 5;

// `userId` existe por causa das notas: elas são privadas, então o filtro de
// visibilidade tem que entrar na query — nunca dá pra buscar "do workspace".
//
// `chamados` liga a busca nos chamados do GLPI, que são do Marketing: quem não
// tem acesso lá não deve nem ver o título deles.
export async function searchPalette(
  workspaceId: string,
  q: string,
  userId: string,
  opts: { chamados?: boolean } = {},
): Promise<PaletteHit[]> {
  const termo = q.trim();
  // Um dígito só é número quando vem com # ("#5"); sem #, a busca começa em 2 caracteres.
  const numero = /^(?:#\d{1,9}|\d{2,9})$/.test(termo) ? Number(termo.replace("#", "")) : null;
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
      where: {
        workspaceId,
        OR: [
          ...(numero !== null ? [{ numero }] : []),
          { title: contains },
          { solicitante: contains },
          { description: contains },
        ],
      },
      select: { id: true, numero: true, title: true, column: true, solicitante: true, project: { select: { name: true } } },
      take: POR_TIPO,
      orderBy: { createdAt: "desc" },
    }),
    db.ixcCliente.findMany({
      where: { OR: [{ razao: contains }, { cnpjCpf: contains }] },
      select: { id: true, razao: true, cnpjCpf: true },
      take: POR_TIPO,
      orderBy: { razao: "asc" },
    }),
    opts.chamados
      ? db.glpiTicket.findMany({
          where: { isDeleted: false, name: contains },
          select: { glpiId: true, name: true, statusName: true },
          take: POR_TIPO,
          orderBy: { dateCreation: "desc" },
        })
      : [],
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
    // Número exato vem primeiro: quem digita "#12" quer a 12.
    ...[...tarefas]
      .sort((a, b) => Number(b.numero === numero) - Number(a.numero === numero))
      .map((t) => ({
        kind: "tarefa" as const,
        id: t.id,
        titulo: t.title,
        sub: [`#${t.numero}`, STATUS_DEMANDA[t.column].label, t.solicitante ?? t.project?.name].filter(Boolean).join(" · "),
        href: linkDemanda(t.numero),
      })),
    ...clientes.map((c) => ({
      kind: "cliente" as const,
      id: c.id,
      titulo: c.razao,
      sub: c.cnpjCpf,
      // Todas as demandas do cliente, não só as abertas: quem busca cliente quer o histórico.
      href: `/atividades?cliente=${c.id}&status=todas`,
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
