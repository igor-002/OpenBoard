// Controle de acesso. Admin vê tudo; os demais veem apenas as FERRAMENTAS
// liberadas em User.tools (definidas em Configurações → Usuários).
//
// "Ter o módulo" é derivado das ferramentas: quem tem qualquer tela de um módulo
// tem o módulo. Isso mantém `requireModule` valendo nas dezenas de páginas que já
// o usam, enquanto o controle fino acontece por tela.
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "./auth";
import { moduleOfTool, type ModuleKey } from "./modules";

// Reexporta as constantes puras (definidas em ./modules p/ uso também no client).
export { MODULES, MODULE_LABELS, MODULE_SHORT, TOOLS, TOOL_KEYS, isModuleKey, isToolKey, toolsOfModule, toolForPath } from "./modules";
export type { ModuleKey, Tool } from "./modules";

type AccessUser = { role: string; modules: string[]; tools: string[] };

// Regra central de ferramenta: admin sempre; demais só o que está liberado.
export function hasTool(user: AccessUser, toolKey: string): boolean {
  if (user.role === "admin") return true;
  return user.tools.includes(toolKey);
}

// Módulo = tem ao menos uma ferramenta dele. O fallback em `modules` cobre o
// intervalo entre subir o código e rodar a migração que preenche `tools`.
export function hasModule(user: AccessUser, key: ModuleKey): boolean {
  if (user.role === "admin") return true;
  if (user.tools.some((t) => moduleOfTool(t) === key)) return true;
  return user.modules.includes(key);
}

// Módulos que o usuário administra (libera ferramentas pros outros).
export function managesModule(user: { role: string; manages?: string[] }, key: ModuleKey): boolean {
  if (user.role === "admin") return true;
  return (user.manages ?? []).includes(key);
}

export function isModuleManager(user: { role: string; manages?: string[] }): boolean {
  return user.role === "admin" || (user.manages ?? []).length > 0;
}

// Para Server Components / páginas: garante sessão + módulo, senão redireciona.
export async function requireModule(key: ModuleKey) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModule(user, key)) redirect("/sem-acesso");
  return user;
}

// Idem, na granularidade de tela.
export async function requireTool(toolKey: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasTool(user, toolKey)) redirect("/sem-acesso");
  return user;
}

// Para Server Actions: lança (não redireciona no meio de um POST/mutação).
export function assertModule(user: AccessUser, key: ModuleKey): void {
  if (!hasModule(user, key)) {
    throw new Error("Sem permissão para este módulo.");
  }
}

// Atalho p/ Server Actions: exige sessão + módulo e devolve o usuário.
export async function requireModuleUser(key: ModuleKey) {
  const user = await requireUser();
  assertModule(user, key);
  return user;
}

export async function requireToolUser(toolKey: string) {
  const user = await requireUser();
  if (!hasTool(user, toolKey)) throw new Error("Sem permissão para esta ferramenta.");
  return user;
}
