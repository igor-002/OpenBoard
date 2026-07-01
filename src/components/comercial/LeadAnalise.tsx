"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { analisarLead } from "@/app/(comercial)/comercial/leads/actions";

export type Criterio = { nome: string; nota: number; comentario: string };
export type AnalisePontos = { fortes: string[]; aMelhorar: string[]; proximoPasso: string; criterios?: Criterio[]; risco?: string | null };
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
  const [elapsed, setElapsed] = useState(0);
  const [ok, setOk] = useState<{ secs: number } | null>(null);
  const t0 = useRef(0);
  const temAnalise = analise.nota != null;

  // cronômetro enquanto roda
  useEffect(() => {
    if (!pending) return;
    t0.current = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed((Date.now() - t0.current) / 1000), 100);
    return () => clearInterval(iv);
  }, [pending]);

  // some com o banner de sucesso depois de 5s
  useEffect(() => {
    if (!ok) return;
    const to = setTimeout(() => setOk(null), 5000);
    return () => clearTimeout(to);
  }, [ok]);

  function run() {
    setError(null);
    setOk(null);
    const started = Date.now();
    start(async () => {
      const r = await analisarLead(leadId);
      const secs = (Date.now() - started) / 1000;
      if (r.error) setError(r.error);
      else {
        setOk({ secs });
        router.refresh();
      }
    });
  }

  const botao = (
    <button className="btn btn-primary" onClick={run} disabled={pending || !hasMensagens}>
      <Icon name={pending ? "clock" : "zap"} size={15} className={pending ? "spin" : undefined} />{" "}
      {pending ? `Analisando… ${elapsed.toFixed(1)}s` : temAnalise ? "Reanalisar" : "Analisar conversa"}
    </button>
  );

  const banner = (
    <>
      {error && (
        <div className="form-error" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={15} /> {error}
        </div>
      )}
      {ok && !error && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--st-done)", background: "var(--st-done-bg)", padding: "8px 12px", borderRadius: "var(--r-md)" }}>
          <Icon name="checkCircle" size={15} /> Análise concluída em {ok.secs.toFixed(1)}s
        </div>
      )}
    </>
  );

  if (!temAnalise) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          {hasMensagens ? "Ainda não analisada. Rode a IA para avaliar o atendimento." : "Sem mensagens da conversa para analisar."}
        </p>
        {botao}
        {banner}
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
            <div className="muted" style={{ fontSize: 12 }}>de 0 a 10{pontos.risco ? " · risco de perder o lead:" : ""}</div>
          </div>
          {pontos.risco && <RiscoBadge risco={pontos.risco} />}
        </div>
        <div className="row gap8" style={{ alignItems: "center" }}>{botao}</div>
      </div>

      {analise.resumo && (
        <p style={{ padding: "0 18px 14px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{analise.resumo}</p>
      )}

      {pontos.criterios && pontos.criterios.length > 0 && (
        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8, color: "var(--muted)" }}>Avaliação por critério</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pontos.criterios.map((c, i) => {
              const t = notaTone(c.nota);
              return (
                <div key={i} title={c.comentario}>
                  <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: t.c }}>{c.nota}<span className="muted" style={{ fontWeight: 500 }}>/10</span></span>
                  </div>
                  <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 999, marginTop: 3, overflow: "hidden" }}>
                    <div style={{ width: `${c.nota * 10}%`, height: "100%", background: t.c }} />
                  </div>
                  {c.comentario && <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{c.comentario}</div>}
                </div>
              );
            })}
          </div>
        </div>
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
      <div style={{ padding: "0 18px" }}>{banner}</div>
    </div>
  );
}

function RiscoBadge({ risco }: { risco: string }) {
  const map: Record<string, { c: string; bg: string; label: string }> = {
    baixo: { c: "var(--st-done)", bg: "var(--st-done-bg)", label: "Risco baixo" },
    medio: { c: "var(--pr-med)", bg: "var(--pr-med-bg)", label: "Risco médio" },
    alto: { c: "var(--st-risk)", bg: "var(--st-risk-bg)", label: "Risco alto" },
  };
  const m = map[risco] ?? map.medio;
  return <span className="badge" style={{ color: m.c, background: m.bg, fontWeight: 700 }}>{m.label}</span>;
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
