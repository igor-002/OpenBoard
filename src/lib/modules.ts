// Constantes de módulos (puras, sem server-only) — usadas tanto no servidor
// (permissions.ts) quanto em componentes client (tela de usuários).

export const MODULES = ["gestao", "comercial", "leads", "margem", "marketing"] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  gestao: "Gestão (projetos, kanban, tempo, relatórios)",
  comercial: "Comercial (clientes, MRR, contratos, pipeline)",
  leads: "Leads (funil de atendimento — dados de contato/CPF)",
  margem: "Margem / custos (dado sensível)",
  marketing: "Marketing (redes sociais, equipe)",
};

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULES as readonly string[]).includes(v);
}
