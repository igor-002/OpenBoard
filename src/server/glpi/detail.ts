// Detalhe de UM chamado, buscado AO VIVO no GLPI (não espelhado — descrição +
// timeline mudam a cada interação). Usado pela página /marketing/demandas/[id].
import "server-only";
import { glpiGetOne, glpiGet, glpiDate, glpiConfigured } from "@/lib/glpi";
import { htmlToText } from "@/lib/glpi-format";

type Ref = { id: number; name: string } | null;
type RawTicket = {
  id: number;
  name: string;
  content?: string;
  status?: Ref;
  type?: number;
  urgency?: number;
  impact?: number;
  priority?: number;
  entity?: { id: number; name: string } | null;
  category?: Ref;
  location?: Ref;
  request_type?: Ref;
  user_recipient?: Ref;
  team?: { id: number; name: string; display_name?: string; role: string }[];
  date_creation?: string;
  date_mod?: string;
  date_solve?: string | null;
  date_close?: string | null;
};

type RawTimelineEntry = {
  type: string; // Followup | Task | Solution | Document_Item | Validation | ...
  item?: {
    id: number;
    content?: string;
    is_private?: boolean;
    state?: number;
    status?: Ref;
    date?: string;
    date_creation?: string;
    user?: Ref;
  };
};

export interface TimelineEntry {
  id: number;
  kind: string; // rótulo pt-BR do tipo
  content: string; // já em texto (htmlToText)
  isPrivate: boolean;
  date: string | null; // ISO
  author: string;
}

export interface TicketDetail {
  glpiId: number;
  name: string;
  description: string; // texto
  statusId: number;
  statusName: string;
  typeId: number;
  priority: number;
  urgency: number;
  entityName: string;
  categoryName: string | null;
  locationName: string | null;
  requestType: string;
  requesterName: string;
  assignees: string;
  observers: string;
  dateCreation: string | null;
  dateMod: string | null;
  dateSolve: string | null;
  dateClose: string | null;
  timeline: TimelineEntry[];
}

const KIND_LABEL: Record<string, string> = {
  Followup: "Acompanhamento",
  ITILFollowup: "Acompanhamento",
  Task: "Tarefa",
  TicketTask: "Tarefa",
  Solution: "Solução",
  ITILSolution: "Solução",
  Validation: "Validação",
  TicketValidation: "Validação",
  Document_Item: "Documento",
  Document: "Documento",
};

function teamNames(team: RawTicket["team"], role: string): string {
  return (team ?? [])
    .filter((m) => m.role === role)
    .map((m) => m.display_name || m.name)
    .join(", ");
}

export async function getTicketDetail(glpiId: number): Promise<TicketDetail | null> {
  if (!glpiConfigured() || !Number.isInteger(glpiId) || glpiId <= 0) return null;

  const t = await glpiGetOne<RawTicket>(`/Assistance/Ticket/${glpiId}`);
  if (!t || !t.id) return null;

  // Timeline (acompanhamentos, tarefas, solução). Falha aqui não derruba o detalhe.
  let timeline: TimelineEntry[] = [];
  try {
    const { data } = await glpiGet<RawTimelineEntry>(`/Assistance/Ticket/${glpiId}/Timeline`, { limit: 100 });
    timeline = data
      .map((e) => {
        const it = e.item ?? ({} as NonNullable<RawTimelineEntry["item"]>);
        const dateIso = glpiDate(it.date || it.date_creation)?.toISOString() ?? null;
        return {
          id: it.id ?? 0,
          kind: KIND_LABEL[e.type] ?? e.type,
          content: htmlToText(it.content),
          isPrivate: Boolean(it.is_private),
          date: dateIso,
          author: it.user?.name ?? "",
        };
      })
      .filter((e) => e.content || e.kind)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  } catch {
    timeline = [];
  }

  return {
    glpiId: t.id,
    name: t.name ?? "",
    description: htmlToText(t.content),
    statusId: t.status?.id ?? 0,
    statusName: t.status?.name ?? "",
    typeId: t.type ?? 0,
    priority: t.priority ?? 0,
    urgency: t.urgency ?? 0,
    entityName: t.entity?.name ?? "",
    categoryName: t.category?.name ?? null,
    locationName: t.location?.name ?? null,
    requestType: t.request_type?.name ?? "",
    requesterName: teamNames(t.team, "requester") || t.user_recipient?.name || "",
    assignees: teamNames(t.team, "assigned"),
    observers: teamNames(t.team, "observer"),
    dateCreation: glpiDate(t.date_creation)?.toISOString() ?? null,
    dateMod: glpiDate(t.date_mod)?.toISOString() ?? null,
    dateSolve: glpiDate(t.date_solve)?.toISOString() ?? null,
    dateClose: glpiDate(t.date_close)?.toISOString() ?? null,
    timeline,
  };
}
