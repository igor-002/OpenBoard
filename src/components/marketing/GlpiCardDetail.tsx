"use client";

// Chamado do GLPI dentro do card do quadro: informações + histórico de conversas
// + caixa de acompanhamento. Antes o card GLPI abria só os campos internos do
// cartão e o contexto do chamado ficava a uma navegação de distância.
//
// Busca AO VIVO (o espelho não guarda descrição nem timeline) e só quando o card
// abre — não no carregamento do quadro, que teria de bater na API por card.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import { fullLabel, hourLabel } from "@/lib/format";
import { statusColors, PRIORITY_LABEL, initialsOf, colorForName } from "@/lib/glpi-format";
import { carregarChamadoAction } from "@/app/(marketing)/marketing/quadro/actions";
import { addFollowupAction } from "@/app/(marketing)/marketing/demandas/actions";
import type { TicketDetail } from "@/server/glpi/detail";

function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${fullLabel(d)} · ${hourLabel(d)}`;
}

function Av({ nome, size = 26 }: { nome: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: "50%",
        background: colorForName(nome),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 800,
      }}
    >
      {initialsOf(nome)}
    </span>
  );
}

export function GlpiCardDetail({ glpiId, onWrote }: { glpiId: number; onWrote: () => void }) {
  const [t, setT] = useState<TicketDetail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [privado, setPrivado] = useState(false);
  const [enviando, start] = useTransition();

  useEffect(() => {
    let vivo = true;
    void carregarChamadoAction(glpiId).then((d) => {
      if (!vivo) return;
      setT(d);
      setErro(!d);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [glpiId]);

  function enviar() {
    const corpo = texto.trim();
    if (!corpo) return;
    start(async () => {
      const r = await addFollowupAction(glpiId, corpo, privado);
      if (!r.ok) {
        emitToast({ variant: "error", title: "Falha ao comentar", sub: r.error });
        return;
      }
      setTexto("");
      emitToast({ variant: "success", title: `Acompanhamento enviado`, sub: `Chamado #${glpiId}` });
      // Relê pra a nova mensagem entrar na linha do tempo.
      const novo = await carregarChamadoAction(glpiId);
      if (novo) setT(novo);
      onWrote();
    });
  }

  if (carregando) {
    return (
      <div className="muted" style={{ fontSize: 12.5, padding: "14px 0" }}>
        <Icon name="clock" size={13} /> Carregando o chamado #{glpiId}…
      </div>
    );
  }
  if (erro || !t) {
    return (
      <div className="card card-pad muted" style={{ fontSize: 12.5, borderLeft: "3px solid var(--st-risk)" }}>
        Não deu pra carregar o chamado #{glpiId} no GLPI.
      </div>
    );
  }

  const sc = statusColors(t.statusId);
  const responsaveis = t.assignees ? t.assignees.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Cabeçalho do chamado */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "11px 13px" }}>
        <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap", marginBottom: 9 }}>
          <span className="muted" style={{ fontWeight: 800, fontSize: 12 }}>#{t.glpiId}</span>
          <span className="badge" style={{ color: sc.color, background: sc.bg }}>{t.statusName || "—"}</span>
          <span className="tag" style={{ fontSize: 10.5 }}>{PRIORITY_LABEL[t.priority] ?? "—"}</span>
          {t.categoryName && <span className="tag" style={{ fontSize: 10.5 }}>{t.categoryName}</span>}
          <Link
            href={`/marketing/demandas/${t.glpiId}`}
            className="btn btn-ghost"
            style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11.5 }}
          >
            Página completa <Icon name="chevRight" size={12} />
          </Link>
        </div>

        <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
          <span className="row gap8" style={{ alignItems: "center" }}>
            <Av nome={t.requesterName || "—"} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span className="muted" style={{ fontSize: 10 }}>Abriu</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.requesterName || "—"}</span>
            </span>
          </span>
          <Icon name="chevRight" size={14} />
          <span className="row gap8" style={{ alignItems: "center" }}>
            {responsaveis.length ? (
              <>
                {responsaveis.slice(0, 2).map((a) => <Av key={a} nome={a} />)}
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span className="muted" style={{ fontSize: 10 }}>Atende</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{responsaveis.join(", ")}</span>
                </span>
              </>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>Sem responsável</span>
            )}
          </span>
          <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>
            aberto em {quando(t.dateCreation)}
          </span>
        </div>
      </div>

      {/* Descrição do chamado (a do GLPI, não a nota interna do cartão) */}
      <div>
        <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
          Descrição no GLPI
        </div>
        {t.description ? (
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>{t.description}</p>
        ) : (
          <span className="muted" style={{ fontSize: 12.5 }}>Sem descrição.</span>
        )}
      </div>

      {/* Histórico de conversas */}
      <div>
        <div className="row between" style={{ marginBottom: 8 }}>
          <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Histórico
          </div>
          <span className="muted" style={{ fontSize: 10.5 }}>{t.timeline.length} interação(ões)</span>
        </div>
        {t.timeline.length === 0 ? (
          <div className="muted" style={{ fontSize: 12.5 }}>Nenhuma interação ainda.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            {t.timeline.map((e, i) => {
              const solucao = /solu/i.test(e.kind);
              return (
                <div
                  key={`${e.kind}-${e.id}-${i}`}
                  style={{
                    border: "1px solid var(--line)",
                    borderLeft: `3px solid ${solucao ? "var(--st-done)" : "var(--line-2)"}`,
                    background: solucao ? "var(--st-done-bg)" : "var(--surface-2)",
                    borderRadius: "var(--r-md)",
                    padding: "8px 11px",
                  }}
                >
                  <div className="row gap8" style={{ alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <Av nome={e.author || "—"} size={20} />
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{e.author || "—"}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{e.kind}</span>
                    {e.isPrivate && <span className="tag" style={{ fontSize: 10 }}>privado</span>}
                    <span className="muted" style={{ fontSize: 10.5, marginLeft: "auto" }}>{quando(e.date)}</span>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
                    {e.content || <span className="muted">—</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Responder */}
      <div>
        <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
          Novo acompanhamento
        </div>
        <textarea
          className="input"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma atualização para este chamado…"
          style={{ width: "100%", resize: "vertical" }}
        />
        <div className="row gap12" style={{ alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <label className="row gap8 muted" style={{ alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} /> privado
          </label>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={enviando || !texto.trim()} onClick={enviar}>
            <Icon name="msg" size={14} /> {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
