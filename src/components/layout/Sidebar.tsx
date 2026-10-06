"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_MAIN, NAV_ADMIN, secaoAtiva, tabsVisiveis } from "./nav";
import { firstToolHref } from "@/lib/modules";
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
  const ativa = secaoAtiva(pathname);
  // Cada item aponta pra primeira tela dele que a pessoa pode abrir.
  const visiveis = NAV_MAIN.map((n) => ({ item: n, href: tabsVisiveis(n, tools)[0]?.href })).filter(
    (x): x is { item: (typeof NAV_MAIN)[number]; href: string } => !!x.href,
  );
  const comercialHref = firstToolHref(tools, ["comercial", "leads", "margem"]);
  const marketingHref = firstToolHref(tools, ["marketing"]);
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <Icon name="layers" />
        </div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">OpenBoard</div>
          <div className="sb-brand-sub">{workspaceName}</div>
        </div>
      </div>

      {visiveis.map(({ item: n, href }) => (
        <Link key={n.href} href={href} className={`sb-item ${ativa === n ? "active" : ""}`} title={n.label}>
          <Icon name={n.icon} />
          <span className="sb-label">{n.label}</span>
        </Link>
      ))}

      {isAdmin && (
        <>
          <div className="sb-section">Ajustes</div>
          {NAV_ADMIN.map((n) => (
            <Link key={n.href} href={n.href} className={`sb-item ${ativa === n ? "active" : ""}`} title={n.label}>
              <Icon name={n.icon} />
              <span className="sb-label">{n.label}</span>
            </Link>
          ))}
        </>
      )}

      {(comercialHref || marketingHref) && <div className="sb-section">Outros sistemas</div>}
      {comercialHref && (
        <Link href={comercialHref} className="sb-item sb-item-ext" title="Comercial · IXC">
          <Icon name="briefcase" />
          <span className="sb-label">Comercial</span>
          <Icon name="arrowUpRight" size={14} className="sb-label sb-ext" />
        </Link>
      )}
      {marketingHref && (
        <Link href={marketingHref} className="sb-item sb-item-ext" title="Marketing">
          <Icon name="share" />
          <span className="sb-label">Marketing</span>
          <Icon name="arrowUpRight" size={14} className="sb-label sb-ext" />
        </Link>
      )}

      <Link href="/settings/account" className="sb-user" title="Minha conta">
        <Avatar user={user} size={30} ring={false} />
        <div className="sb-brand-text" style={{ flex: 1, minWidth: 0 }}>
          <div className="name">{user.name}</div>
          <div className="role">{user.jobTitle}</div>
        </div>
      </Link>
    </aside>
  );
}
