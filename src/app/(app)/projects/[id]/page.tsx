import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProjectDetail, getProjectForEdit } from "@/server/projects";
import { getUsers } from "@/server/users";
import { ProjectDetailActions } from "@/components/project/ProjectDetailActions";
import { ProjectNotes } from "@/components/project/ProjectNotes";
import { ProjectTeam } from "@/components/project/ProjectTeam";
import { ProjectMilestones } from "@/components/project/ProjectMilestones";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityBadge } from "@/components/ui/Badge";
import { fullLabel, dayLabel } from "@/lib/format";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [p, edit, users] = await Promise.all([
    getProjectDetail(user.workspaceId, id),
    getProjectForEdit(user.workspaceId, id),
    getUsers(user.workspaceId),
  ]);
  if (!p || !edit) notFound();
  const memberOpts = users.map((u) => ({ id: u.id, name: u.name }));

  const daysOpen = Math.max(0, Math.floor((Date.now() - +p.startDate) / 86400000));
  const daysLeft = p.dueDate ? Math.max(0, Math.ceil((+p.dueDate - Date.now()) / 86400000)) : null;

  const facts: [IconName, string][] = [
    ["layers", `${p.tasksTotal} tarefas`],
    [
      "calendar",
      p.dueDate ? `${dayLabel(p.startDate)} → ${fullLabel(p.dueDate)}` : `Início ${fullLabel(p.startDate)} · sem prazo definido`,
    ],
    ["clock", `${daysOpen} dias desde o início`],
  ];

  const summary: [string, string, string][] = [
    ["Progresso", p.progress + "%", "var(--primary)"],
    ["Tarefas", p.tasksDone + "/" + p.tasksTotal, "var(--st-progress)"],
    daysLeft !== null
      ? ["Dias restantes", String(daysLeft), "var(--st-done)"]
      : ["Dias em aberto", String(daysOpen), "var(--pr-med)"],
  ];

  const detalhes = (
    <>
      <p style={{ margin: "0 0 18px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65 }}>
        Projeto <b>{p.name}</b> para <b>{p.client}</b>. Progresso atual de {p.progress}% com {p.tasksDone} de {p.tasksTotal} tarefas concluídas.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
        {facts.map(([ic, txt], i) => (
          <div key={i} className="row gap12">
            <span style={{ color: "var(--muted)", flex: "none" }}><Icon name={ic} size={18} /></span>
            <span style={{ fontSize: 13.5, color: "var(--ink-2)", fontWeight: 500 }}>{txt}</span>
          </div>
        ))}
      </div>
      {p.creator && (
        <div className="row gap8" style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          <Avatar user={p.creator} size={22} />
          <span>Criado por <b style={{ color: "var(--ink-2)" }}>{p.creator.name}</b> · {fullLabel(p.createdAt)}</span>
        </div>
      )}
      <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />
      <ProjectTeam projectId={p.id} members={p.members} allUsers={memberOpts} />
    </>
  );

  const tarefas =
    p.tasks.length === 0 ? (
      <div className="muted" style={{ fontSize: 13.5 }}>
        Sem tarefas ainda. Crie no <Link href="/kanban" style={{ color: "var(--primary)", fontWeight: 700 }}>quadro</Link>.
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {p.tasks.map((t) => (
          <div key={t.id} className="row gap12">
            <Icon name={t.column === "done" ? "checkCircle" : "circle"} size={18} style={{ color: t.column === "done" ? "var(--st-done)" : "var(--muted-2)", flex: "none" }} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: t.column === "done" ? "line-through" : "none", color: t.column === "done" ? "var(--muted)" : "var(--ink-2)" }}>
              {t.title}
            </span>
            <PriorityBadge pr={t.priority} />
            {t.assignee && <Avatar user={t.assignee} size={26} />}
          </div>
        ))}
      </div>
    );

  const observacoes = (
    <ProjectNotes projectId={p.id} notes={p.notes} currentUserId={user.id} isAdmin={user.role === "admin"} />
  );

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <Link className="btn btn-ghost" href="/projects" style={{ paddingLeft: 8 }}>
          <Icon name="chevLeft" size={16} />
          Voltar para projetos
        </Link>
        <ProjectDetailActions project={edit} users={memberOpts} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        {/* coluna esquerda */}
        <div className="grid" style={{ gap: "var(--gap)", alignContent: "start" }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-700) 100%)", padding: "26px var(--card-pad)", color: "#fff", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)", backgroundSize: "18px 18px" }} />
              <span className="tag" style={{ position: "relative", background: "rgba(255,255,255,.18)", color: "#fff", border: "none" }}>{p.tag}</span>
              <h1 style={{ position: "relative", margin: "16px 0 10px", fontSize: 25, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1.2, fontFamily: "var(--font-display)" }}>
                {p.name}
              </h1>
              <div className="row gap16" style={{ position: "relative", fontSize: 13, fontWeight: 600, opacity: 0.95, flexWrap: "wrap" }}>
                <span className="row gap8"><Icon name="briefcase" size={15} />{p.client}</span>
                <span className="row gap8"><Icon name="calendar" size={15} />{p.dueDate ? `${dayLabel(p.startDate)} → ${fullLabel(p.dueDate)}` : `Início ${dayLabel(p.startDate)} · ${daysOpen}d em aberto`}</span>
              </div>
            </div>
          </div>

          <Tabs
            items={[
              { key: "detalhes", label: "Detalhes", node: detalhes },
              { key: "tarefas", label: "Tarefas", node: tarefas },
              { key: "observacoes", label: "Observações", node: observacoes },
            ]}
          />
        </div>

        {/* coluna direita */}
        <div className="grid" style={{ gap: "var(--gap)", alignContent: "start" }}>
          <Card title="Resumo">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {summary.map(([l, v, c], i) => (
                <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)", color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Marcos" sub="Entregas do projeto">
            <ProjectMilestones projectId={p.id} milestones={p.milestones} />
          </Card>
        </div>
      </div>
    </div>
  );
}
