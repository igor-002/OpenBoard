import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

export const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: "home" },
  { href: "/projects", label: "Projetos", icon: "folder" },
  { href: "/kanban", label: "Tarefas", icon: "kanban" },
  { href: "/atividades", label: "Atividades", icon: "clock" },
  { href: "/timeline", label: "Cronograma", icon: "timeline" },
  // { href: "/time", label: "Tempo", icon: "clock" }, // oculto por enquanto
  { href: "/team", label: "Time", icon: "users" },
  { href: "/reports", label: "Relatórios", icon: "chart" },
];

// Itens visíveis só para admin.
export const NAV_ADMIN: NavItem[] = [
  { href: "/settings/users", label: "Usuários", icon: "settings" },
];

// Título do topbar (migalha "a > b") por prefixo de rota.
export const CRUMBS: { prefix: string; a: string; b: string }[] = [
  { prefix: "/settings/users", a: "Configurações", b: "Usuários" },
  { prefix: "/projects/", a: "Projetos", b: "Detalhe" },
  { prefix: "/dashboard", a: "Início", b: "Visão geral" },
  { prefix: "/projects", a: "Projetos", b: "Todos os projetos" },
  { prefix: "/kanban", a: "Tarefas", b: "Quadro" },
  { prefix: "/atividades", a: "Equipe", b: "Atividades" },
  { prefix: "/timeline", a: "Cronograma", b: "Anual" },
  { prefix: "/time", a: "Tempo", b: "Apontamentos" },
  { prefix: "/team", a: "Time", b: "Pessoas" },
  { prefix: "/reports", a: "Relatórios", b: "Desempenho" },
];

export function crumbFor(pathname: string) {
  return CRUMBS.find((c) => pathname.startsWith(c.prefix)) ?? { a: "Início", b: "" };
}
