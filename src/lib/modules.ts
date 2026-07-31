// Constantes de acesso (puras, sem server-only) — usadas tanto no servidor
// (permissions.ts) quanto em componentes client (tela de usuários).
//
// Dois níveis:
//   MÓDULO     — a área do sistema (gestao, comercial, leads, margem, marketing)
//   FERRAMENTA — cada tela dentro dela (quadro, contratos, churn…)
//
// O acesso de verdade é por FERRAMENTA. "Ter o módulo" virou derivado: quem tem
// qualquer ferramenta de um módulo tem o módulo. Assim o gate antigo
// (`requireModule`) segue valendo sem reescrever tela por tela.

export const MODULES = ["gestao", "comercial", "leads", "margem", "marketing"] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  gestao: "Gestão (projetos, kanban, tempo, relatórios)",
  comercial: "Comercial (clientes, MRR, contratos, pipeline)",
  leads: "Leads (funil de atendimento — dados de contato/CPF)",
  margem: "Margem / custos (dado sensível)",
  marketing: "Marketing (redes sociais, equipe)",
};

// Nome curto, pro cabeçalho de cada grupo na tela de permissões.
export const MODULE_SHORT: Record<ModuleKey, string> = {
  gestao: "Gestão",
  comercial: "Comercial",
  leads: "Leads",
  margem: "Margem",
  marketing: "Marketing",
};

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULES as readonly string[]).includes(v);
}

// ── Ferramentas ──────────────────────────────────────────────────────────────
// `href` é o prefixo de rota que a ferramenta cobre. `essencial` marca a tela de
// entrada do módulo: sem ela a pessoa cairia numa área sem porta de entrada.
export type Tool = {
  key: string;
  module: ModuleKey;
  label: string;
  href: string;
  essencial?: boolean;
};

export const TOOLS: Tool[] = [
  // Gestão
  { key: "gestao.dashboard", module: "gestao", label: "Visão geral", href: "/dashboard", essencial: true },
  { key: "gestao.projetos", module: "gestao", label: "Projetos", href: "/projects" },
  { key: "gestao.tarefas", module: "gestao", label: "Tarefas (kanban)", href: "/kanban" },
  { key: "gestao.atividades", module: "gestao", label: "Atividades", href: "/atividades" },
  { key: "gestao.notas", module: "gestao", label: "Notas", href: "/notas" },
  { key: "gestao.cronograma", module: "gestao", label: "Cronograma", href: "/timeline" },
  { key: "gestao.tempo", module: "gestao", label: "Tempo", href: "/time" },
  { key: "gestao.time", module: "gestao", label: "Time", href: "/team" },
  { key: "gestao.relatorios", module: "gestao", label: "Relatórios", href: "/reports" },

  // Comercial
  { key: "comercial.visao", module: "comercial", label: "Visão geral", href: "/comercial", essencial: true },
  { key: "comercial.cadastros", module: "comercial", label: "Cadastros", href: "/comercial/cadastros" },
  { key: "comercial.contratos", module: "comercial", label: "Contratos", href: "/comercial/contratos" },
  { key: "comercial.clientes", module: "comercial", label: "Clientes", href: "/comercial/clientes" },
  { key: "comercial.pipeline", module: "comercial", label: "Pipeline", href: "/comercial/pipeline" },
  { key: "comercial.vendedores", module: "comercial", label: "Vendedores", href: "/comercial/vendedores" },
  { key: "comercial.relatorios", module: "comercial", label: "Relatórios", href: "/comercial/relatorios" },
  { key: "comercial.churn", module: "comercial", label: "Churn & Retenção", href: "/comercial/churn" },
  { key: "comercial.mrr", module: "comercial", label: "MRR & Metas", href: "/comercial/mrr" },
  { key: "comercial.sync", module: "comercial", label: "Sincronização (IXC)", href: "/comercial/sync" },
  { key: "comercial.config", module: "comercial", label: "Config IA", href: "/comercial/config" },

  // Leads — módulo à parte porque expõe contato/CPF
  { key: "leads.funil", module: "leads", label: "Funil de leads", href: "/comercial/leads", essencial: true },

  // Margem — dado sensível
  { key: "margem.painel", module: "margem", label: "Margem / custos", href: "/comercial/margem", essencial: true },

  // Marketing
  { key: "marketing.quadro", module: "marketing", label: "Quadro de Demandas", href: "/marketing/quadro", essencial: true },
  { key: "marketing.demandas", module: "marketing", label: "Demandas (GLPI)", href: "/marketing/demandas" },
  { key: "marketing.relatorios", module: "marketing", label: "Relatório de Demandas", href: "/marketing/relatorios" },
  { key: "marketing.equipe", module: "marketing", label: "Equipe", href: "/marketing/equipe" },
  { key: "marketing.social", module: "marketing", label: "Redes Sociais", href: "/marketing/social" },
  { key: "marketing.contas", module: "marketing", label: "Contas Instagram", href: "/marketing/social/contas" },
  { key: "marketing.links", module: "marketing", label: "Links & QR", href: "/marketing/links" },
  { key: "marketing.cliques", module: "marketing", label: "Relatório de Cliques", href: "/marketing/links/relatorios" },
];

export const TOOL_KEYS = TOOLS.map((t) => t.key);
const TOOL_BY_KEY = new Map(TOOLS.map((t) => [t.key, t]));

export function isToolKey(v: string): boolean {
  return TOOL_BY_KEY.has(v);
}

export function toolsOfModule(m: ModuleKey): Tool[] {
  return TOOLS.filter((t) => t.module === m);
}

export function moduleOfTool(key: string): ModuleKey | null {
  return TOOL_BY_KEY.get(key)?.module ?? null;
}

// Ferramenta que cobre uma rota. Casa pelo prefixo MAIS LONGO, senão
// "/marketing/links" engoliria "/marketing/links/relatorios".
export function toolForPath(pathname: string): Tool | null {
  let achado: Tool | null = null;
  for (const t of TOOLS) {
    if (pathname === t.href || pathname.startsWith(t.href + "/")) {
      if (!achado || t.href.length > achado.href.length) achado = t;
    }
  }
  return achado;
}
