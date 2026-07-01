"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { analisarLead } from "@/app/(comercial)/comercial/leads/actions";

export type AnalisePontos = { fortes: string[]; aMelhorar: string[]; proximoPasso: string };
export type AnaliseView = {
  nota: number | null;
  resumo: string | null;
  pontos: AnalisePontos | null;
  modelo: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  custoUsdMicros: number | null;
  at: string | null; // ISO
};

function usd(micros: number): string {
  return (micros / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
}

function notaTone(n: number): { c: string; bg: string } {
  if (n >= 8) return { c: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (n >= 5) return { c: "var(--pr-med)", bg: "var(--pr-med-bg)" };
  return { c: "var(--st-risk)", bg: "var(--st-risk-bg)" };
}

export function LeadAnalise({ leadId, hasMensagens, analise }: { leadId: string; hasMensagens: boolean; analise: AnaliseView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const temAnalise = analise.nota != null;

  function run() {
    setError(null);
    start(async () => {
      const r = await analisarLead(leadId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const botao = (
    <button className="btn btn-primary" onClick={run} disabled={pending || !hasMensagens}>
      <Icon name="zap" size={15} /> {pending ? "Analisando…" : temAnalise ? "Reanalisar" : "Analisar conversa"}
    </button>
  );

  if (!temAnalise) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          {hasMensagens ? "Ainda não analisada. Rode a IA para avaliar o atendimento." : "Sem mensagens da conversa para analisar."}
        </p>
        {botao}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  const tone = notaTone(analise.nota!);
  const pontos = analise.pontos ?? { fortes: [], aMelhorar: [], proximoPasso: "" };

  return (
    <div style={{ padding: "4px 0" }}>
      <div className="row between" style={{ alignItems: "center", padding: "4px 18px 14px", flexWrap: "wrap", gap: 12 }}>
        <div className="row gap12" style={{ alignItems: "center" }}>
          <span style={{ width: 56, height: 56, borderRadius: "var(--r-md)", background: tone.bg, color: tone.c, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 24 }}>
            {analise.nota}
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Nota do atendimento</div>
            <div className="muted" style={{ fontSize: 12 }}>de 0 a 10</div>
          </div>
        </div>
        <div className="row gap8" style={{ alignItems: "center" }}>{botao}</div>
      </div>

      {analise.resumo && (
        <p style={{ padding: "0 18px 14px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{analise.resumo}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 18px" }}>
        <PontoList titulo="Pontos fortes" cor="var(--st-done)" itens={pontos.fortes} />
        <PontoList titulo="A melhorar" cor="var(--st-risk)" itens={pontos.aMelhorar} />
      </div>

      {pontos.proximoPasso && (
        <div style={{ margin: "14px 18px 0", padding: 12, background: "var(--surface-3)", borderRadius: "var(--r-md)" }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: "var(--muted)" }}>Próximo passo</div>
          <div style={{ fontSize: 13.5 }}>{pontos.proximoPasso}</div>
        </div>
      )}

      <div className="muted" style={{ fontSize: 11.5, padding: "14px 18px 4px", borderTop: "1px solid var(--line)", marginTop: 14 }}>
        {analise.modelo} · {analise.tokensIn ?? 0} tokens entrada · {analise.tokensOut ?? 0} saída · custo {analise.custoUsdMicros != null ? usd(analise.custoUsdMicros) : "—"}
        {analise.at ? ` · ${new Date(analise.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
      </div>
      {error && <div className="form-error" style={{ margin: "8px 18px 0" }}>{error}</div>}
    </div>
  );
}

function PontoList({ titulo, cor, itens }: { titulo: string; cor: string; itens: string[] }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8, color: cor }}>{titulo}</div>
      {itens.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {itens.map((it, i) => <li key={i} style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>{it}</li>)}
        </ul>
      ) : (
        <div className="muted" style={{ fontSize: 12.5 }}>—</div>
      )}
    </div>
  );
}
