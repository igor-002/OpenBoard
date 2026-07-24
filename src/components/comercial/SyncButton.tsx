"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useSyncRun } from "@/lib/useSyncRun";
import { runSyncAction } from "@/app/(comercial)/comercial/sync/actions";

export function SyncButton() {
  const router = useRouter();
  const { run, pending, elapsed } = useSyncRun(runSyncAction, {
    label: "Sincronização",
    onSuccess: () => router.refresh(), // reflete histórico + dashboards sem reload
  });

  return (
    <div className="row gap12" style={{ alignItems: "center" }}>
      <button className="btn btn-primary" onClick={run} disabled={pending}>
        <Icon name="zap" size={15} /> {pending ? `Sincronizando… ${elapsed}s` : "Sincronizar agora"}
      </button>
    </div>
  );
}
