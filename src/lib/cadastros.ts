// Solicitações de cadastro de clientes (form público /solicitar-cadastro +
// fila /comercial/cadastros). Client-safe (sem server-only): usado na UI e no backend.

export const SOLICITACAO_STATUS = [
  { id: "pendente", label: "Pendente", c: "var(--pr-med)" },
  { id: "cadastrado", label: "Cadastrado", c: "var(--st-done)" },
  { id: "cancelado", label: "Cancelado", c: "var(--st-risk)" },
] as const;

export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number]["id"];
export const SOLICITACAO_STATUS_IDS = SOLICITACAO_STATUS.map((s) => s.id) as SolicitacaoStatus[];
export function isSolicitacaoStatus(s: string | null | undefined): s is SolicitacaoStatus {
  return !!s && (SOLICITACAO_STATUS_IDS as string[]).includes(s);
}
export function solicitacaoStatusMeta(id: string) {
  return SOLICITACAO_STATUS.find((s) => s.id === id) ?? { id, label: id, c: "var(--muted)" };
}

export const SITUACOES = ["normal", "urgente"] as const;
export type Situacao = (typeof SITUACOES)[number];

// Tipo da solicitação: cadastro (novo contrato) ou upgrade (troca de plano).
export const SOLICITACAO_TIPOS = ["cadastro", "upgrade"] as const;
export type SolicitacaoTipo = (typeof SOLICITACAO_TIPOS)[number];
export function isSolicitacaoTipo(t: string | null | undefined): t is SolicitacaoTipo {
  return !!t && (SOLICITACAO_TIPOS as readonly string[]).includes(t);
}
export function solicitacaoTipoLabel(t: string): string {
  return t === "upgrade" ? "Upgrade" : "Novo contrato";
}

// Dias de vencimento aceitos pelo financeiro.
export const VENCIMENTO_DIAS = [5, 10, 15, 20, 25] as const;

// Prazo a ≤ este nº de dias torna a solicitação urgente automaticamente.
export const URGENTE_PRAZO_DIAS = 2;

// Dias corridos até o prazo, contando por dia de calendário local (hoje = 0).
// Negativo = vencido. null = sem prazo.
export function diasAtePrazo(prazoAt: Date | string | null | undefined, now = new Date()): number | null {
  if (!prazoAt) return null;
  const p = new Date(prazoAt);
  if (isNaN(p.getTime())) return null;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((dia(p) - dia(now)) / 86400000);
}

// Urgência efetiva = marcada urgente no form OU prazo a ≤2 dias (inclui vencido).
// Derivada — nunca sobrescreve o campo `situacao` no banco.
export function isUrgenteEfetivo(
  s: { situacao: string; prazoAt: Date | string | null },
  now = new Date(),
): boolean {
  if (s.situacao === "urgente") return true;
  const dias = diasAtePrazo(s.prazoAt, now);
  return dias !== null && dias <= URGENTE_PRAZO_DIAS;
}

// ── Parser do template de WhatsApp ──────────────────────────────────────────
// O time cola o checklist "📄 Documentos necessários..." já preenchido e o form
// completa os campos. Heurístico e tolerante: linha não reconhecida é ignorada.

export type SolicitacaoPrefill = Partial<{
  nomeCompleto: string;
  cnpjCpf: string;
  rg: string;
  inscricaoEstadual: string;
  cidade: string;
  bairro: string;
  rua: string;
  pontoReferencia: string;
  cep: string;
  telefone1: string;
  telefone2: string;
  emailBoletos: string;
  vencimentoDia: string;
  plano: string;
  valor: string;
  observacao: string;
}>;

// remove ✅/📄/emojis e espaços das pontas
const limpaLinha = (l: string) =>
  l.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();

// valor depois do último ":" da parte de label (labels têm "( ... )" no meio)
function valorDe(linha: string): string {
  const i = linha.lastIndexOf(":");
  return i >= 0 ? linha.slice(i + 1).trim() : "";
}

export function parseSolicitacaoTexto(texto: string): SolicitacaoPrefill {
  const out: SolicitacaoPrefill = {};
  const linhas = texto.split(/\r?\n/).map(limpaLinha).filter(Boolean);

  const LABELS: { re: RegExp; campo: keyof SolicitacaoPrefill | "endereco" | "telefones" }[] = [
    { re: /^nome completo/i, campo: "nomeCompleto" },
    { re: /^raz[aã]o social/i, campo: "nomeCompleto" },
    { re: /^cpf/i, campo: "cnpjCpf" },
    { re: /^cnpj/i, campo: "cnpjCpf" },
    { re: /^rg\b/i, campo: "rg" },
    { re: /^i\.?\s*e\b/i, campo: "inscricaoEstadual" },
    { re: /^inscri[cç][aã]o estadual/i, campo: "inscricaoEstadual" },
    { re: /^endere[cç]o/i, campo: "endereco" },
    { re: /^cep/i, campo: "cep" },
    { re: /^(dois )?telefones?/i, campo: "telefones" },
    { re: /^e-?mail/i, campo: "emailBoletos" },
    { re: /^(data de )?vencimento/i, campo: "vencimentoDia" },
    { re: /^plano/i, campo: "plano" },
    { re: /^valor/i, campo: "valor" },
    { re: /^observa[cç][aã]o/i, campo: "observacao" },
  ];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const hit = LABELS.find((l) => l.re.test(linha));
    if (!hit) continue;
    let v = valorDe(linha);
    // vencimento no template não tem ":" ("...(5, 10, 15, 20 ou 25); 10") → usa a linha toda
    if (!v && hit.campo === "vencimentoDia") v = linha;
    // valor na linha de baixo (ex.: "PLANO:\nFibra 500") — só se a próxima não for outro label
    if (!v && i + 1 < linhas.length && !LABELS.some((l) => l.re.test(linhas[i + 1]))) {
      v = linhas[i + 1];
    }
    if (!v) continue;

    if (hit.campo === "endereco") {
      // "Cidade, Bairro, Rua ... + ponto de referência"
      const [end, ref] = v.split(/\s*\+\s*/, 2);
      if (ref) out.pontoReferencia = ref.trim();
      const partes = (end ?? v).split(",").map((p) => p.trim()).filter(Boolean);
      if (partes.length >= 3) {
        out.cidade = partes[0];
        out.bairro = partes[1];
        out.rua = partes.slice(2).join(", ");
      } else if (partes.length === 2) {
        out.cidade = partes[0];
        out.rua = partes[1];
      } else {
        out.rua = end ?? v;
      }
    } else if (hit.campo === "telefones") {
      const tels = v.split(/\s*[\/;]\s*|\s+e\s+|\s*,\s*(?=\(?\d{2})/).map((t) => t.trim()).filter(Boolean);
      if (tels[0]) out.telefone1 = tels[0];
      if (tels[1]) out.telefone2 = tels[1];
    } else if (hit.campo === "vencimentoDia") {
      // ignora o "(5, 10, 15, 20 ou 25)" do template e pega o dia escolhido
      const semTemplate = v.replace(/\(.*?\)/g, "");
      const m = semTemplate.match(/\b(5|10|15|20|25)\b/);
      if (m) out.vencimentoDia = m[1];
    } else if (hit.campo === "valor") {
      out.valor = v.replace(/r\$\s*/i, "");
    } else {
      out[hit.campo] = v;
    }
  }
  return out;
}

type Ordenavel = { situacao: string; prazoAt: Date | string | null; createdAt: Date | string };

// Ordem da fila: urgente efetivo primeiro; entre urgentes, prazo mais próximo
// primeiro (sem prazo por último); depois, mais antigo primeiro.
export function compareSolicitacoes(a: Ordenavel, b: Ordenavel, now = new Date()): number {
  const ua = isUrgenteEfetivo(a, now) ? 0 : 1;
  const ub = isUrgenteEfetivo(b, now) ? 0 : 1;
  if (ua !== ub) return ua - ub;
  const pa = a.prazoAt ? new Date(a.prazoAt).getTime() : Infinity;
  const pb = b.prazoAt ? new Date(b.prazoAt).getTime() : Infinity;
  if (pa !== pb) return pa - pb;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
