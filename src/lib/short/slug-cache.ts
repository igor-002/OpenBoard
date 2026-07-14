// Cache em memória do lookup de slug do redirect. Suficiente para 1 instância
// (deploy single-container — mesmo racional de rate-limit.ts). TTL curto +
// invalidação explícita nas actions que editam o link.

export type CachedLink = {
  id: string;
  destination: string;
  active: boolean;
  expiresAt: Date | null;
};

type Entry = { link: CachedLink | null; at: number };

const TTL_MS = 60 * 1000;
const store = new Map<string, Entry>();

export function cacheGet(slug: string): { hit: boolean; link: CachedLink | null } {
  const e = store.get(slug);
  if (!e || Date.now() - e.at > TTL_MS) return { hit: false, link: null };
  return { hit: true, link: e.link };
}

/** Também cacheia negativo (slug inexistente) — evita bater no banco em scan de slug errado. */
export function cacheSet(slug: string, link: CachedLink | null): void {
  store.set(slug, { link, at: Date.now() });
  // Poda simples pra não crescer sem limite com slugs aleatórios inválidos.
  if (store.size > 5000) {
    const cutoff = Date.now() - TTL_MS;
    for (const [k, v] of store) if (v.at < cutoff) store.delete(k);
  }
}

export function cacheInvalidate(slug: string): void {
  store.delete(slug);
}
