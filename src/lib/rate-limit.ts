// Rate limit simples em memória (janela deslizante + bloqueio temporário).
// Suficiente para 1 instância (deploy single-container). Para múltiplas instâncias,
// trocar por um store compartilhado (ex.: Redis).

type Entry = { count: number; first: number; blockedUntil?: number };

const store = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000; // janela de contagem
const MAX_FAILS = 5; // falhas permitidas na janela
const BLOCK_MS = 15 * 60 * 1000; // tempo de bloqueio após estourar

export function checkRateLimit(key: string): { ok: boolean; retryAfterSec?: number } {
  const e = store.get(key);
  const now = Date.now();
  if (e?.blockedUntil && e.blockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((e.blockedUntil - now) / 1000) };
  }
  return { ok: true };
}

export function registerFailure(key: string): void {
  const now = Date.now();
  let e = store.get(key);
  if (!e || now - e.first > WINDOW_MS) e = { count: 0, first: now };
  e.count += 1;
  if (e.count >= MAX_FAILS) e.blockedUntil = now + BLOCK_MS;
  store.set(key, e);
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}
