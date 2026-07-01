// Análise IA da conversa do atendente (sob demanda). Server-only.
// Lê as mensagens do lead, manda pro modelo da OpenAI e grava nota/resumo/pontos +
// tokens e custo real nos campos analise* do Lead. Re-executável (sobrescreve).
import "server-only";
import { db } from "@/lib/db";
import { ensureMensagens, sortConversa } from "@/server/comercial/leads";
import { getOpenAIConfig } from "@/server/settings";
import { chatJson, custoUsdMicros, openaiConfigured, OpenAIError, type ChatMessage } from "@/lib/openai";
import type { Prisma } from "@/generated/prisma";

const asStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const nota10 = (v: unknown): number => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));

// Critérios avaliados (scorecard). Nome fixo p/ a IA pontuar cada um 0-10.
type Criterio = { nome: string; nota: number; comentario: string };
const CRITERIOS = [
  "Abertura e cordialidade",
  "Entendimento da necessidade",
  "Clareza e objetividade",
  "Empatia e escuta ativa",
  "Argumentação de valor e objeções",
  "Condução ao fechamento",
  "Agilidade e follow-up",
] as const;

// Prompt de julgamento — baseado em QA scorecards de atendimento + frameworks de
// venda (discovery, LAER p/ objeções, fechamento por reafirmação de valor).
const SYSTEM_PROMPT = `Você é um gestor comercial sênior de um provedor de internet, avaliando com rigor a QUALIDADE do atendimento feito por UM atendente da equipe numa conversa de WhatsApp com um lead (cliente em potencial). Seu objetivo é dar uma avaliação honesta, específica e acionável — não elogie por elogiar.

Avalie SOMENTE a atuação do ATENDENTE (mensagens do lado da empresa: atendente humano ou bot). Não avalie o cliente. Se a conversa for muito curta, automática (só bot) ou sem resposta do cliente, reflita isso numa nota baixa e diga que faltou condução humana.

Pontue cada critério de 0 a 10 (0-2 péssimo, 3-4 fraco, 5-6 regular, 7-8 bom, 9-10 excelente). Baseie CADA nota em evidência da conversa (cite o que o atendente fez ou deixou de fazer). Critérios:
1. "Abertura e cordialidade" — saudação, apresentação, tom acolhedor e profissional.
2. "Entendimento da necessidade" — fez perguntas de descoberta (quantos usuários, uso, dor atual) antes de oferecer? Entendeu o caso ou já empurrou plano?
3. "Clareza e objetividade" — explicou plano/preço/condições de forma clara, sem jargão nem enrolação.
4. "Empatia e escuta ativa" — reconheceu a dor/contexto do cliente, respondeu ao que foi perguntado, não ignorou pontos.
5. "Argumentação de valor e objeções" — vendeu benefício (estabilidade, suporte) e não só preço; tratou objeções (fidelidade, preço, concorrência) com técnica (ouvir, reconhecer, explorar, responder).
6. "Condução ao fechamento" — teve um próximo passo claro (enviar proposta, agendar, CTA), criou urgência/valor sem ser agressivo, não deixou a conversa morrer.
7. "Agilidade e follow-up" — respondeu com rapidez, não deixou o cliente no vácuo, retomou quando preciso.

A nota GERAL (0-10) é uma síntese ponderada dos critérios, dando mais peso a Entendimento, Argumentação/objeções e Condução ao fechamento (são os que mais impactam a venda).

Responda SOMENTE com JSON válido (nada fora do JSON), em português do Brasil, no formato:
{
  "nota": <inteiro 0-10 geral>,
  "resumo": "<2-3 frases: como foi o atendimento e o que definiu a nota>",
  "criterios": [{"nome": "<um dos 7 nomes acima, exato>", "nota": <0-10>, "comentario": "<curto, com evidência>"}],
  "pontosFortes": ["<o que o atendente fez bem, específico>"],
  "pontosAMelhorar": ["<falhas concretas e como corrigir>"],
  "proximoPasso": "<a próxima ação recomendada pro atendente com esse lead>",
  "risco": "<baixo|medio|alto — risco de perder o lead pela forma como foi conduzido>"
}
Inclua os 7 critérios no array "criterios". A palavra "json" está aqui para garantir o formato.`;

export async function analisarConversaLead(leadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = await getOpenAIConfig();
  if (!openaiConfigured(cfg)) return { ok: false, error: "IA não configurada — informe a chave da OpenAI em Config IA." };

  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, nome: true, payload: true } });
  if (!lead) return { ok: false, error: "Lead não encontrado." };

  await ensureMensagens(leadId, lead.payload); // backfill de leads antigos
  const mensagens = sortConversa(await db.leadMensagem.findMany({ where: { leadId } }));
  if (!mensagens.length) return { ok: false, error: "Sem mensagens da conversa pra analisar." };

  const transcript = mensagens.map((m) => `${m.remetente ?? "?"}: ${m.mensagem}`).join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Lead: ${lead.nome}\n\nConversa (remetente: mensagem):\n${transcript}\n\nAvalie o atendimento conforme as instruções e devolva o JSON.` },
  ];

  let r;
  try {
    r = await chatJson(cfg, messages, { maxTokens: 1100 });
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

  const nota = nota10(parsed.nota);
  // Normaliza os critérios: só nomes conhecidos, nota 0-10, comentário string.
  const rawCrit = Array.isArray(parsed.criterios) ? (parsed.criterios as Record<string, unknown>[]) : [];
  const criterios: Criterio[] = rawCrit
    .map((c) => ({ nome: asStr(c?.nome), nota: nota10(c?.nota), comentario: asStr(c?.comentario) }))
    .filter((c) => (CRITERIOS as readonly string[]).includes(c.nome));
  const risco = ["baixo", "medio", "alto"].includes(asStr(parsed.risco)) ? asStr(parsed.risco) : null;
  const pontos = {
    fortes: asStrArray(parsed.pontosFortes),
    aMelhorar: asStrArray(parsed.pontosAMelhorar),
    proximoPasso: asStr(parsed.proximoPasso),
    criterios,
    risco,
  };

  await db.lead.update({
    where: { id: leadId },
    data: {
      analiseNota: nota,
      analiseResumo: asStr(parsed.resumo) || null,
      analisePontos: pontos as unknown as Prisma.InputJsonValue,
      analiseModelo: cfg.model,
      analiseTokensIn: r.usage.promptTokens,
      analiseTokensOut: r.usage.completionTokens,
      analiseCustoUsdMicros: custoUsdMicros(cfg, r.usage),
      analiseAt: new Date(),
    },
  });

  return { ok: true };
}
