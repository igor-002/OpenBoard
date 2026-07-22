// Listas de usuários do GLPI para os formulários de escrita (solicitante da nova
// demanda; técnico a atribuir). Buscadas ao vivo — poucos usuários nesta instância.
import "server-only";
import { glpiGet, glpiGetOne, glpiConfigured, TRACKED_USER_IDS } from "@/lib/glpi";

export interface GlpiUserOpt {
  id: number;
  name: string;
}

type RawUser = { id: number; username?: string; firstname?: string; realname?: string; is_active?: boolean };

function displayName(u: RawUser): string {
  return [u.firstname, u.realname].filter(Boolean).join(" ").trim() || u.username || String(u.id);
}

// Os 4 usuários rastreados do marketing (solicitantes possíveis de uma nova demanda).
export async function getTrackedUsers(): Promise<GlpiUserOpt[]> {
  if (!glpiConfigured()) return [];
  const out: GlpiUserOpt[] = [];
  for (const id of TRACKED_USER_IDS) {
    try {
      const u = await glpiGetOne<RawUser>(`/Administration/User/${id}`, "id,username,firstname,realname");
      if (u?.id) out.push({ id: u.id, name: displayName(u) });
    } catch {
      /* ignora usuário não resolvido */
    }
  }
  return out;
}

// Contas de sistema/integração que não fazem sentido como responsável.
const SYSTEM_LOGINS = /^(glpi|post-only|tech|normal|api\.|automacoes|teste|integracaomkt|open\.suite)/i;

// Usuários reais ativos, p/ escolher responsável ao atribuir um chamado.
export async function getAssignableUsers(): Promise<GlpiUserOpt[]> {
  if (!glpiConfigured()) return [];
  try {
    const { data } = await glpiGet<RawUser>("/Administration/User", {
      fields: "id,username,firstname,realname,is_active",
      limit: 200,
    });
    return data
      .filter((u) => u.id && u.is_active !== false && !SYSTEM_LOGINS.test(u.username ?? ""))
      .map((u) => ({ id: u.id, name: displayName(u) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
