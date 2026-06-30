import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestLead } from "@/server/comercial/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook de ingest de leads — o sistema de chat de atendimento faz POST aqui
// com os dados do lead pra gerar (ou re-tocar) um card no Kanban comercial.
//
// Auth: header `Authorization: Bearer <LEADS_INGEST_TOKEN>` (ou ?key=).
// Dedup: se já existir lead com mesmo externalId / CPF-CNPJ / contato / e-mail,
// NÃO cria card novo — registra o toque e retorna o id existente (created:false).
//
// Body JSON:
// { nome*, empresa?, cnpjCpf?, contato?, email?, origem?, valorEstimado? (reais),
//   externalId?, observacoes?, payload? }

const schema = z.object({
  nome: z.string().min(2),
  empresa: z.string().optional().nullable(),
  cnpjCpf: z.string().optional().nullable(),
  contato: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  valorEstimado: z.number().optional(), // em reais
  valorEstimadoCents: z.number().optional(), // alternativa em centavos
  externalId: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  payload: z.unknown().optional(),
});

function authorized(request: Request, url: URL): boolean {
  const expected = process.env.LEADS_INGEST_TOKEN;
  if (!expected) return false; // sem token configurado, rejeita
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const key = bearer ?? url.searchParams.get("key");
  return key === expected;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!authorized(request, url)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  // TEMP: loga payload cru do AtendAI p/ mapear os campos. Remover depois.
  console.log("[leads-ingest] payload:", JSON.stringify(body));

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "payload inválido" }, { status: 422 });
  }
  const d = parsed.data;

  try {
    const r = await ingestLead({
      nome: d.nome,
      empresa: d.empresa ?? null,
      cnpjCpf: d.cnpjCpf ?? null,
      contato: d.contato ?? null,
      email: d.email ?? null,
      origem: d.origem ?? "chat-atendimento",
      valorEstimadoCents: d.valorEstimadoCents ?? (d.valorEstimado != null ? Math.round(d.valorEstimado * 100) : 0),
      observacoes: d.observacoes ?? null,
      externalId: d.externalId ?? null,
      payload: d.payload ?? body,
    });
    return NextResponse.json({ ok: true, created: r.created, id: r.id, matchedBy: r.matchedBy }, { status: r.created ? 201 : 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
