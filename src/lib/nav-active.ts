// Item ativo da sidebar: o href MAIS específico que casa o pathname.
// startsWith puro acende pai e filho juntos quando um item é subrota do outro
// (ex.: /marketing/links e /marketing/links/relatorios) — o match mais longo
// vence, e subrotas sem item próprio (/marketing/links/abc123) continuam
// acendendo o pai.
export function activeNavHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}
