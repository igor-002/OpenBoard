"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit, registerFailure } from "@/lib/rate-limit";
import { normDoc, normPhone } from "@/lib/leads";
import { SITUACOES, VENCIMENTO_DIAS } from "@/lib/cadastros";
import { createSolicitacao } from "@/server/comercial/cadastros";

// Mesmo helper do (auth)/actions.ts: x-real-ip (nginx) > último hop do XFF.
async function clientIp(): Promise<string> {
  const h = await headers();
  const realIp = h.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "local";
}

export type SolicitarState = { ok?: boolean; error?: string };

const opt = (max: number) => z.string().trim().max(max, "Texto muito longo").optional().or(z.literal(""));

const schema = z.object({
  solicitante: z.string().trim().min(2, "Informe quem está solicitando").max(120, "Nome muito longo"),
  nomeCompleto: z.string().trim().min(2, "Informe o nome completo / razão social").max(200, "Nome muito longo"),
  cnpjCpf: z
    .string()
    .trim()
    .max(30, "CPF/CNPJ muito longo")
    .refine((v) => normDoc(v) !== null, "CPF/CNPJ inválido (11 ou 14 dígitos)"),
  rg: opt(30),
  inscricaoEstadual: opt(30),
  cidade: opt(120),
  bairro: opt(120),
  rua: opt(160),
  pontoReferencia: opt(200),
  cep: opt(12),
  telefone1: z
    .string()
    .trim()
    .max(25, "Telefone muito longo")
    .refine((v) => normPhone(v) !== null, "Telefone 1 inválido"),
  telefone2: opt(25),
  emailBoletos: z.string().trim().max(160).email("E-mail inválido").optional().or(z.literal("")),
  vencimentoDia: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (VENCIMENTO_DIAS as readonly number[]).includes(v), "Vencimento inválido"),
  plano: opt(120),
  valor: opt(20),
  observacao: opt(2000),
  situacao: z.enum(SITUACOES, { message: "Situação inválida" }),
  prazoAt: opt(10), // yyyy-mm-dd do <input type="date">
});

export async function solicitarCadastroAction(_prev: SolicitarState, formData: FormData): Promise<SolicitarState> {
  // Honeypot: campo invisível pra humanos; preenchido = bot → finge sucesso.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  // Rate limit por IP — conta TODO envio (form aberto, sem login).
  const key = `solicitar:${await clientIp()}`;
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    const min = Math.ceil((limit.retryAfterSec ?? 60) / 60);
    return { error: `Muitos envios seguidos. Tente novamente em ~${min} min.` };
  }
  registerFailure(key);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Prazo: data local (meio-dia evita voltar um dia por fuso). Passado longe = inválido.
  let prazoAt: Date | null = null;
  if (d.prazoAt) {
    const p = new Date(`${d.prazoAt}T12:00:00`);
    if (isNaN(p.getTime())) return { error: "Prazo inválido." };
    if (p.getTime() < Date.now() - 2 * 86400000) return { error: "O prazo informado já passou." };
    prazoAt = p;
  }

  // "1.234,56" → 1234.56; "1500.50" (decimal com ponto) fica como está.
  const valorStr = (d.valor ?? "").includes(",")
    ? (d.valor ?? "").replace(/\./g, "").replace(",", ".")
    : (d.valor ?? "");

  await createSolicitacao({
    solicitante: d.solicitante,
    nomeCompleto: d.nomeCompleto,
    cnpjCpf: d.cnpjCpf,
    rg: d.rg || null,
    inscricaoEstadual: d.inscricaoEstadual || null,
    cidade: d.cidade || null,
    bairro: d.bairro || null,
    rua: d.rua || null,
    pontoReferencia: d.pontoReferencia || null,
    cep: d.cep || null,
    telefone1: d.telefone1,
    telefone2: d.telefone2 || null,
    emailBoletos: d.emailBoletos || null,
    vencimentoDia: d.vencimentoDia,
    plano: d.plano || null,
    valorCents: Math.round((parseFloat(valorStr) || 0) * 100),
    observacao: d.observacao || null,
    situacao: d.situacao,
    prazoAt,
  });
  return { ok: true };
}
