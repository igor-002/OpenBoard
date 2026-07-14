// Montagem da URL de WhatsApp com mensagem pronta (wa.me).

/** Mantém só dígitos (remove +, espaços, hífens, parênteses). */
export function normalizeWaPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function validateWaPhone(digits: string): string | null {
  // DDI + DDD + número: BR fica 12-13 dígitos, mas aceita internacional (10-15).
  if (!/^\d{10,15}$/.test(digits)) {
    return "Número inválido — informe DDI + DDD + número, só dígitos (ex.: 5511999998888).";
  }
  return null;
}

/** wa.me abre conversa com a mensagem pré-preenchida. */
export function buildWaUrl(phoneDigits: string, message: string): string {
  const msg = message.trim();
  return msg
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${phoneDigits}`;
}
