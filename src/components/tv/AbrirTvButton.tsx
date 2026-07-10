"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { useOverlayClose } from "@/components/ui/useOverlayClose";
import { criarLinkTv } from "@/app/tv/actions";
import type { TvScope } from "@/lib/tv-auth";

// Botão "Abrir TV": gera um link assinado (90 dias) e mostra num modal p/ abrir
// agora ou copiar e colar no aparelho de TV. Aparece só pra quem tem o módulo.
export function AbrirTvButton({ scope, label = "Abrir TV" }: { scope: TvScope; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    setErr(null);
    start(async () => {
      try {
        const r = await criarLinkTv(scope);
        setUrl(r.url);
      } catch {
        setErr("Não foi possível gerar o link.");
      }
    });
  }

  return (
    <>
      <button className="btn" onClick={gerar} disabled={pending} title="Abrir painel de TV">
        <Icon name="grid" size={16} />
        {pending ? "Gerando…" : label}
      </button>
      {err && <span className="form-error" style={{ marginLeft: 8 }}>{err}</span>}
      {url && <LinkModal url={url} onClose={() => setUrl(null)} />}
    </>
  );
}

function LinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard bloqueado — usuário copia manualmente do campo */
    }
  }

  return (
    <div {...useOverlayClose(onClose)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 520, padding: 24, boxShadow: "var(--sh-lg)" }}>
        <h3 className="card-title" style={{ fontSize: 18, marginBottom: 8 }}>Link do painel de TV</h3>
        <p className="page-sub" style={{ margin: "0 0 16px" }}>
          Válido por 90 dias. Abra agora ou copie e cole no navegador da TV. Qualquer pessoa com
          o link vê o painel — não publique. Gere um novo quando quiser invalidar o antigo.
        </p>
        <div className="field">
          <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "monospace", fontSize: 12 }} />
        </div>
        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn" onClick={copiar}>{copiado ? "Copiado!" : "Copiar link"}</button>
          <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer" onClick={onClose}>Abrir TV agora</a>
        </div>
      </div>
    </div>
  );
}
