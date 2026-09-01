// Cache em memória para dados de referência de APIs externas (listas do GLPI).
// Motivação: as telas do marketing são `force-dynamic` e cada carga refazia as
// mesmas chamadas ao GLPI — 2 GETs idênticos de usuários mais 3 roundtrips só
// para listar categorias. Nada disso muda de minuto a minuto.
//
// Três comportamentos que importam aqui:
//  - single-flight: cargas simultâneas compartilham a MESMA promise, então o
//    par getTrackedUsers/getAssignableUsers vira uma chamada só de verdade.
//  - stale-while-revalidate: passado o TTL, devolve o valor velho na hora e
//    revalida em segundo plano — quem carrega a página nunca espera a renovação.
//  - falha não invalida: se o GLPI cair, seguimos servindo o último valor bom em
//    vez de derrubar a tela inteira por causa de um <select>.
//
// Escopo é o processo (globalThis sobrevive ao HMR do dev). Com mais de uma
// instância cada uma teria seu cache — aceitável para lista de opção.
import "server-only";

type Entry<T> = {
  value?: T;
  expiresAt: number;
  inflight?: Promise<T>;
};

const store: Map<string, Entry<unknown>> =
  (globalThis as { __ttlCache?: Map<string, Entry<unknown>> }).__ttlCache ??
  ((globalThis as { __ttlCache?: Map<string, Entry<unknown>> }).__ttlCache = new Map());

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = (store.get(key) as Entry<T> | undefined) ?? { expiresAt: 0 };
  store.set(key, entry as Entry<unknown>);

  const fresco = entry.value !== undefined && Date.now() < entry.expiresAt;
  if (fresco) return entry.value as T;

  // Já tem alguém buscando: velho serve na hora, sem valor ainda espera a mesma promise.
  if (entry.inflight) return entry.value !== undefined ? (entry.value as T) : entry.inflight;

  const p = fn()
    .then((v) => {
      entry.value = v;
      entry.expiresAt = Date.now() + ttlMs;
      return v;
    })
    .finally(() => {
      entry.inflight = undefined;
    });
  entry.inflight = p;

  // Valor velho na mão → devolve já e deixa a revalidação correr sozinha.
  if (entry.value !== undefined) {
    p.catch(() => {}); // erro na revalidação só mantém o valor velho
    return entry.value as T;
  }
  return p;
}

// Invalida uma chave (usar depois de escrever algo que muda a lista).
export function invalidate(key: string): void {
  store.delete(key);
}
