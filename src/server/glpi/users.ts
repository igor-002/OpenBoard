// Listas de usuários do GLPI para os formulários de escrita (solicitante da nova
// demanda; técnico a atribuir). Buscadas ao vivo — poucos usuários nesta instância.
import "server-only";
import { glpiGet, glpiConfigured, TRACKED_USER_IDS, DEFAULT_ENTITY_ID } from "@/lib/glpi";

export interface GlpiUserOpt {
  id: number;
  name: string;
}

export type RawUser = {
  id: number;
  username?: string;
  firstname?: string;
  realname?: string;
  is_active?: boolean;
  // ATENÇÃO: o GLPI usa soft delete. Um usuário na lixeira volta da API com
  // `is_active: true` e `is_deleted: true` — filtrar só por `is_active` deixa
  // ex-funcionário aparecendo nos formulários (foi o caso de wesley/vinicius).
  is_deleted?: boolean;
  default_entity?: { id: number; name?: string } | null;
};

const USER_FIELDS = "id,username,firstname,realname,is_active,is_deleted,default_entity";

export function glpiDisplayName(u: RawUser): string {
  return [u.firstname, u.realname].filter(Boolean).join(" ").trim() || u.username || String(u.id);
}

// Todos os usuários da instância numa chamada só (são ~60). Serve de base pra
// todas as listas abaixo e pra resolver id → nome no sync.
export async function fetchGlpiUsers(): Promise<RawUser[]> {
  if (!glpiConfigured()) return [];
  try {
    const { data } = await glpiGet<RawUser>("/Administration/User", { fields: USER_FIELDS, limit: 500 });
    return data.filter((u) => Number.isInteger(u.id) && u.id > 0);
  } catch {
    return [];
  }
}

// Usuário utilizável: existe de verdade hoje (não está na lixeira nem desativado).
const isLive = (u: RawUser) => u.is_deleted !== true && u.is_active !== false;

// Contas de sistema/integração que não fazem sentido como responsável.
const SYSTEM_LOGINS = /^(glpi|post-only|tech|normal|api\.|automacoes|teste|integracaomkt|open\.suite)/i;

// Time do marketing = quem tem a entidade Marketing como entidade padrão, mais os
// ids fixados em GLPI_TRACKED_USER_IDS (rede de segurança pra quem está no time
// sem a entidade padrão configurada). Derivar do GLPI em vez de confiar só no env
// faz entrada e saída de gente se corrigirem sozinhas.
function marketingTeam(users: RawUser[]): RawUser[] {
  return users.filter(
    (u) => isLive(u) && (u.default_entity?.id === DEFAULT_ENTITY_ID || TRACKED_USER_IDS.includes(u.id)),
  );
}

// Solicitantes possíveis de uma nova demanda (o time do marketing).
export async function getTrackedUsers(): Promise<GlpiUserOpt[]> {
  const users = await fetchGlpiUsers();
  return marketingTeam(users)
    .map((u) => ({ id: u.id, name: glpiDisplayName(u) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Valida o solicitante escolhido no formulário de nova demanda.
export async function isValidRequester(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const users = await fetchGlpiUsers();
  return marketingTeam(users).some((u) => u.id === id);
}

// Usuários reais ativos, p/ escolher responsável ao atribuir um chamado.
export async function getAssignableUsers(): Promise<GlpiUserOpt[]> {
  const users = await fetchGlpiUsers();
  return users
    .filter((u) => isLive(u) && !SYSTEM_LOGINS.test(u.username ?? ""))
    .map((u) => ({ id: u.id, name: glpiDisplayName(u) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
