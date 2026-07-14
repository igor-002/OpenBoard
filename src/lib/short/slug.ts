// Geração/validação de slug do encurtador. Base62 sem caracteres ambíguos
// (0/O/o, 1/l/I) — QR impresso às vezes é digitado à mão.
import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

export function randomSlug(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

// Slugs que colidem com rotas/páginas do segmento /r.
export const RESERVED_SLUGS = new Set(["indisponivel"]);

const CUSTOM_SLUG_RE = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateCustomSlug(slug: string): string | null {
  if (!CUSTOM_SLUG_RE.test(slug)) {
    return "Slug inválido — use 3 a 32 caracteres (letras, números, - ou _).";
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return "Esse slug é reservado.";
  return null;
}
