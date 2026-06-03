// Linha de projeto clicável (dashboard + lista). Portado de screens-a.jsx.
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { AvatarStack } from "@/components/ui/Avatar";
import { STATUS_META } from "@/lib/meta";
import type { DashProject } from "@/server/dashboard";

export function ProjectRow({ p }: { p: DashProject }) {
  const c = STATUS_META[p.status].c;
  return (
    <Link href={`/projects/${p.id}`} className="proj-row">
      <div className="row gap12">
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            flex: "none",
            display: "grid",
            placeItems: "center",
            background: `color-mix(in srgb, ${c} 12%, transparent)`,
            color: c,
          }}
        >
          <Icon name="folder" size={19} />
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {p.client} · {p.tasksTotal} tarefas
          </div>
        </div>
      </div>
      <StatusBadge status={p.status} />
      <div className="row gap12">
        <div style={{ flex: 1, maxWidth: 120 }}>
          <ProgressBar value={p.progress} />
        </div>
        <b style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{p.progress}%</b>
      </div>
      <AvatarStack users={p.members} size={28} />
    </Link>
  );
}
