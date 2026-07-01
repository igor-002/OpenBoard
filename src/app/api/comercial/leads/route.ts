import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestLead, type LeadInput } from "@/server/comercial/leads";

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

// AtendAI manda um envelope `{ evento, data:{...} }` (ex.: ENTRADA_NOVA_CONVERSA_FILA).
// Normaliza pro nosso LeadInput. Retorna null se não for esse formato.
function fromAtendAI(body: unknown): LeadInput | null {
  if (!body || typeof body !== "object") return null;
  const env = body as Record<string, unknown>;
  if (!("evento" in env) || typeof env.data !== "object" || env.data == null) return null;
  const d = env.data as Record<string, unknown>;
  const nome = typeof d.nome === "string" ? d.nome.trim() : "";
  if (!nome) return null;

  // Tipo do evento + detecção de finalização do atendimento (2º gatilho do AtendAI).
  // Cobre variações do nome (FINALIZACAO_ATENDIMENTO, ATENDIMENTO_FINALIZADO, ENCERRAMENTO…).
  const evento = typeof env.evento === "string" ? env.evento : null;
  const finalizado = !!evento && /FINALIZ|ENCERR|CONCLU|\bFIM\b|FINISH|CLOSE/i.test(evento);
  console.log("[leads-ingest] evento:", evento, "finalizado:", finalizado); // TEMP: confirmar nome do evento de finalização

  const contato = d.whatsappid != null ? String(d.whatsappid) : null;
  const fila = (d.filaPersonalizada as Record<string, unknown> | null)?.nome_fila;
  const setor = (d.setor as Record<string, unknown> | null)?.nome_setor;
  // Responsável: atendente que assumiu/moveu a conversa (vem preenchido nas filas personalizadas).
  // AtendAI manda só o 1º nome (ex. "Cesar") e SEM e-mail; casa por nome no server.
  const usuario = d.usuario as Record<string, unknown> | null;
  const assignedUserName = usuario && typeof usuario.nome === "string" ? usuario.nome : (usuario && typeof usuario.name === "string" ? usuario.name : null);
  const assignedUserEmail = usuario && typeof usuario.email === "string" ? usuario.email : null;
  // username do AtendAI == prefixo do e-mail no OpenBoard (ex. "cesar.augusto"@openit.group) — match mais forte.
  const assignedUserUsername = usuario && typeof usuario.username === "string" ? usuario.username : null;
  const msgs = Array.isArray(d.mensagensAtendimento) ? (d.mensagensAtendimento as Record<string, unknown>[]) : [];
  // Mensagens estruturadas p/ acumular na conversa (dedup por id do AtendAI).
  const mensagens = msgs
    .filter((m) => m.id != null && typeof m.mensagem === "string" && m.mensagem)
    .map((m) => ({
      externalId: String(m.id),
      mensagem: String(m.mensagem),
      remetente: typeof m.remetente === "string" ? m.remetente : null,
      tipo: typeof m.tipo_mensagem === "string" ? m.tipo_mensagem : null,
      mensagemBot: m.mensagem_bot === true || m.mensagem_ia === true,
      sentAt: typeof m.data_envio === "string" ? new Date(m.data_envio) : null,
    }));
  const hist = msgs.map((m) => `[${m.remetente ?? "?"}] ${m.mensagem ?? ""}`).join("\n");
  const observacoes = [
    typeof fila === "string" && fila.trim() ? `Fila: ${fila.trim()}` : null,
    typeof setor === "string" && setor.trim() ? `Setor: ${setor.trim()}` : null,
    hist || null,
  ].filter(Boolean).join("\n") || null;

  // Não persistir o hash de senha do atendente que o AtendAI manda no usuario.
  let safePayload: unknown = body;
  if (usuario && typeof usuario === "object") {
    const { senha: _senha, senha_ramal_vital: _srv, ...usuarioSemSenha } = usuario;
    void _senha; void _srv;
    safePayload = { ...env, data: { ...d, usuario: usuarioSemSenha } };
  }

  return {
    nome,
    contato,
    origem: "atendai",
    externalId: d.id != null ? `atendai-${d.id}` : null,
    observacoes,
    assignedUserName,
    assignedUserEmail,
    assignedUserUsername,
    mensagens,
    eventoUltimo: evento,
    finalizado,
    payload: safePayload,
  };
}

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

  // Caminho AtendAI (envelope { evento, data }). Se não casar, tenta o formato flat.
  let input: LeadInput | null = fromAtendAI(body);

  if (!input) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "payload inválido" }, { status: 422 });
    }
    const d = parsed.data;
    input = {
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
    };
  }

  try {
    const r = await ingestLead(input);
    return NextResponse.json({ ok: true, created: r.created, id: r.id, matchedBy: r.matchedBy }, { status: r.created ? 201 : 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
