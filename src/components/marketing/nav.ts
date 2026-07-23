import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

// Navegação do módulo Marketing. Prefixo /marketing. Sem RBAC — qualquer
// usuário logado vê e edita tudo (mesmo modelo do app de origem).
export const MARKETING_NAV: NavItem[] = [
  { href: "/marketing/demandas", label: "Demandas", icon: "inbox" },
  { href: "/marketing/relatorios", label: "Relatório de Demandas", icon: "chart" },
  { href: "/marketing/equipe", label: "Equipe", icon: "users" },
  { href: "/marketing/social", label: "Redes Sociais", icon: "share" },
  { href: "/marketing/social/contas", label: "Contas Instagram", icon: "grid" },
  { href: "/marketing/links", label: "Links & QR", icon: "link" },
  { href: "/marketing/links/relatorios", label: "Relatório de Cliques", icon: "chart" },
];

export const MARKETING_CRUMBS: { prefix: string; a: string; b: string }[] = [
  { prefix: "/marketing/relatorios", a: "Marketing", b: "Relatório de Demandas" },
  { prefix: "/marketing/demandas", a: "Marketing", b: "Demandas" },
  { prefix: "/marketing/social/contas", a: "Marketing", b: "Contas Instagram" },
  { prefix: "/marketing/social", a: "Marketing", b: "Redes Sociais" },
  { prefix: "/marketing/equipe", a: "Marketing", b: "Equipe" },
  { prefix: "/marketing/links/campanhas", a: "Marketing", b: "Campanhas" },
  { prefix: "/marketing/links/relatorios", a: "Marketing", b: "Relatório de Cliques" },
  { prefix: "/marketing/links", a: "Marketing", b: "Links & QR" },
];

export function marketingCrumbFor(pathname: string) {
  return MARKETING_CRUMBS.find((c) => pathname.startsWith(c.prefix)) ?? { a: "Marketing", b: "" };
}
