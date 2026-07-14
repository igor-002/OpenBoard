// Classifica o referrer de um clique em origem legível pro relatório.
// Scan de QR / link digitado não manda referrer → "QR / direto" (é a origem
// esperada da panfletagem física).

const KNOWN: { label: string; match: RegExp }[] = [
  { label: "Instagram", match: /instagram\.com|l\.instagram/i },
  { label: "Facebook", match: /facebook\.com|fb\.me|l\.facebook|m\.facebook/i },
  { label: "WhatsApp", match: /whatsapp\.com|wa\.me/i },
  { label: "Google", match: /google\.[a-z.]+/i },
  { label: "TikTok", match: /tiktok\.com/i },
  { label: "YouTube", match: /youtube\.com|youtu\.be/i },
  { label: "X / Twitter", match: /twitter\.com|x\.com|t\.co/i },
  { label: "LinkedIn", match: /linkedin\.com|lnkd\.in/i },
  { label: "Telegram", match: /telegram\.(org|me)|t\.me/i },
];

export function classifyReferrer(referrer: string | null): string {
  if (!referrer) return "QR / direto";
  for (const k of KNOWN) if (k.match.test(referrer)) return k.label;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "outros";
  }
}
