"use client";

// Hook padrão pra qualquer botão de sincronização: mostra o tempo decorrido AO
// VIVO (pra ninguém ficar chapando sem saber se terminou) e dispara toasts de
// iniciado / concluído / erro. Centraliza o comportamento de todos os syncs.
import { useEffect, useRef, useState, useTransition } from "react";
import { emitToast } from "./toast";

type SyncResult = { ok?: boolean; error?: string };

export function useSyncRun(
  action: () => Promise<SyncResult>,
  opts: { label: string; onSuccess?: () => void },
): { run: () => void; pending: boolean; elapsed: number } {
  const [pending, start] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(0);

  // Tick do cronômetro enquanto o sync roda (a cada 250ms, mostra em segundos).
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - t0.current) / 1000))), 250);
    return () => clearInterval(id);
  }, [pending]);

  function run() {
    t0.current = Date.now();
    setElapsed(0);
    emitToast({ variant: "info", title: `${opts.label} iniciada…` });
    start(async () => {
      let r: SyncResult;
      try {
        r = await action();
      } catch (e) {
        r = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const secs = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
      if (r.ok) {
        emitToast({ variant: "success", title: `${opts.label} concluída`, sub: `em ${secs}s` });
        opts.onSuccess?.();
      } else {
        emitToast({ variant: "error", title: `${opts.label} falhou`, sub: r.error });
      }
    });
  }

  return { run, pending, elapsed };
}
