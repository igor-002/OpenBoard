"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_MAIN, NAV_ADMIN } from "./nav";
import type { AvatarUser } from "@/lib/types";

export function Sidebar({
  user,
  workspaceName,
  isAdmin,
}: {
  user: AvatarUser & { jobTitle: string };
  workspaceName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
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

      {NAV_MAIN.map((n) => {
        const active =
          pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
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
            const active = pathname.startsWith(n.href);
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
