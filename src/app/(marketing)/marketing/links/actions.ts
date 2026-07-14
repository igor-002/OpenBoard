"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModuleUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { randomSlug, validateCustomSlug } from "@/lib/short/slug";
import { normalizeWaPhone, validateWaPhone, buildWaUrl } from "@/lib/short/wa";
import { cacheInvalidate } from "@/lib/short/slug-cache";

export type LinkActionState = { ok?: boolean; error?: string; id?: string };

// Acesso compartilhado do módulo Marketing (User.modules "marketing") —
// mesmo modelo das contas Instagram: todos com o módulo veem/editam tudo.

const linkInputSchema = z.object({
  title: z.string().trim().max(120).default(""),
  kind: z.enum(["url", "whatsapp"]),
  destination: z.string().trim().max(2000).default(""),
  waPhone: z.string().trim().max(30).default(""),
  waMessage: z.string().trim().max(1000).default(""),
  customSlug: z.string().trim().max(32).default(""),
  campaignId: z.string().trim().default(""),
  tags: z.string().trim().max(300).default(""),
  expiresAt: z.string().trim().default(""), // "YYYY-MM-DD" ou vazio
});
export type LinkInput = z.input<typeof linkInputSchema>;

type Resolved = {
  title: string;
  kind: "url" | "whatsapp";
  destination: string;
  waPhone: string | null;
  waMessage: string | null;
  campaignId: string | null;
  tags: string;
  expiresAt: Date | null;
};

// Valida e materializa o destino (WhatsApp vira wa.me com a mensagem encodada).
function resolveInput(raw: LinkInput): { ok: true; data: Resolved } | { ok: false; error: string } {
  const parsed = linkInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const d = parsed.data;

  let destination: string;
  let waPhone: string | null = null;
  let waMessage: string | null = null;

  if (d.kind === "whatsapp") {
    const digits = normalizeWaPhone(d.waPhone);
    const phoneErr = validateWaPhone(digits);
    if (phoneErr) return { ok: false, error: phoneErr };
    waPhone = digits;
    waMessage = d.waMessage || null;
    destination = buildWaUrl(digits, d.waMessage);
  } else {
    if (!/^https?:\/\/\S+$/i.test(d.destination)) {
      return { ok: false, error: "Destino inválido — informe uma URL http(s) completa." };
    }
    destination = d.destination;
  }

  let expiresAt: Date | null = null;
  if (d.expiresAt) {
    // Fim do dia local — o link vale durante a data escolhida inteira.
    const date = new Date(`${d.expiresAt}T23:59:59`);
    if (isNaN(date.getTime())) return { ok: false, error: "Data de expiração inválida." };
    expiresAt = date;
  }

  const tags = d.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .join(",");

  return {
    ok: true,
    data: {
      title: d.title,
      kind: d.kind,
      destination,
      waPhone,
      waMessage,
      campaignId: d.campaignId || null,
      tags,
      expiresAt,
    },
  };
}

function refresh() {
  revalidatePath("/marketing/links");
}

export async function createLinkAction(raw: LinkInput): Promise<LinkActionState> {
  const user = await requireModuleUser("marketing");
  const r = resolveInput(raw);
  if (!r.ok) return { ok: false, error: r.error };

  const custom = (raw.customSlug ?? "").trim();
  if (custom) {
    const slugErr = validateCustomSlug(custom);
    if (slugErr) return { ok: false, error: slugErr };
    const exists = await db.shortLink.findUnique({ where: { slug: custom } });
    if (exists) return { ok: false, error: "Esse slug já está em uso." };
  }

  // Slug aleatório: retry em colisão (P2002), 6 chars → cai pra 7 na última.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = custom || randomSlug(attempt < 3 ? 6 : 7);
    try {
      const link = await db.shortLink.create({
        data: { ...r.data, slug, createdById: user.id },
        select: { id: true },
      });
      refresh();
      return { ok: true, id: link.id };
    } catch (e) {
      const isUnique = typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
      if (!isUnique || custom) return { ok: false, error: "Esse slug já está em uso." };
    }
  }
  return { ok: false, error: "Não foi possível gerar um slug único — tente de novo." };
}

export async function updateLinkAction(id: string, raw: LinkInput): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  const r = resolveInput(raw);
  if (!r.ok) return { ok: false, error: r.error };
  const current = await db.shortLink.findUnique({ where: { id }, select: { slug: true } });
  if (!current) return { ok: false, error: "Link não encontrado." };
  await db.shortLink.update({ where: { id }, data: r.data });
  cacheInvalidate(current.slug);
  refresh();
  return { ok: true, id };
}

export async function toggleLinkAction(id: string): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  const link = await db.shortLink.findUnique({ where: { id }, select: { slug: true, active: true } });
  if (!link) return { ok: false, error: "Link não encontrado." };
  await db.shortLink.update({ where: { id }, data: { active: !link.active } });
  cacheInvalidate(link.slug);
  refresh();
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  const link = await db.shortLink.findUnique({ where: { id }, select: { slug: true } });
  if (!link) return { ok: false, error: "Link não encontrado." };
  // Cascade apaga os cliques junto — deliberado (histórico morre com o link).
  await db.shortLink.delete({ where: { id } });
  cacheInvalidate(link.slug);
  refresh();
  return { ok: true };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO_DATA_URI = 64 * 1024; // logo pequena basta — vai embutida no SVG do QR

export async function saveQrOptionsAction(
  id: string,
  opts: { qrColor: string; qrBgColor: string; qrLogo: string | null },
): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  if (!HEX_RE.test(opts.qrColor) || !HEX_RE.test(opts.qrBgColor)) {
    return { ok: false, error: "Cor inválida." };
  }
  if (opts.qrLogo) {
    if (!opts.qrLogo.startsWith("data:image/")) return { ok: false, error: "Logo inválida." };
    if (opts.qrLogo.length > MAX_LOGO_DATA_URI) {
      return { ok: false, error: "Logo muito grande — use uma imagem de até ~48KB." };
    }
  }
  await db.shortLink.update({
    where: { id },
    data: { qrColor: opts.qrColor, qrBgColor: opts.qrBgColor, qrLogo: opts.qrLogo },
  });
  refresh();
  return { ok: true };
}

export async function createCampaignAction(name: string): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nome obrigatório." };
  const exists = await db.linkCampaign.findUnique({ where: { name: trimmed } });
  if (exists) return { ok: false, error: "Já existe uma campanha com esse nome." };
  await db.linkCampaign.create({ data: { name: trimmed } });
  revalidatePath("/marketing/links/campanhas");
  refresh();
  return { ok: true };
}

export async function renameCampaignAction(id: string, name: string): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nome obrigatório." };
  const exists = await db.linkCampaign.findUnique({ where: { name: trimmed } });
  if (exists && exists.id !== id) return { ok: false, error: "Já existe uma campanha com esse nome." };
  await db.linkCampaign.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/marketing/links/campanhas");
  refresh();
  return { ok: true };
}

export async function deleteCampaignAction(id: string): Promise<LinkActionState> {
  await requireModuleUser("marketing");
  // SetNull: os links da campanha ficam sem campanha, não são apagados.
  await db.linkCampaign.delete({ where: { id } });
  revalidatePath("/marketing/links/campanhas");
  refresh();
  return { ok: true };
}
