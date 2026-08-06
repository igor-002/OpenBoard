// Card de projeto clicável. Portado de screens-a.jsx.
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { AvatarStack } from "@/components/ui/Avatar";
import { dayLabel, deadlineInfo, deadlineColor } from "@/lib/format";
import type { ProjectListItem } from "@/server/projects";

export function ProjectCard({ p }: { p: ProjectListItem }) {
  // Projeto concluído não tem urgência de prazo (não marca "atrasado").
  const dl = p.dueDate && p.status !== "done" ? deadlineInfo(p.dueDate) : null;
  return (
    <Link href={`/projects/${p.id}`} className="card card-pad proj-card">
      <div className="row between" style={{ marginBottom: 14 }}>
        <span className="tag">{p.tag}</span>
        <div className="row gap8">
          {p.risk && (
            <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>
              <Icon name="alert" size={12} />
              Em risco
            </span>
          )}
          <StatusBadge status={p.status} />
        </div>
      </div>
      <h3 style={{ margin: "0 0 4px", fontSize: 16.5, fontWeight: 800, letterSpacing: "-.3px", lineHeight: 1.25, fontFamily: "var(--font-display)" }}>
        {p.name}
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{p.client}</p>

      <div style={{ margin: "18px 0 16px" }}>
        <div className="row between" style={{ marginBottom: 7 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Progresso</span>
          <b style={{ fontSize: 13 }}>{p.progress}%</b>
        </div>
        <ProgressBar value={p.progress} color={p.status === "done" ? "var(--st-done)" : "var(--primary)"} />
      </div>

      <div className="row between" style={{ paddingTop: 15, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Tarefas</div>
            <b style={{ fontSize: 14 }}>{p.tasksDone}/{p.tasksTotal}</b>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Prazo</div>
            {dl ? (
              <b style={{ fontSize: 14, color: deadlineColor(dl.tone) }} title={dayLabel(p.dueDate!)}>{dl.label}</b>
            ) : (
              <b style={{ fontSize: 14 }}>{p.dueDate ? dayLabel(p.dueDate) : "Sem prazo"}</b>
            )}
          </div>
        </div>
        <AvatarStack users={p.members} size={28} />
      </div>
    </Link>
  );
}
