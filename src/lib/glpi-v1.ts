// Cliente da API REST **v1** do GLPI (`apirest.php`). Existe por um motivo só: a
// V2.1 marca `status.id` como readOnly e o PATCH devolve 200 sem mudar nada, então
// não dá pra mover chamado entre status por lá. A v1 grava — verificado nesta
// instância em 2026-07-28 (1 Novo, 2 Em atendimento, 4 Pendente e 6 Fechado).
//
// Toda a LEITURA continua na V2.1 (`@/lib/glpi`). Aqui mora só o que ela não faz.
// Ver `glpi-api-v1-referencia.md`.
import "server-only";

const URL_BASE = (process.env.GLPI_URL ?? "").replace(/\/$/, "");
const API = `${URL_BASE}/apirest.php`;
const APP_TOKEN = process.env.GLPI_APP_TOKEN ?? "";
const USER_TOKEN = process.env.GLPI_USER_TOKEN ?? "";

export function glpiV1Configured(): boolean {
  return Boolean(URL_BASE && APP_TOKEN && USER_TOKEN);
}

export class GlpiV1Error extends Error {
  constructor(public status: number, where: string, detail?: string) {
    super(`GLPI v1 ${status} em ${where}${detail ? `: ${detail}` : ""}`);
    this.name = "GlpiV1Error";
  }
}

// Sessão da v1 é READ-ONLY por padrão; `session_write=true` libera a escrita, mas
// em troca SERIALIZA as chamadas daquela sessão. Por isso abrimos uma sessão curta
// por operação e matamos logo depois, em vez de manter uma global — evita que uma
// escrita trave a outra. Login por usuário/senha está desabilitado nesta instância,
// então é `user_token` mesmo.
async function comSessao<T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  if (!glpiV1Configured()) {
    throw new GlpiV1Error(401, "initSession", "GLPI_APP_TOKEN/GLPI_USER_TOKEN ausentes");
  }
  const r = await fetch(`${API}/initSession?session_write=true`, {
    headers: {
      "Content-Type": "application/json",
      "App-Token": APP_TOKEN,
      Authorization: `user_token ${USER_TOKEN}`,
    },
    cache: "no-store",
  });
  const txt = await r.text();
  if (!r.ok) throw new GlpiV1Error(r.status, "initSession", txt.slice(0, 200));
  let sessionToken: string | undefined;
  try {
    sessionToken = JSON.parse(txt).session_token;
  } catch {
    /* cai no throw abaixo */
  }
  if (!sessionToken) throw new GlpiV1Error(502, "initSession", txt.slice(0, 200));

  const headers = {
    "Content-Type": "application/json",
    "App-Token": APP_TOKEN,
    "Session-Token": sessionToken,
  };
  try {
    return await fn(headers);
  } finally {
    // Não deixa sessão de escrita pendurada; falha aqui não invalida o trabalho.
    await fetch(`${API}/killSession`, { headers, cache: "no-store" }).catch(() => {});
  }
}

// Grava o status do chamado e CONFERE relendo. O corpo de sucesso da v1
// (`[{"36220":true}]`) diz que a operação foi aceita, não que o campo ficou com o
// valor pedido — a V2.1 já nos enganou exatamente assim.
export async function v1SetTicketStatus(glpiId: number, statusId: number): Promise<void> {
  await comSessao(async (headers) => {
    const r = await fetch(`${API}/Ticket/${glpiId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ input: { status: statusId } }),
      cache: "no-store",
    });
    const txt = await r.text();
    if (!r.ok) throw new GlpiV1Error(r.status, `PUT Ticket/${glpiId}`, txt.slice(0, 200));

    const check = await fetch(`${API}/Ticket/${glpiId}`, { headers, cache: "no-store" });
    if (!check.ok) return; // não conseguimos reler; o PUT foi aceito, seguimos
    const atual = (await check.json())?.status;
    if (typeof atual === "number" && atual !== statusId) {
      throw new GlpiV1Error(409, `PUT Ticket/${glpiId}`, `o GLPI manteve o status em ${atual}`);
    }
  });
}
