// "Esqueci minha senha": geração/validação de token de reset. Server-only.
// Token cru vai só no link; no banco fica o SHA-256 (vazamento de DB não vira reset).
// Entrega: e-mail via Resend se RESEND_API_KEY+RESET_EMAIL_FROM configurados;
// senão o link sai no log do servidor (suficiente p/ time pequeno com acesso ao log).
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Gera e persiste um token de reset p/ o e-mail. Retorna o link ou null se o
// usuário não existir (quem chama NUNCA deve revelar isso ao cliente).
export async function createResetLink(email: string, baseUrl: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await db.user.update({
    where: { id: user.id },
    data: { resetTokenHash: hashResetToken(token), resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return `${baseUrl.replace(/\/$/, "")}/redefinir-senha?token=${token}`;
}

// Consome o token: acha o usuário com token válido (não expirado) ou null.
export async function findUserByResetToken(token: string) {
  if (!token || token.length < 20) return null;
  return db.user.findFirst({
    where: { resetTokenHash: hashResetToken(token), resetTokenExpiresAt: { gt: new Date() } },
    select: { id: true, email: true, name: true },
  });
}

// Entrega o link. Retorna como foi entregue ("email" | "log").
export async function deliverResetLink(email: string, link: string): Promise<"email" | "log"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM; // ex.: "OpenBoard <naoresponda@seudominio.com>"
  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "OpenBoard — redefinir senha",
        text: `Recebemos um pedido para redefinir sua senha no OpenBoard.\n\nAbra o link (válido por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`,
      }),
    });
    if (res.ok) return "email";
    console.error(`[reset-senha] falha ao enviar e-mail (${res.status}) — caindo pro log.`);
  }
  // Em produção NUNCA logar o link (contém o token de reset). Só avisa que a entrega
  // falhou — quem tem acesso ao log não pode sequestrar o reset. Em dev, loga p/ testar.
  if (process.env.NODE_ENV === "production") {
    console.error(`[reset-senha] entrega não configurada (Resend) — link de ${email} NÃO enviado. Configure RESEND_API_KEY/RESET_EMAIL_FROM.`);
  } else {
    console.log(`[reset-senha] link para ${email} (válido 1h): ${link}`);
  }
  return "log";
}
