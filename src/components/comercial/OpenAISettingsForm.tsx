"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { saveOpenAISettings, type ConfigActionState } from "@/app/(comercial)/comercial/config/actions";
import type { OpenAISettingsView } from "@/server/settings";

export function OpenAISettingsForm({ view }: { view: OpenAISettingsView }) {
  const [state, formAction, pending] = useActionState<ConfigActionState, FormData>(saveOpenAISettings, {});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  const statusColor = view.configured ? "var(--st-done)" : "var(--st-risk)";
  const statusBg = view.configured ? "var(--st-done-bg)" : "var(--st-risk-bg)";

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: statusBg, color: statusColor, borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 700 }}>
        <Icon name={view.configured ? "checkCircle" : "alert"} size={16} />
        {view.configured ? `Chave configurada (${view.masked}) · fonte: ${view.source}` : "Nenhuma chave configurada — a análise IA fica indisponível."}
      </div>

      <div className="field">
        <label htmlFor="apiKey">Chave da OpenAI</label>
        <input className="input" id="apiKey" name="apiKey" type="password" autoComplete="off"
          placeholder={view.configured ? "Deixe em branco para manter a atual" : "sk-..."} />
        <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>Fica salva no banco (server-only), nunca aparece no navegador. Comece com <code>sk-</code>.</span>
      </div>

      <div className="row gap12">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="model">Modelo</label>
          <input className="input" id="model" name="model" defaultValue={view.model} placeholder="gpt-4o-mini" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="priceIn">US$ / 1M entrada</label>
          <input className="input" id="priceIn" name="priceIn" defaultValue={String(view.priceIn)} inputMode="decimal" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="priceOut">US$ / 1M saída</label>
          <input className="input" id="priceOut" name="priceOut" defaultValue={String(view.priceOut)} inputMode="decimal" />
        </div>
      </div>

      {state.error && <div className="form-error"><Icon name="alert" size={14} /> {state.error}</div>}
      {saved && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--st-done)" }}>
          <Icon name="checkCircle" size={15} /> Configurações salvas.
        </div>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          <Icon name="check" size={15} /> {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
