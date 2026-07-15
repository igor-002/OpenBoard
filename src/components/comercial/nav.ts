import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

// Navegação do "segundo sistema" (Comercial / IXC). Prefixo /comercial.
export const COMERCIAL_NAV: NavItem[] = [
  { href: "/comercial", label: "Visão geral", icon: "home" },
  { href: "/comercial/leads", label: "Leads", icon: "target" },
  { href: "/comercial/cadastros", label: "Cadastros", icon: "inbox" },
  { href: "/comercial/contratos", label: "Contratos", icon: "briefcase" },
  { href: "/comercial/clientes", label: "Clientes", icon: "users" },
  { href: "/comercial/pipeline", label: "Pipeline", icon: "layers" },
  { href: "/comercial/vendedores", label: "Vendedores", icon: "users" },
  { href: "/comercial/relatorios", label: "Relatórios", icon: "chart" },
  { href: "/comercial/churn", label: "Churn & Retenção", icon: "trendUp" },
  { href: "/comercial/mrr", label: "MRR & Metas", icon: "wallet" },
  // { href: "/comercial/margem", label: "Margem", icon: "trendUp" }, // oculto por enquanto
  { href: "/comercial/sync", label: "Sincronização", icon: "zap" },
  { href: "/comercial/config", label: "Config IA", icon: "settings" },
];

export const COMERCIAL_CRUMBS: { prefix: string; a: string; b: string }[] = [
  { prefix: "/comercial/leads/relatorios", a: "Comercial", b: "Relatórios de Leads" },
  { prefix: "/comercial/leads", a: "Comercial", b: "Leads" },
  { prefix: "/comercial/cadastros", a: "Comercial", b: "Cadastros" },
  { prefix: "/comercial/contratos", a: "Comercial", b: "Contratos" },
  { prefix: "/comercial/clientes", a: "Comercial", b: "Clientes" },
  { prefix: "/comercial/pipeline", a: "Comercial", b: "Pipeline" },
  { prefix: "/comercial/vendedores", a: "Comercial", b: "Vendedores" },
  { prefix: "/comercial/relatorios", a: "Comercial", b: "Relatórios" },
  { prefix: "/comercial/churn", a: "Comercial", b: "Churn & Retenção" },
  { prefix: "/comercial/mrr", a: "Comercial", b: "MRR & Metas" },
  { prefix: "/comercial/margem", a: "Comercial", b: "Margem" },
  { prefix: "/comercial/sync", a: "Comercial", b: "Sincronização" },
  { prefix: "/comercial/config", a: "Comercial", b: "Config IA" },
  { prefix: "/comercial", a: "Comercial", b: "Visão geral" },
];

export function comercialCrumbFor(pathname: string) {
  return COMERCIAL_CRUMBS.find((c) => pathname.startsWith(c.prefix)) ?? { a: "Comercial", b: "" };
}
