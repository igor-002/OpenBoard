import { Icon, type IconName } from "@/components/ui/Icon";

// Placeholder para telas que chegam nos próximos milestones.
export function ComingSoon({
  title,
  icon,
  milestone,
}: {
  title: string;
  icon: IconName;
  milestone: string;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">Esta tela chega no {milestone}.</p>
        </div>
      </div>
      <div className="card card-pad" style={{ display: "grid", placeItems: "center", padding: 64, textAlign: "center", gap: 14 }}>
        <span style={{ width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", background: "var(--primary-tint)", color: "var(--primary)" }}>
          <Icon name={icon} size={28} />
        </span>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Em construção</div>
        <div className="muted" style={{ maxWidth: 360 }}>
          A fundação (login, banco e design system) já está pronta. {title} será ligado aos dados reais no {milestone}.
        </div>
      </div>
    </div>
  );
}
