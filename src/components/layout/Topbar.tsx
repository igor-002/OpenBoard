"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { hrefAtivo, secaoAtiva, tabsVisiveis, tituloFor } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { logoutAction } from "@/app/(auth)/actions";
import type { NotificationItem } from "@/server/notifications";

export function Topbar({
  collapsed,
  setCollapsed,
  notifications,
  tools,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  notifications: { items: NotificationItem[]; unread: number };
  tools: string[];
}) {
  const pathname = usePathname();
  const secao = secaoAtiva(pathname);
  const tabs = secao?.tabs ? tabsVisiveis(secao, tools) : [];
  const ativo = hrefAtivo(pathname);
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title="Recolher menu">
        <Icon name="sidebar" size={18} />
      </button>
      <div className="tb-title">{tituloFor(pathname)}</div>
      {tabs.length > 1 && (
        <nav className="tb-tabs" aria-label={`Telas de ${secao!.label}`}>
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={t.href === ativo ? "on" : ""} aria-current={t.href === ativo ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <div style={{ flex: 1 }} />
      {/* A paleta escuta Ctrl+K na janela inteira; o botão só torna o atalho descobrível. */}
      <button
        className="tb-kbd"
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
      >
        <Icon name="search" size={15} />
        <span>Buscar ou criar</span>
        <kbd>Ctrl K</kbd>
      </button>
      <NotificationBell items={notifications.items} unread={notifications.unread} />
      <form action={logoutAction}>
        <button className="icon-btn" title="Sair" type="submit">
          <Icon name="logout" size={18} />
        </button>
      </form>
    </header>
  );
}
