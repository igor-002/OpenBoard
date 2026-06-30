"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { runSyncAction } from "@/app/(comercial)/comercial/sync/actions";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function trigger() {
    setMsg(null);
    start(async () => {
      const r = await runSyncAction();
      setMsg(r.ok ? { ok: true, text: "Sincronização concluída." } : { ok: false, text: r.error || "Falha no sync." });
    });
  }

  return (
    <div className="row gap12" style={{ alignItems: "center" }}>
      <button className="btn btn-primary" onClick={trigger} disabled={pending}>
        <Icon name="zap" size={15} /> {pending ? "Sincronizando…" : "Sincronizar agora"}
      </button>
      {msg && (
        <span style={{ color: msg.ok ? "var(--st-done)" : "var(--st-risk)", fontWeight: 600 }}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
