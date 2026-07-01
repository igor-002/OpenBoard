"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { setSettings, SETTING_KEYS } from "@/server/settings";

export type ConfigActionState = { ok?: boolean; error?: string };

// Salva as configs da OpenAI (admin). Chave em branco = mantém a atual.
export async function saveOpenAISettings(_prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  await requireAdmin();

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const priceIn = String(formData.get("priceIn") ?? "").trim();
  const priceOut = String(formData.get("priceOut") ?? "").trim();

  if (apiKey && !/^sk-/.test(apiKey)) return { error: "A chave da OpenAI normalmente começa com 'sk-'." };
  if ((priceIn && isNaN(Number(priceIn))) || (priceOut && isNaN(Number(priceOut)))) {
    return { error: "Preços devem ser números (USD por 1M tokens)." };
  }

  await setSettings({
    [SETTING_KEYS.openaiApiKey]: apiKey,     // vazio → não sobrescreve
    [SETTING_KEYS.openaiModel]: model,
    [SETTING_KEYS.openaiPriceIn]: priceIn,
    [SETTING_KEYS.openaiPriceOut]: priceOut,
  });

  revalidatePath("/comercial/config");
  return { ok: true };
}
