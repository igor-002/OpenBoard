import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

// Navegação do módulo Marketing. Prefixo /marketing. Sem RBAC — qualquer
// usuário logado vê e edita tudo (mesmo modelo do app de origem).
export const MARKETING_NAV: NavItem[] = [
  { href: "/marketing/social", label: "Redes Sociais", icon: "share" },
  { href: "/marketing/social/contas", label: "Contas Instagram", icon: "grid" },
  { href: "/marketing/equipe", label: "Equipe", icon: "users" },
  { href: "/marketing/equipe/funcionarios", label: "Funcionários", icon: "folder" },
  { href: "/marketing/links", label: "Links & QR", icon: "link" },
];

export const MARKETING_CRUMBS: { prefix: string; a: string; b: string }[] = [
  { prefix: "/marketing/social/contas", a: "Marketing", b: "Contas Instagram" },
  { prefix: "/marketing/social", a: "Marketing", b: "Redes Sociais" },
  { prefix: "/marketing/equipe/funcionarios", a: "Marketing", b: "Funcionários" },
  { prefix: "/marketing/equipe", a: "Marketing", b: "Equipe" },
  { prefix: "/marketing/links/campanhas", a: "Marketing", b: "Campanhas" },
  { prefix: "/marketing/links", a: "Marketing", b: "Links & QR" },
];

export function marketingCrumbFor(pathname: string) {
  return MARKETING_CRUMBS.find((c) => pathname.startsWith(c.prefix)) ?? { a: "Marketing", b: "" };
}
