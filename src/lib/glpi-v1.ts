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

// Categorias ITIL da entidade (Marketing). A V2.1 NÃO expõe ITILCategory —
// `/Dropdowns/` só tem Location, State, Manufacturer e Calendar, e toda rota
// ITILCategory dá 404. A v1 lê.
//
// Filtra pela entidade porque no GLPI a categoria é POR ENTIDADE: a instância tem
// 168 no total (a maioria de TI, de outras entidades), e só 13 são do Marketing.
export interface GlpiCategoria {
  id: number;
  nome: string;
}

const ENTITY_ID = Number(process.env.GLPI_ENTITY_ID) || 54;

export async function v1ListCategories(): Promise<GlpiCategoria[]> {
  if (!glpiV1Configured()) return [];
  try {
    return await comSessao(async (headers) => {
      const r = await fetch(`${API}/ITILCategory?range=0-999`, { headers, cache: "no-store" });
      if (!r.ok) return [];
      const raw = (await r.json()) as { id: number; entities_id: number; completename?: string; name?: string }[];
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((c) => c.entities_id === ENTITY_ID)
        .map((c) => ({ id: c.id, nome: c.completename || c.name || String(c.id) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    });
  } catch {
    return []; // categoria é opcional no formulário — sem ela o resto segue
  }
}

// ── Anexar arquivo a um chamado ──────────────────────────────────────────────
// A V2.1 não recebe binário: `Timeline/Document` só aceita application/json e o
// schema `Document` espera filename/filepath/sha1sum — ou seja, referencia um
// documento que já existe. Quem sobe o arquivo é a v1, por multipart.
//
// Um POST só: o vínculo com o chamado vai no PRÓPRIO manifesto (`itemtype` +
// `items_id`) e o documento já nasce na linha do tempo. Criar o Document e depois
// amarrar por `Document_Item` também parece razoável, mas essa segunda chamada
// responde `ERROR_GLPI_ADD` (sem permissão) — testado.
//
// Detalhes do encoding que custaram um 500: o manifesto vai como campo de TEXTO
// (mandá-lo como Blob `application/json`, que é o que o exemplo em curl sugere,
// quebra), e o binário vai em `filename[0]`, índice que casa com `_filename`.
export async function v1AnexarNoChamado(
  glpiId: number,
  arquivo: { nome: string; mime: string; bytes: Buffer },
): Promise<{ documentId: number }> {
  return comSessao(async (headers) => {
    // multipart: NÃO mandar Content-Type na mão — o fetch põe o boundary sozinho.
    const { "Content-Type": _ct, ...semTipo } = headers;
    void _ct;

    const form = new FormData();
    form.append(
      "uploadManifest",
      JSON.stringify({
        input: { name: arquivo.nome, _filename: [arquivo.nome], itemtype: "Ticket", items_id: glpiId },
      }),
    );
    form.append(
      "filename[0]",
      new Blob([new Uint8Array(arquivo.bytes)], { type: arquivo.mime || "application/octet-stream" }),
      arquivo.nome,
    );

    const up = await fetch(`${API}/Document/`, { method: "POST", headers: semTipo, body: form, cache: "no-store" });
    const txt = await up.text();
    if (!up.ok) throw new GlpiV1Error(up.status, "POST Document", limparHtml(txt));
    let documentId: number | undefined;
    try {
      documentId = JSON.parse(txt)?.id;
    } catch {
      /* cai no throw abaixo */
    }
    if (!documentId) throw new GlpiV1Error(502, "POST Document", `sem id na resposta: ${txt.slice(0, 200)}`);
    return { documentId };
  });
}

// O GLPI devolve página HTML inteira em erro 500; sem isto a mensagem que chega
// no usuário é um <!DOCTYPE html>.
function limparHtml(s: string): string {
  if (!s.trimStart().startsWith("<")) return s.slice(0, 250);
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 250) || "erro sem detalhe no GLPI";
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
