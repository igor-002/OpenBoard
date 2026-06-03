"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export type PasswordState = { ok?: boolean; error?: string };

const schema = z
  .object({
    current: z.string().min(1, "Informe a senha atual"),
    next: z.string().min(8, "Nova senha precisa de ao menos 8 caracteres"),
    confirm: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.next === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ok = await verifyPassword(parsed.data.current, user.passwordHash);
  if (!ok) return { error: "Senha atual incorreta." };
  if (parsed.data.next === parsed.data.current) return { error: "A nova senha deve ser diferente da atual." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  return { ok: true };
}

// ---------- 1º acesso: trocar senha sugerida ----------
const initialSchema = z
  .object({
    next: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
    confirm: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.next === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

// Define nova senha no 1º acesso (já autenticado, não pede a atual) e limpa a flag.
export async function setMyPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = initialSchema.safeParse({ next: formData.get("next"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  return { ok: true };
}

// "Agora não": só limpa a flag pra não perguntar de novo.
export async function skipPasswordChange(): Promise<void> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
}
