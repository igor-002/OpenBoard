// Card de projeto clicável. Portado de screens-a.jsx.
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { AvatarStack } from "@/components/ui/Avatar";
import { dayLabel, deadlineInfo, deadlineColor } from "@/lib/format";
import { STATUS_META } from "@/lib/meta";
import type { ProjectListItem } from "@/server/projects";
import styles from "./ProjectsList.module.css";

export function ProjectCard({ p }: { p: ProjectListItem }) {
  // Projeto concluído não tem urgência de prazo (não marca "atrasado").
  const dl = p.dueDate && p.status !== "done" ? deadlineInfo(p.dueDate) : null;
  const statusColor = STATUS_META[p.status].c;

  // draggable={false}: o drag nativo de âncora do browser briga com o @dnd-kit
  // no quadro (ver DraggableCard em ProjectsList).
  return (
    <Link href={`/projects/${p.id}`} className={`card ${styles.card}`} draggable={false}>
      <div className={styles.cardTop}>
        <span className={`tag ${styles.tag}`} title={p.tag}>{p.tag}</span>
        {p.risk && (
          <span className={`badge ${styles.riskBadge}`} style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>
            <Icon name="alert" size={12} />
            Em risco
          </span>
        )}
      </div>
      <h3 className={styles.cardTitle}>{p.name}</h3>
      <p className={styles.cardClient} title={p.client}>{p.client}</p>

      <div className={styles.progress}>
        <div className={styles.progressLabel}>
          <span>Progresso</span>
          <b>{p.progress}%</b>
        </div>
        <ProgressBar value={p.progress} color={statusColor} />
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardMetrics}>
          <div className={styles.cardMetric}>
            <span>Tarefas</span>
            <b>{p.tasksDone}/{p.tasksTotal}</b>
          </div>
          <div className={styles.cardMetric}>
            <span>Prazo</span>
            {dl ? (
              <b style={{ color: deadlineColor(dl.tone) }} title={dayLabel(p.dueDate!)}>{dl.label}</b>
            ) : (
              <b>{p.dueDate ? dayLabel(p.dueDate) : "Sem prazo"}</b>
            )}
          </div>
        </div>
        <AvatarStack users={p.members} size={26} max={3} />
      </div>
    </Link>
  );
}
