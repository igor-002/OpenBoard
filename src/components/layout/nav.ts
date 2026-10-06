import type { IconName } from "@/components/ui/Icon";
import { activeNavHref } from "@/lib/nav-active";
import { toolForPath } from "@/lib/modules";

// `tabs` = telas irmãs que vivem sob o mesmo item do menu. O menu mostra uma
// entrada só; a troca entre elas fica na barra do topo.
export type NavTab = { href: string; label: string };
export type NavItem = { href: string; label: string; icon: IconName; tabs?: NavTab[] };

export const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Hoje", icon: "home" },
  {
    href: "/atividades",
    label: "Demandas",
    icon: "inbox",
    tabs: [
      { href: "/atividades", label: "Lista" },
      { href: "/kanban", label: "Quadro" },
    ],
  },
  {
    href: "/projects",
    label: "Projetos",
    icon: "folder",
    tabs: [
      { href: "/projects", label: "Quadro" },
      { href: "/timeline", label: "Cronograma" },
    ],
  },
  { href: "/reports", label: "Relatórios", icon: "chart" },
  { href: "/notas", label: "Notas", icon: "note" },
];

// Itens visíveis só para admin.
export const NAV_ADMIN: NavItem[] = [
  { href: "/settings/users", label: "Usuários", icon: "settings" },
  { href: "/settings/categorias", label: "Categorias", icon: "grid" },
];

function podeAbrir(href: string, tools: readonly string[]): boolean {
  const t = toolForPath(href);
  return !t || tools.includes(t.key);
}

// Telas do item que a pessoa pode abrir — item sem nenhuma some do menu.
export function tabsVisiveis(item: NavItem, tools: readonly string[]): NavTab[] {
  const todas = item.tabs ?? [{ href: item.href, label: item.label }];
  return todas.filter((t) => podeAbrir(t.href, tools));
}

const TODOS_HREFS = [...NAV_MAIN, ...NAV_ADMIN].flatMap((n) => [n.href, ...(n.tabs ?? []).map((t) => t.href)]);

// Href (item ou aba) mais específico que casa a rota atual.
export function hrefAtivo(pathname: string): string | null {
  return activeNavHref(pathname, TODOS_HREFS);
}

// Item do menu dono da rota atual, contando as abas dele.
export function secaoAtiva(pathname: string): NavItem | null {
  const ativo = hrefAtivo(pathname);
  if (!ativo) return null;
  return [...NAV_MAIN, ...NAV_ADMIN].find((n) => n.href === ativo || n.tabs?.some((t) => t.href === ativo)) ?? null;
}

// Título do topo para rotas fora do menu (detalhe, conta).
const TITULOS: { prefix: string; label: string }[] = [
  { prefix: "/settings/account", label: "Minha conta" },
  { prefix: "/time", label: "Tempo" },
];

export function tituloFor(pathname: string): string {
  return secaoAtiva(pathname)?.label ?? TITULOS.find((t) => pathname.startsWith(t.prefix))?.label ?? "OpenBoard";
}
