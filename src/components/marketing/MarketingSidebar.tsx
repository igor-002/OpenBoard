"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { MARKETING_NAV } from "./nav";
import type { AvatarUser } from "@/lib/types";

// Sidebar do módulo Marketing (mesma estrutura/tema do Comercial), com
// switcher de volta pro OpenBoard no topo.
export function MarketingSidebar({
  user,
}: {
  user: AvatarUser & { jobTitle: string };
}) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <Icon name="share" />
        </div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">Marketing</div>
          <div className="sb-brand-sub">Redes sociais & equipe</div>
        </div>
      </div>

      {/* Switcher: volta pro OpenBoard */}
      <Link href="/dashboard" className="sb-item" title="Voltar ao OpenBoard">
        <Icon name="chevLeft" />
        <span className="sb-label">OpenBoard</span>
      </Link>

      <div className="sb-section">Marketing</div>
      {MARKETING_NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link key={n.href} href={n.href} className={`sb-item ${active ? "active" : ""}`} title={n.label}>
            <Icon name={n.icon} />
            <span className="sb-label">{n.label}</span>
          </Link>
        );
      })}

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
