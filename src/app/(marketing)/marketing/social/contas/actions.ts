"use server";

import { revalidatePath } from "next/cache";
import { requireModuleUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fetchProfile, InstagramApiError } from "@/lib/marketing/instagram-client";
import { encryptToken } from "@/lib/marketing/token-crypto";
import { syncInstagramAccounts } from "@/server/marketing/instagram-sync";

export type MarketingActionState = { ok?: boolean; error?: string };

// Acesso ao módulo Marketing é controlado por User.modules ("marketing").
// requireModuleUser garante sessão + permissão em toda ação.

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCompanyAction(name: string): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nome obrigatório." };
  const slug = slugify(trimmed);
  if (!slug || slug === "todas") return { ok: false, error: "Nome inválido — gera um slug reservado." };
  const exists = await db.marketingCompany.findUnique({ where: { slug } });
  if (exists) return { ok: false, error: "Já existe uma empresa com esse nome." };
  await db.marketingCompany.create({ data: { name: trimmed, slug } });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

export async function deleteCompanyAction(id: string): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  await db.marketingCompany.delete({ where: { id } });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

export async function createAccountAction(
  companyId: string,
  username: string,
  displayName: string,
): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  const uname = username.trim().replace(/^@/, "");
  const dname = displayName.trim() || uname;
  if (!uname) return { ok: false, error: "Usuário obrigatório." };
  const exists = await db.instagramAccount.findUnique({ where: { username: uname } });
  if (exists) return { ok: false, error: "Já existe uma conta com esse usuário." };
  await db.instagramAccount.create({
    data: { companyId, username: uname, displayName: dname },
  });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

export async function deleteAccountAction(id: string): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  await db.instagramAccount.delete({ where: { id } });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

export async function setAccountActiveAction(id: string, active: boolean): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  await db.instagramAccount.update({ where: { id }, data: { active } });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

// Token de longa duração (~60 dias, variante "Login do Instagram"). Valida
// contra a API antes de gravar — evita salvar token quebrado/expirado.
const LONG_LIVED_TOKEN_DAYS = 60;

export async function connectAccountTokenAction(
  id: string,
  accessToken: string,
): Promise<MarketingActionState & { usernameMismatch?: string }> {
  await requireModuleUser("marketing");
  const token = accessToken.trim();
  if (!token) return { ok: false, error: "Token obrigatório." };
  let usernameMismatch: string | undefined;
  try {
    const profile = await fetchProfile(token);
    const account = await db.instagramAccount.findUniqueOrThrow({ where: { id } });
    // O token pertence a uma conta real da Meta — o username cadastrado pode
    // divergir (erro de digitação, conta renomeada). Não bloqueia a conexão,
    // só avisa: quem corrige o cadastro é o admin (botão "Renomear").
    if (profile.username !== account.username) usernameMismatch = profile.username;
    await db.instagramAccount.update({
      where: { id },
      data: {
        igUserId: profile.igUserId,
        accessToken: encryptToken(token),
        tokenExpiresAt: new Date(Date.now() + LONG_LIVED_TOKEN_DAYS * 86400000),
      },
    });
  } catch (e) {
    const msg = e instanceof InstagramApiError ? e.message : "Token inválido ou API indisponível.";
    return { ok: false, error: msg };
  }
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true, usernameMismatch };
}

export async function renameAccountAction(id: string, username: string): Promise<MarketingActionState> {
  await requireModuleUser("marketing");
  const uname = username.trim().replace(/^@/, "");
  if (!uname) return { ok: false, error: "Usuário obrigatório." };
  const exists = await db.instagramAccount.findUnique({ where: { username: uname } });
  if (exists && exists.id !== id) return { ok: false, error: "Já existe uma conta com esse usuário." };
  await db.instagramAccount.update({ where: { id }, data: { username: uname } });
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social");
  return { ok: true };
}

export async function runManualMarketingSyncAction(): Promise<
  MarketingActionState & { resultados?: { username: string; status: string; erro?: string }[] }
> {
  await requireModuleUser("marketing");
  const resultados = await syncInstagramAccounts();
  revalidatePath("/marketing/social/contas");
  revalidatePath("/marketing/social", "layout");
  return { ok: true, resultados };
}
