// Cliente da API IXCSoft. Server-only (usa IXC_TOKEN — segredo).
// Toda a lógica/armadilhas vêm de IXC_INTEGRATION_HANDOFF.md.
//
// Dois modos de acesso:
//  - Com IXC_PROXY_URL  → POST {proxy}/ixc/{tabela}. O proxy injeta Authorization
//    e o header `ixcsoft: listar` (modo VPS/prod). Mandamos o header mesmo assim
//    (inofensivo).
//  - Sem proxy          → POST {base}/webservice/v1/{tabela} com Authorization +
//    `ixcsoft: listar` direto (precisa de IXC_TOKEN).
import "server-only";

// ── Config (env) ─────────────────────────────────────────────────────────────
const BASE_URL = process.env.IXC_BASE_URL ?? "";
const PROXY_URL = process.env.IXC_PROXY_URL ?? "";
const TOKEN = process.env.IXC_TOKEN ?? ""; // já com prefixo "Basic "
// Campo de status do contrato. `status_internet` é o status de NEGÓCIO (A/AA/CM/FA/CN/N,
// igual ao handoff/SalesTracker). O campo cru `status` usa outro vocabulário (A/I/D/P/N)
// — NÃO usar. Override via env só se a versão do IXC divergir.
export const CAMPO_STATUS = process.env.IXC_CAMPO_STATUS_CONTRATO || "status_internet";
export const FILIAIS = (process.env.IXC_FILIAIS || "1,2,6")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function ixcConfigured(): boolean {
  // Proxy injeta auth → basta a URL do proxy. Sem proxy, precisa base + token.
  return Boolean(PROXY_URL || (BASE_URL && TOKEN && !TOKEN.includes("<")));
}

function endpoint(tabela: string): string {
  if (PROXY_URL) return `${PROXY_URL.replace(/\/$/, "")}/ixc/${tabela}`;
  return `${BASE_URL.replace(/\/$/, "")}/webservice/v1/${tabela}`;
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export type IxcOper = "=" | ">=" | "<=" | ">" | "<" | "L";
export type IxcQuery = {
  qtype?: string; // campo COM prefixo da tabela (senão → 500). Ex.: cliente_contrato.id_cliente
  query?: string; // valor
  oper?: IxcOper;
  page?: number;
  rp?: number; // registros por página
  sortname?: string;
  sortorder?: "asc" | "desc";
  [k: string]: string | number | undefined;
};

export type IxcRecord = Record<string, string>;
type IxcResponse = { total?: number | string; registros?: unknown };

// ── Mensagens de erro (handoff §11) ──────────────────────────────────────────
const ERRO: Record<number, string> = {
  400: "Erro SSL ou auth diferente de Basic",
  401: "Token inválido ou usuário inativo",
  403: "Token gerado em servidor antigo (pós-migração)",
  404: "Falta header `ixcsoft: listar`",
  500: "Endpoint errado ou qtype sem prefixo de tabela",
  504: "Timeout do servidor IXC",
};

export class IxcError extends Error {
  constructor(public status: number, public tabela: string, detail?: string) {
    super(`IXC ${tabela} → ${status}: ${ERRO[status] ?? "erro"}${detail ? ` (${detail})` : ""}`);
    this.name = "IxcError";
  }
}

// Armadilha #1 (handoff §4): `registros` vem como array, objeto indexado, ou vazio.
function normalizeRegistros(raw: unknown): IxcRecord[] {
  if (Array.isArray(raw)) return raw as IxcRecord[];
  if (raw && typeof raw === "object") return Object.values(raw as object) as IxcRecord[];
  return [];
}

// ── Listagem (POST + header ixcsoft) ─────────────────────────────────────────
export async function ixcList(
  tabela: string,
  params: IxcQuery = {},
): Promise<{ registros: IxcRecord[]; total: number }> {
  if (!ixcConfigured()) {
    throw new IxcError(401, tabela, "IXC não configurado (IXC_TOKEN/IXC_PROXY_URL ausentes)");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ixcsoft: "listar",
  };
  // Injeta Authorization quando temos token (modo direto OU proxy passthrough).
  // Proxy que injeta a própria credencial simplesmente ignora/sobrescreve.
  if (TOKEN && !TOKEN.includes("<")) headers.Authorization = TOKEN;

  const body: IxcQuery = { rp: 100, page: 1, ...params };

  let res: Response;
  try {
    res = await fetch(endpoint(tabela), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new IxcError(504, tabela, (e as Error).message);
  }
  if (!res.ok) throw new IxcError(res.status, tabela);

  const json = (await res.json()) as IxcResponse;
  return {
    registros: normalizeRegistros(json.registros),
    total: Number(json.total ?? 0),
  };
}

// Varre TODAS as páginas (handoff §3): loop do/while enquanto (page-1)*rp < total.
export async function ixcListAll(tabela: string, params: IxcQuery = {}): Promise<IxcRecord[]> {
  const rp = Number(params.rp ?? 100);
  const out: IxcRecord[] = [];
  let page = 1;
  let total = Infinity;
  do {
    const { registros, total: t } = await ixcList(tabela, { ...params, page, rp });
    out.push(...registros);
    total = t;
    page++;
    if (registros.length === 0) break; // proteção contra total mentiroso
  } while ((page - 1) * rp < total);
  return out;
}

// ── Concorrência (handoff §9): processar em lotes, falha individual não aborta ──
export async function ixcBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  size = 10,
): Promise<{ results: R[]; errors: number }> {
  const results: R[] = [];
  let errors = 0;
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const settled = await Promise.allSettled(slice.map(fn));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
      else errors++;
    }
  }
  return { results, errors };
}

// ── Status do contrato (handoff §6) ──────────────────────────────────────────
// Rótulos/predicados vivem em src/lib/status.ts (client-safe). Re-exporta aqui
// p/ compatibilidade com quem importa de "@/lib/ixc".
export { STATUS_LABEL, isRealizado, isPipeline } from "./status";

// "0000-00-00" é o nulo do IXC (handoff §7) → null.
// IXC manda wall-clock sem fuso ("2026-06-01 00:00:00"). Parseamos como UTC (sufixo Z)
// pra preservar o relógio de parede independente do fuso da máquina — senão a virada
// de mês desloca e derruba contratos da borda. Pareado com monthRange (também UTC).
export function ixcDate(v?: string): Date | null {
  if (!v || v.startsWith("0000-00-00")) return null;
  const iso = v.trim().replace(" ", "T");
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return isNaN(+d) ? null : d;
}

// Reais → centavos. IXC manda "123.45" (ponto decimal) ou, às vezes, BR "1.234,56".
export function moneyToCents(v?: string): number {
  if (!v) return 0;
  let s = String(v).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // formato BR
  const n = Number(s);
  return Math.round((isNaN(n) ? 0 : n) * 100);
}
