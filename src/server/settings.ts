// Configurações do app persistidas em DB (AppSetting), editáveis pela UI.
// Server-only. Valores sensíveis (chave da OpenAI) NUNCA voltam pro client — a
// página só mostra status mascarado. Precedência: valor no banco > variável de env.
import "server-only";
import { db } from "@/lib/db";
import type { OpenAIConfig } from "@/lib/openai";

export const SETTING_KEYS = {
  openaiApiKey: "openai_api_key",
  openaiModel: "openai_model",
  openaiPriceIn: "openai_price_in",
  openaiPriceOut: "openai_price_out",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const s = await db.appSetting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// Grava só o que veio preenchido (ignora vazio/null → mantém o valor atual).
export async function setSettings(entries: Record<string, string | null | undefined>): Promise<void> {
  for (const [k, v] of Object.entries(entries)) {
    const val = (v ?? "").trim();
    if (val) await setSetting(k, val);
  }
}

// Trata "" (compose passa envs vazias como string vazia) como ausente.
const clean = (s?: string | null): string | undefined => (s && s.trim() ? s.trim() : undefined);
const num = (s: string | undefined, def: number): number => {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : def;
};

export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  const rows = await db.appSetting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } } });
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const g = (k: string) => clean(m.get(k));
  const env = (k: string) => clean(process.env[k]);
  return {
    apiKey: g(SETTING_KEYS.openaiApiKey) ?? env("OPENAI_API_KEY") ?? "",
    model: g(SETTING_KEYS.openaiModel) ?? env("OPENAI_MODEL") ?? "gpt-4o-mini",
    priceIn: num(g(SETTING_KEYS.openaiPriceIn) ?? env("OPENAI_PRICE_IN_PER_1M"), 0.15),
    priceOut: num(g(SETTING_KEYS.openaiPriceOut) ?? env("OPENAI_PRICE_OUT_PER_1M"), 0.6),
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  };
}

// Status seguro p/ exibir na página de config (sem vazar a chave).
export type OpenAISettingsView = {
  configured: boolean;
  masked: string | null; // ex.: "••••abcd"
  source: "banco" | "env" | "nenhuma";
  model: string;
  priceIn: number;
  priceOut: number;
};

export async function getOpenAISettingsView(): Promise<OpenAISettingsView> {
  const cfg = await getOpenAIConfig();
  const dbKey = await getSetting(SETTING_KEYS.openaiApiKey);
  const source = dbKey ? "banco" : process.env.OPENAI_API_KEY ? "env" : "nenhuma";
  return {
    configured: Boolean(cfg.apiKey),
    masked: cfg.apiKey ? `••••${cfg.apiKey.slice(-4)}` : null,
    source,
    model: cfg.model,
    priceIn: cfg.priceIn,
    priceOut: cfg.priceOut,
  };
}
