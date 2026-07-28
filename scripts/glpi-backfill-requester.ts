// Backfill do SOLICITANTE em chamados órfãos do GLPI.
//
// Contexto: até o commit c9d68d6, criar chamado pelo app mandava `user_recipient`
// — que o GLPI ignora, gravando nele o usuário autenticado (o de serviço). Sem um
// TeamMember role="requester" rastreado, `attributedTrackedId` não acha dono do
// chamado e ele é DESCARTADO no próximo full sync (some do espelho).
//
// Este script acha esses órfãos e posta o requester faltante. Regra combinada:
// o solicitante passa a ser o ATRIBUÍDO atual do chamado.
//
// Uso:
//   npx tsx --env-file=.env scripts/glpi-backfill-requester.ts             (dry-run)
//   npx tsx --env-file=.env scripts/glpi-backfill-requester.ts --apply     (escreve)
//   ... --apply --only-app   → só os que o app abriu (autor = usuário de serviço)
//
// Órfão ≠ só os do app: chamado que OUTRA pessoa abre PARA alguém do marketing
// entra no team como `assigned`, sem `requester` nenhum — também fica de fora do
// espelho. Esses dá pra resolver sem escrever no GLPI, fazendo o
// `attributedTrackedId` cair pro atribuído rastreado. Daí o `--only-app`.
const BASE = (process.env.GLPI_URL ?? "").replace(/\/$/, "");
const API = `${BASE}/api.php/v2.1`;
const ENTITY_ID = Number(process.env.GLPI_ENTITY_ID) || 54;
const TRACKED = (process.env.GLPI_TRACKED_USER_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

const APPLY = process.argv.includes("--apply");
const ONLY_APP = process.argv.includes("--only-app");

const FIELDS = "id,name,status,entity,user_recipient,team,date_creation,is_deleted";

type TeamMember = { id: number; name: string; display_name?: string; role: string };
type Ticket = {
  id: number;
  name: string;
  is_deleted?: boolean;
  status?: { id: number; name: string } | null;
  user_recipient?: { id: number; name: string } | null;
  team?: TeamMember[];
  date_creation?: string;
};

async function token(): Promise<string> {
  const r = await fetch(`${BASE}/api.php/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      client_id: process.env.GLPI_CLIENT_ID,
      client_secret: process.env.GLPI_CLIENT_SECRET,
      scope: "api",
      username: process.env.GLPI_USERNAME,
      password: process.env.GLPI_PASSWORD,
    }),
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token as string;
}

// A coleção /Assistance/Ticket só responde COM filter (sem ele dá 500 nesta
// instância) e pagina por start/limit — `range` é ignorado.
async function listEntityTickets(t: string): Promise<Ticket[]> {
  const out: Ticket[] = [];
  let start = 0;
  const limit = 100;
  for (;;) {
    const qs = new URLSearchParams({
      filter: `entity.id==${ENTITY_ID}`,
      fields: FIELDS,
      start: String(start),
      limit: String(limit),
    });
    const r = await fetch(`${API}/Assistance/Ticket?${qs}`, {
      headers: { Authorization: `Bearer ${t}`, "Accept-Language": "pt_BR" },
    });
    if (!r.ok) throw new Error(`list ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const page = (await r.json()) as Ticket[];
    out.push(...page);
    if (page.length < limit) break;
    start += limit;
  }
  return out;
}

const hasRole = (m: TeamMember, role: string) => String(m.role ?? "").toLowerCase().includes(role);

async function main() {
  if (!TRACKED.length) throw new Error("GLPI_TRACKED_USER_IDS vazio.");
  const t = await token();
  const tickets = (await listEntityTickets(t)).filter((x) => !x.is_deleted);
  console.log(`Entidade ${ENTITY_ID}: ${tickets.length} chamado(s) ativo(s). Rastreados: ${TRACKED.join(", ")}`);

  const corrigir: { t: Ticket; assignee: TeamMember }[] = [];
  const semAtribuido: Ticket[] = [];
  const atribuidoNaoRastreado: { t: Ticket; assignee: TeamMember }[] = [];

  for (const tk of tickets) {
    const team = tk.team ?? [];
    // Órfão = mesma condição do attributedTrackedId: sem requerente rastreado E
    // com autor não rastreado. Só esses somem do espelho.
    const temRequesterRastreado = team.some((m) => hasRole(m, "requester") && TRACKED.includes(m.id));
    const autorRastreado = TRACKED.includes(tk.user_recipient?.id ?? 0);
    if (temRequesterRastreado || autorRastreado) continue;

    const assignee = team.find((m) => hasRole(m, "assigned"));
    if (!assignee) semAtribuido.push(tk);
    else if (!TRACKED.includes(assignee.id)) atribuidoNaoRastreado.push({ t: tk, assignee });
    else corrigir.push({ t: tk, assignee });
  }

  const nome = (m: TeamMember) => m.display_name || m.name;
  const autor = (tk: Ticket) => tk.user_recipient?.name ?? "?";
  const criadoPeloApp = (tk: Ticket) => autor(tk) === (process.env.GLPI_USERNAME ?? "");

  console.log(`\n== A CORRIGIR (${corrigir.length}) — solicitante vira o atribuído ==`);
  console.log(`   (app = aberto pelo OpenBoard; os outros já eram órfãos antes e vão APARECER no espelho)`);
  for (const { t: tk, assignee } of corrigir) {
    const tag = criadoPeloApp(tk) ? "[app]  " : "[antigo]";
    console.log(`  ${tag} #${tk.id}  autor: ${autor(tk).padEnd(18)} → requerente: ${nome(assignee)} — ${tk.name.slice(0, 50)}`);
  }

  if (atribuidoNaoRastreado.length) {
    console.log(`\n== PULADOS: atribuído NÃO é do marketing (${atribuidoNaoRastreado.length}) ==`);
    console.log("   (pôr como requerente não resolveria — continuaria fora do espelho)");
    for (const { t: tk, assignee } of atribuidoNaoRastreado) {
      console.log(`  #${tk.id}  ${nome(assignee)} (id ${assignee.id})  — ${tk.name.slice(0, 60)}`);
    }
  }
  if (semAtribuido.length) {
    console.log(`\n== PULADOS: sem atribuído, não dá pra deduzir (${semAtribuido.length}) ==`);
    for (const tk of semAtribuido) console.log(`  #${tk.id}  — ${tk.name.slice(0, 60)}`);
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN. Nada foi escrito. Rode com --apply pra corrigir os ${corrigir.length}.`);
    return;
  }

  const alvo = ONLY_APP ? corrigir.filter(({ t: tk }) => criadoPeloApp(tk)) : corrigir;
  console.log(`\nAplicando em ${alvo.length} chamado(s)${ONLY_APP ? " (só os do app)" : ""}…`);
  let ok = 0;
  for (const { t: tk, assignee } of alvo) {
    const r = await fetch(`${API}/Assistance/Ticket/${tk.id}/TeamMember`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", "Accept-Language": "pt_BR" },
      body: JSON.stringify({ type: "User", id: assignee.id, role: "requester" }),
    });
    if (r.ok) {
      ok++;
      console.log(`  ok  #${tk.id} → requerente ${nome(assignee)}`);
    } else {
      console.log(`  ERRO #${tk.id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
  }
  console.log(`\n${ok}/${alvo.length} corrigido(s). Rode o sync do GLPI pra refletir no espelho.`);
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
