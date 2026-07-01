// Análise IA da conversa do atendente (sob demanda). Server-only.
// Lê as mensagens do lead, manda pro modelo da OpenAI e grava nota/resumo/pontos +
// tokens e custo real nos campos analise* do Lead. Re-executável (sobrescreve).
import "server-only";
import { db } from "@/lib/db";
import { ensureMensagens, sortConversa } from "@/server/comercial/leads";
import { chatJson, custoUsdMicros, openaiConfigured, OPENAI_MODEL, OpenAIError, type ChatMessage } from "@/lib/openai";
import type { Prisma } from "@/generated/prisma";

const asStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");

export async function analisarConversaLead(leadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!openaiConfigured()) return { ok: false, error: "IA não configurada (OPENAI_API_KEY ausente)." };

  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, nome: true, payload: true } });
  if (!lead) return { ok: false, error: "Lead não encontrado." };

  await ensureMensagens(leadId, lead.payload); // backfill de leads antigos
  const mensagens = sortConversa(await db.leadMensagem.findMany({ where: { leadId } }));
  if (!mensagens.length) return { ok: false, error: "Sem mensagens da conversa pra analisar." };

  const transcript = mensagens.map((m) => `${m.remetente ?? "?"}: ${m.mensagem}`).join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Você é um gestor comercial avaliando a QUALIDADE do atendimento feito pelo atendente numa conversa de WhatsApp com um lead. " +
        "Avalie clareza, cordialidade, rapidez, entendimento da necessidade e condução para a venda. " +
        "Responda SOMENTE em JSON válido, em português do Brasil, com as chaves: " +
        'nota (inteiro de 0 a 10), resumo (string curta), pontosFortes (array de strings), ' +
        "pontosAMelhorar (array de strings), proximoPasso (string com a próxima ação recomendada).",
    },
    { role: "user", content: `Lead: ${lead.nome}\n\nConversa (remetente: mensagem):\n${transcript}` },
  ];

  let r;
  try {
    r = await chatJson(messages);
  } catch (e) {
    const msg = e instanceof OpenAIError ? e.message : (e as Error).message;
    return { ok: false, error: `Falha na IA: ${msg}` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(r.content) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Resposta da IA não veio em JSON válido." };
  }

  const nota = Math.max(0, Math.min(10, Math.round(Number(parsed.nota) || 0)));
  const pontos = {
    fortes: asStrArray(parsed.pontosFortes),
    aMelhorar: asStrArray(parsed.pontosAMelhorar),
    proximoPasso: asStr(parsed.proximoPasso),
  };

  await db.lead.update({
    where: { id: leadId },
    data: {
      analiseNota: nota,
      analiseResumo: asStr(parsed.resumo) || null,
      analisePontos: pontos as unknown as Prisma.InputJsonValue,
      analiseModelo: OPENAI_MODEL,
      analiseTokensIn: r.usage.promptTokens,
      analiseTokensOut: r.usage.completionTokens,
      analiseCustoUsdMicros: custoUsdMicros(r.usage),
      analiseAt: new Date(),
    },
  });

  return { ok: true };
}
