// Controle de acesso por módulo. Admin vê tudo; gerente/membro só os módulos
// marcados em User.modules (definidos pelo admin em Configurações → Usuários).
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser } from "./auth";
import type { ModuleKey } from "./modules";

// Reexporta as constantes puras (definidas em ./modules p/ uso também no client).
export { MODULES, MODULE_LABELS, isModuleKey } from "./modules";
export type { ModuleKey } from "./modules";

type AccessUser = { role: string; modules: string[] };

// Regra central: admin sempre; demais só se o módulo estiver liberado.
export function hasModule(user: AccessUser, key: ModuleKey): boolean {
  if (user.role === "admin") return true;
  return user.modules.includes(key);
}

// Para Server Components / páginas: garante sessão + módulo, senão redireciona.
export async function requireModule(key: ModuleKey) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModule(user, key)) redirect("/sem-acesso");
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
