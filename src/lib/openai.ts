// Cliente da API OpenAI (Chat Completions). Server-only (usa OPENAI_API_KEY — segredo).
// Espelha o padrão de src/lib/ixc.ts: fetch cru, headers, erro tipado. Sem a lib `openai`.
//
// Modelo e preço vêm de env (mudam com frequência na OpenAI, então não hardcodar):
//   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_PRICE_IN_PER_1M, OPENAI_PRICE_OUT_PER_1M
import "server-only";

const API_KEY = process.env.OPENAI_API_KEY ?? "";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
// Preço por 1M tokens em USD. Defaults do gpt-4o-mini; ajustar por env conforme o modelo.
const PRICE_IN = Number(process.env.OPENAI_PRICE_IN_PER_1M || "0.15");
const PRICE_OUT = Number(process.env.OPENAI_PRICE_OUT_PER_1M || "0.60");

export function openaiConfigured(): boolean {
  return Boolean(API_KEY && !API_KEY.includes("<"));
}

export class OpenAIError extends Error {
  constructor(public status: number, detail?: string) {
    super(`OpenAI → ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "OpenAIError";
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatUsage = { promptTokens: number; completionTokens: number };
export type ChatResult = { content: string; usage: ChatUsage };

// Chat Completions com resposta forçada em JSON (response_format json_object).
export async function chatJson(messages: ChatMessage[], opts?: { model?: string; maxTokens?: number }): Promise<ChatResult> {
  if (!openaiConfigured()) throw new OpenAIError(401, "OPENAI_API_KEY ausente");

  const model = opts?.model || OPENAI_MODEL;
  // gpt-5* e o-series usam `max_completion_tokens`; gpt-4o/4.1 usam `max_tokens`.
  const tokenParam = /^(gpt-5|o\d)/i.test(model) ? "max_completion_tokens" : "max_tokens";
  const body: Record<string, unknown> = {
    model,
    messages,
    response_format: { type: "json_object" },
    [tokenParam]: opts?.maxTokens ?? 700,
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new OpenAIError(504, (e as Error).message);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {}
    throw new OpenAIError(res.status, detail);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

// Custo em USD*1e6 (micros, inteiro) a partir dos tokens reais e do preço por 1M.
export function custoUsdMicros(usage: ChatUsage): number {
  const usd = (usage.promptTokens * PRICE_IN + usage.completionTokens * PRICE_OUT) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
