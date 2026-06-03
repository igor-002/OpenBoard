"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { hms } from "@/lib/format";
import { pauseTimer, resumeTimer, finishTimer } from "@/app/(app)/time/actions";
import type { ActiveTimer } from "@/server/time";

export function FloatingTimer({ timer }: { timer: ActiveTimer | null }) {
  const router = useRouter();
  // estado local p/ resposta instantânea (otimista); servidor sincroniza em background.
  const [local, setLocal] = useState<ActiveTimer | null>(timer);
  const [now, setNow] = useState(() => Date.now());

  // re-sincroniza quando o servidor manda novo estado (navegação/refresh).
  useEffect(() => {
    setLocal(timer);
  }, [timer]);

  const running = local?.status === "running";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!local) return null;

  const secs = local.durationSec + (running ? Math.max(0, Math.floor((now - local.startedMs) / 1000)) : 0);

  function doPause() {
    if (!local) return;
    setLocal({ ...local, status: "paused", durationSec: secs }); // congela na hora
    void pauseTimer(local.id).then(() => router.refresh());
  }
  function doResume() {
    if (!local) return;
    setLocal({ ...local, status: "running", startedMs: Date.now() }); // volta a contar
    void resumeTimer(local.id).then(() => router.refresh());
  }
  function doFinish() {
    if (!local) return;
    const id = local.id;
    setLocal(null); // some imediatamente
    void finishTimer(id).then(() => router.refresh());
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 22,
        bottom: 22,
        zIndex: 55,
        width: 290,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--sh-lg)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 4, background: running ? "var(--st-done)" : "var(--pr-med)" }} />
      <div style={{ padding: "14px 16px" }}>
        <div className="row gap8" style={{ marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: running ? "var(--st-done)" : "var(--pr-med)", animation: running ? "ob-pulse 1.2s ease-in-out infinite" : "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted)" }}>
            {running ? "Cronômetro rodando" : "Pausado"}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-1px", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {hms(secs)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{local.taskTitle}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{local.projectName}</div>

        <div className="row gap8" style={{ marginTop: 12 }}>
          {running ? (
            <button className="btn" style={{ flex: 1, justifyContent: "center", padding: "8px 0" }} onClick={doPause}>
              <Icon name="pause" size={15} />Pausar
            </button>
          ) : (
            <button className="btn" style={{ flex: 1, justifyContent: "center", padding: "8px 0" }} onClick={doResume}>
              <Icon name="play" size={15} />Retomar
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center", padding: "8px 0" }} onClick={doFinish}>
            <Icon name="check" size={15} />Finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
