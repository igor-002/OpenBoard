"use server";

import { headers } from "next/headers";
import { requireModuleUser } from "@/lib/permissions";
import { signTvToken, type TvScope } from "@/lib/tv-auth";

// Gera um link de TV (kiosk) assinado, escopo projetos|comercial, validade 90 dias.
// Só quem tem o módulo correspondente pode gerar. Retorna URL absoluta p/ abrir/copiar
// na TV. Sem segredo fixo: o token expira sozinho.
export async function criarLinkTv(scope: TvScope): Promise<{ url: string }> {
  await requireModuleUser(scope === "comercial" ? "comercial" : "gestao");
  const token = await signTvToken(scope);

  const h = await headers();
  const basePath = process.env.BASE_PATH ?? "";
  // APP_URL (prod) já inclui o basePath; em dev cai no host da request.
  const origin = process.env.APP_URL || `http://${h.get("host") ?? "localhost:3000"}${basePath}`;
  const path = scope === "comercial" ? "/tv/comercial" : "/tv";
  return { url: `${origin}${path}?key=${encodeURIComponent(token)}` };
}
