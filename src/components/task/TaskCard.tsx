// Card de tarefa do Kanban. Portado de screens-b.jsx.
import { Icon } from "@/components/ui/Icon";
import { PriorityBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { STATUS_META } from "@/lib/meta";
import { dayLabel } from "@/lib/format";
import type { TaskCardData } from "@/server/tasks";

export function TaskCard({ t }: { t: TaskCardData }) {
  const sm = STATUS_META[t.projectStatus];
  return (
    <div className="card" style={{ padding: 14, boxShadow: "var(--sh-sm)" }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="tag" style={{ fontSize: 11, padding: "3px 9px", color: sm.c, background: sm.bg, border: "none" }}>
          {t.projectName.split("—")[0].trim()}
        </span>
        <PriorityBadge pr={t.priority} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 12 }}>{t.title}</div>
      {t.tags.length > 0 && (
        <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 12 }}>
          {t.tags.map((tg) => (
            <span key={tg} style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--surface-3)", padding: "3px 8px", borderRadius: "var(--r-xs)" }}>
              {tg}
            </span>
          ))}
        </div>
      )}
      <div className="row between" style={{ paddingTop: 11, borderTop: "1px solid var(--line)" }}>
        <div className="row gap12" style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
          <span className="row" style={{ gap: 5 }}><Icon name="checkCircle" size={14} />{t.subDone}/{t.subTotal}</span>
          <span className="row" style={{ gap: 5 }}><Icon name="msg" size={14} />{t.comments}</span>
          {t.dueDate && <span className="row" style={{ gap: 5 }}><Icon name="calendar" size={14} />{dayLabel(t.dueDate)}</span>}
        </div>
        {t.assignee && <Avatar user={t.assignee} size={26} />}
      </div>
    </div>
  );
}
