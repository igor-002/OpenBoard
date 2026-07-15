"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSetting, setSettings, SETTING_KEYS } from "@/server/settings";

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

// Salva quem recebe as notificações de solicitação de cadastro (toast + sino).
// Lista vazia = "[]" explícito → o backend cai no fallback (todos os admins).
export async function saveCadastroNotifySettings(_prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  await requireAdmin();

  const ids = formData.getAll("userIds").map(String).filter(Boolean);
  // só aceita ids de usuários reais (form pode ser adulterado no client)
  const validos = ids.length
    ? (await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((u) => u.id)
    : [];

  // setSetting direto: setSettings ignora string "vazia", e "[]" precisa persistir.
  await setSetting(SETTING_KEYS.cadastroNotifyUserIds, JSON.stringify(validos));

  revalidatePath("/comercial/config");
  return { ok: true };
}
