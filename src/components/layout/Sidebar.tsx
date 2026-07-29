"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_MAIN, NAV_ADMIN } from "./nav";
import { activeNavHref } from "@/lib/nav-active";
import { toolForPath } from "@/lib/modules";
import type { AvatarUser } from "@/lib/types";

export function Sidebar({
  user,
  workspaceName,
  isAdmin,
  tools,
}: {
  user: AvatarUser & { jobTitle: string };
  workspaceName: string;
  isAdmin: boolean;
  // Chaves de ferramenta liberadas. O menu mostra só o que a pessoa pode abrir —
  // item que levaria a "sem acesso" é ruído, não informação.
  tools: string[];
}) {
  const pathname = usePathname();
  const visiveis = NAV_MAIN.filter((n) => {
    const t = toolForPath(n.href);
    return !t || tools.includes(t.key);
  });
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <Icon name="layers" />
        </div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">OpenBoard</div>
          <div className="sb-brand-sub">Workspace · {workspaceName}</div>
        </div>
      </div>

      {visiveis.map((n) => {
        const active = n.href === activeNavHref(pathname, [...NAV_MAIN, ...NAV_ADMIN].map((x) => x.href));
        return (
          <Link key={n.href} href={n.href} className={`sb-item ${active ? "active" : ""}`} title={n.label}>
            <Icon name={n.icon} />
            <span className="sb-label">{n.label}</span>
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="sb-section">Admin</div>
          {NAV_ADMIN.map((n) => {
            const active = n.href === activeNavHref(pathname, [...NAV_MAIN, ...NAV_ADMIN].map((x) => x.href));
            return (
              <Link key={n.href} href={n.href} className={`sb-item ${active ? "active" : ""}`} title={n.label}>
                <Icon name={n.icon} />
                <span className="sb-label">{n.label}</span>
              </Link>
            );
          })}
        </>
      )}

      <div className="sb-section">Sistemas</div>
      <Link
        href="/comercial"
        className={`sb-item ${pathname.startsWith("/comercial") ? "active" : ""}`}
        title="Comercial · IXC"
      >
        <Icon name="briefcase" />
        <span className="sb-label">Comercial</span>
      </Link>
      <Link
        href="/marketing"
        className={`sb-item ${pathname.startsWith("/marketing") ? "active" : ""}`}
        title="Marketing"
      >
        <Icon name="share" />
        <span className="sb-label">Marketing</span>
      </Link>

      <Link href="/settings/account" className="sb-user" title="Minha conta">
        <Avatar user={user} size={38} />
        <div className="sb-brand-text" style={{ flex: 1, minWidth: 0 }}>
          <div className="name">{user.name}</div>
          <div className="role">{user.jobTitle}</div>
        </div>
        <Icon name="chevRight" size={16} style={{ color: "var(--side-muted)" }} className="sb-label" />
      </Link>
    </aside>
  );
}
