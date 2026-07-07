import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────
// Fonte de dados de tarefas da equipe. Hoje: CRUD manual (MarketingTask).
// Futuro: integração GLPI preenchendo as mesmas tabelas com
// MarketingTask.source = "glpi" (ver docs/HANDOFF-OPENBOARD.md §1/§7).
// ─────────────────────────────────────────────────────────────────

export type TaskStatus = "pendente" | "em_andamento" | "concluida";
export type TaskPriority = "baixa" | "media" | "alta";

export interface EmployeeInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  avatarColor: string;
}

export interface TaskDTO {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  createdAt: string; // ISO
  dueDate: string | null;
  completedAt: string | null;
}

export interface TaskInput {
  employeeId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

function toDTO(t: {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  createdAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
}): TaskDTO {
  return {
    id: t.id,
    employeeId: t.employeeId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
  };
}

export async function listEmployees(): Promise<EmployeeInfo[]> {
  const rows = await db.employee.findMany({ orderBy: { name: "asc" } });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    role: e.role,
    avatarColor: e.avatarColor,
  }));
}

export async function listTasks(employeeId?: string): Promise<TaskDTO[]> {
  const rows = await db.marketingTask.findMany({
    where: employeeId ? { employeeId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function createTask(input: TaskInput): Promise<TaskDTO> {
  const row = await db.marketingTask.create({
    data: {
      employeeId: input.employeeId,
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "pendente",
      priority: input.priority ?? "media",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      completedAt: input.status === "concluida" ? new Date() : null,
    },
  });
  return toDTO(row);
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<TaskDTO> {
  const existing = await db.marketingTask.findUniqueOrThrow({ where: { id } });
  // Ao concluir, registra o momento; ao reabrir, limpa. Nunca aceitar
  // completedAt vindo do cliente — é sempre derivado da transição de status.
  let completedAt: Date | null | undefined = undefined;
  if (input.status && input.status !== existing.status) {
    completedAt = input.status === "concluida" ? new Date() : null;
  }
  const row = await db.marketingTask.update({
    where: { id },
    data: {
      ...(input.employeeId !== undefined && { employeeId: input.employeeId }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
      ...(completedAt !== undefined && { completedAt }),
    },
  });
  return toDTO(row);
}

export async function deleteTask(id: string): Promise<void> {
  await db.marketingTask.delete({ where: { id } });
}
