"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/server/notifications";
import { emitAppEvent } from "@/server/events";

export type ProjectActionState = { ok?: boolean; error?: string; id?: string };

const schema = z.object({
  name: z.string().min(2, "Informe o nome do projeto"),
  client: z.string().min(1, "Informe o cliente"),
  tag: z.string().min(1, "Informe uma categoria"),
  status: z.enum(["progress", "done", "review", "planned"]),
  startDate: z.string().min(1, "Informe a data de início"),
  dueDate: z.string().optional(), // vazio = sem prazo
  manualProgress: z.number().min(0).max(100).nullable(), // null = progresso automático
  risk: z.boolean(),
  memberIds: z.array(z.string()),
});

function parse(formData: FormData) {
  // "progressManual" ligado => usa o número digitado; senão progresso automático (null).
  const manual = formData.get("progressManual") === "on";
  const raw = Number(formData.get("progress"));
  const manualProgress = manual && Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : null;

  return schema.safeParse({
    name: formData.get("name"),
    client: formData.get("client"),
    tag: formData.get("tag"),
    status: formData.get("status"),
    startDate: formData.get("startDate"),
    dueDate: formData.get("dueDate")?.toString() || undefined,
    manualProgress,
    risk: formData.get("risk") === "on",
    memberIds: formData.getAll("memberIds").map(String),
  });
}

// data de prazo (meio-dia local p/ não deslocar fuso) ou null.
const dueDateValue = (s?: string) => (s ? new Date(s + "T12:00:00") : null);

// membros válidos = os que pertencem ao workspace.
async function buildMembers(workspaceId: string, memberIds: string[]) {
  const valid = await db.user.findMany({
    where: { workspaceId, id: { in: memberIds } },
    select: { id: true },
  });
  return valid.map((u, i) => ({ userId: u.id, isLead: false, order: i }));
}

export async function createProject(_prev: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const user = await requireUser();
  const p = parse(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const members = await buildMembers(user.workspaceId, d.memberIds);
  const created = await db.project.create({
    data: {
      workspaceId: user.workspaceId,
      name: d.name,
      client: d.client,
      tag: d.tag,
      status: d.status,
      manualProgress: d.manualProgress,
      startDate: new Date(d.startDate + "T12:00:00"),
      dueDate: dueDateValue(d.dueDate),
      risk: d.risk,
      creatorId: user.id,
      members: members.length ? { create: members } : undefined,
    },
  });

  // Notifica quem foi adicionado à equipe (menos você).
  const memberIds = members.map((m) => m.userId);
  await notify(
    memberIds.filter((id) => id !== user.id),
    { type: "project_member", title: "Você foi adicionado a um projeto", body: d.name, link: `/projects/${created.id}` },
  );

  // Anúncio para o resto do workspace (menos o autor e quem já foi avisado).
  const others = await db.user.findMany({
    where: { workspaceId: user.workspaceId, id: { notIn: [user.id, ...memberIds] } },
    select: { id: true },
  });
  await notify(others.map((u) => u.id), {
    type: "project_created",
    title: "Novo projeto criado",
    body: `${d.name} · por ${user.name}`,
    link: `/projects/${created.id}`,
  });

  // Toast em tempo real para quem estiver online.
  emitAppEvent({
    kind: "project_created",
    workspaceId: user.workspaceId,
    actorId: user.id,
    actorName: user.name,
    entity: d.name,
    link: `/projects/${created.id}`,
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  return { ok: true, id: created.id };
}

export async function updateProject(projectId: string, _prev: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const user = await requireUser();
  const exists = await db.project.findFirst({ where: { id: projectId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!exists) return { error: "Projeto não encontrado." };

  const p = parse(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const before = new Set((await db.projectMember.findMany({ where: { projectId }, select: { userId: true } })).map((m) => m.userId));
  const members = await buildMembers(user.workspaceId, d.memberIds);
  await db.$transaction([
    db.projectMember.deleteMany({ where: { projectId } }),
    db.project.update({
      where: { id: projectId },
      data: {
        name: d.name,
        client: d.client,
        tag: d.tag,
        status: d.status,
        manualProgress: d.manualProgress,
        startDate: new Date(d.startDate + "T12:00:00"),
        dueDate: dueDateValue(d.dueDate),
        risk: d.risk,
        members: members.length ? { create: members } : undefined,
      },
    }),
  ]);

  // Notifica só os membros recém-adicionados (menos você).
  await notify(
    members.map((m) => m.userId).filter((id) => !before.has(id) && id !== user.id),
    { type: "project_member", title: "Você foi adicionado a um projeto", body: d.name, link: `/projects/${projectId}` },
  );

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  return { ok: true, id: projectId };
}

export type NoteActionState = { ok?: boolean; error?: string };

const noteSchema = z.object({ body: z.string().min(1, "Escreva algo").max(2000) });

export async function addNote(projectId: string, _prev: NoteActionState, formData: FormData): Promise<NoteActionState> {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: user.workspaceId },
    select: { id: true, name: true, members: { select: { userId: true } } },
  });
  if (!project) return { error: "Projeto não encontrado." };

  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const body = parsed.data.body.trim();
  await db.projectNote.create({ data: { projectId, authorId: user.id, body } });

  // Notifica os membros do projeto (menos o autor).
  await notify(
    project.members.map((m) => m.userId).filter((id) => id !== user.id),
    { type: "note_added", title: `Nova anotação em ${project.name}`, body: body.slice(0, 90), link: `/projects/${projectId}` },
  );

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// Exclui anotação: autor ou admin.
export async function deleteNote(noteId: string): Promise<NoteActionState> {
  const user = await requireUser();
  const note = await db.projectNote.findFirst({
    where: { id: noteId, project: { workspaceId: user.workspaceId } },
    select: { id: true, authorId: true, projectId: true },
  });
  if (!note) return { error: "Anotação não encontrada." };
  if (note.authorId !== user.id && user.role !== "admin") return { error: "Sem permissão." };

  await db.projectNote.delete({ where: { id: noteId } });
  revalidatePath(`/projects/${note.projectId}`);
  return { ok: true };
}

// ---------- Marcos ----------
export type MilestoneState = { ok?: boolean; error?: string };

const milestoneSchema = z.object({
  title: z.string().min(2, "Informe o título do marco"),
  state: z.enum(["done", "doing", "todo"]),
  date: z.string().min(1, "Informe a data"),
});

async function assertProject(projectId: string, workspaceId: string) {
  return db.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
}

export async function addMilestone(projectId: string, _prev: MilestoneState, formData: FormData): Promise<MilestoneState> {
  const user = await requireUser();
  if (!(await assertProject(projectId, user.workspaceId))) return { error: "Projeto não encontrado." };
  const parsed = milestoneSchema.safeParse({
    title: formData.get("title"),
    state: formData.get("state") || "todo",
    date: formData.get("date"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const count = await db.milestone.count({ where: { projectId } });
  await db.milestone.create({
    data: { projectId, title: parsed.data.title, state: parsed.data.state, date: new Date(parsed.data.date + "T12:00:00"), order: count },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function setMilestoneState(milestoneId: string, state: "done" | "doing" | "todo"): Promise<MilestoneState> {
  const user = await requireUser();
  const m = await db.milestone.findFirst({ where: { id: milestoneId, project: { workspaceId: user.workspaceId } }, select: { id: true, projectId: true } });
  if (!m) return { error: "Marco não encontrado." };
  await db.milestone.update({ where: { id: milestoneId }, data: { state } });
  revalidatePath(`/projects/${m.projectId}`);
  return { ok: true };
}

export async function deleteMilestone(milestoneId: string): Promise<MilestoneState> {
  const user = await requireUser();
  const m = await db.milestone.findFirst({ where: { id: milestoneId, project: { workspaceId: user.workspaceId } }, select: { id: true, projectId: true } });
  if (!m) return { error: "Marco não encontrado." };
  await db.milestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/projects/${m.projectId}`);
  return { ok: true };
}

// ---------- Equipe ----------
export type MemberState = { ok?: boolean; error?: string };

export async function addMember(projectId: string, userId: string): Promise<MemberState> {
  const user = await requireUser();
  if (!(await assertProject(projectId, user.workspaceId))) return { error: "Projeto não encontrado." };
  const target = await db.user.findFirst({ where: { id: userId, workspaceId: user.workspaceId }, select: { id: true } });
  if (!target) return { error: "Usuário inválido." };
  const exists = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (exists) return { ok: true };
  const count = await db.projectMember.count({ where: { projectId } });
  await db.projectMember.create({ data: { projectId, userId, isLead: false, order: count } });
  if (userId !== user.id) {
    await notify([userId], { type: "project_member", title: "Você foi adicionado a um projeto", link: `/projects/${projectId}` });
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMember(projectId: string, userId: string): Promise<MemberState> {
  const user = await requireUser();
  if (!(await assertProject(projectId, user.workspaceId))) return { error: "Projeto não encontrado." };
  await db.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<void> {
  const user = await requireUser();
  const exists = await db.project.findFirst({ where: { id: projectId, workspaceId: user.workspaceId }, select: { id: true } });
  if (exists) {
    await db.project.delete({ where: { id: projectId } });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
  }
  redirect("/projects");
}
