"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Atualiza os dados do server component atual em intervalo fixo, via router.refresh().
// Usado em telas que mudam por fora (sync IXC, ingest de leads do chat) e que ficam
// abertas num monitor. Pausa quando a aba não está visível pra não gastar à toa.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const ms = Math.max(15, seconds) * 1000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
