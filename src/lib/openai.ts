// Cliente da API OpenAI (Chat Completions). Server-only.
// A config (chave/modelo/preço) vem de src/server/settings.ts (DB > env) — este
// módulo só faz o HTTP. Espelha o padrão de src/lib/ixc.ts: fetch cru, erro tipado.
import "server-only";

export type OpenAIConfig = {
  apiKey: string;
  model: string;
  priceIn: number;  // USD por 1M tokens de entrada
  priceOut: number; // USD por 1M tokens de saída
  baseUrl: string;
};

export function openaiConfigured(cfg: OpenAIConfig): boolean {
  return Boolean(cfg.apiKey && !cfg.apiKey.includes("<"));
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
export async function chatJson(cfg: OpenAIConfig, messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<ChatResult> {
  if (!openaiConfigured(cfg)) throw new OpenAIError(401, "chave da OpenAI ausente");

  // gpt-5* e o-series usam `max_completion_tokens`; gpt-4o/4.1 usam `max_tokens`.
  const tokenParam = /^(gpt-5|o\d)/i.test(cfg.model) ? "max_completion_tokens" : "max_tokens";
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    response_format: { type: "json_object" },
    [tokenParam]: opts?.maxTokens ?? 700,
  };

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
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
export function custoUsdMicros(cfg: OpenAIConfig, usage: ChatUsage): number {
  const usd = (usage.promptTokens * cfg.priceIn + usage.completionTokens * cfg.priceOut) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
