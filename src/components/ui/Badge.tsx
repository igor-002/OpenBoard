// Badges de status e prioridade. Portado de components.jsx.
import { STATUS_META, PRIORITY_META } from "@/lib/meta";
import type { ProjectStatus, Priority } from "@/lib/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="badge" style={{ color: m.c, background: m.bg }}>
      <span className="bdot" style={{ background: m.c }} />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ pr }: { pr: Priority }) {
  const m = PRIORITY_META[pr];
  return (
    <span className="badge" style={{ color: m.c, background: m.bg }}>
      {m.label}
    </span>
  );
}
