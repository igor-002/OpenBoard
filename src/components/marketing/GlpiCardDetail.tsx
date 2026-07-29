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
      {/* Identidade do chamado. Faixa colorida pelo status à esquerda: dá o estado
          num relance, sem precisar ler o badge. */}
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderLeft: `3px solid ${sc.color}`,
          borderRadius: "var(--r-md)",
          padding: "12px 14px",
        }}
      >
        <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap", marginBottom: 11 }}>
          <span className="muted" style={{ fontWeight: 800, fontSize: 12 }}>#{t.glpiId}</span>
          <span className="badge" style={{ color: sc.color, background: sc.bg }}>{t.statusName || "—"}</span>
          <span className="tag" style={{ fontSize: 10.5 }}>{PRIORITY_LABEL[t.priority] ?? "—"}</span>
          {t.categoryName && <span className="tag" style={{ fontSize: 10.5 }}>{t.categoryName}</span>}
          <Link
            href={`/marketing/demandas/${t.glpiId}`}
            className="btn btn-ghost"
            style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11.5 }}
          >
            Abrir página <Icon name="chevRight" size={12} />
          </Link>
        </div>

        <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 10 }}>
          <span className="row gap8" style={{ alignItems: "center" }}>
            <Av nome={t.requesterName || "—"} size={28} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>PEDIU</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t.requesterName || "—"}</span>
            </span>
          </span>
          <span className="muted"><Icon name="chevRight" size={15} /></span>
          <span className="row gap8" style={{ alignItems: "center" }}>
            {responsaveis.length ? (
              <>
                {responsaveis.slice(0, 2).map((a) => <Av key={a} nome={a} size={28} />)}
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                  <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>FAZ</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{responsaveis.join(", ")}</span>
                </span>
              </>
            ) : (
              <span className="muted" style={{ fontSize: 12.5 }}>Ninguém atribuído</span>
            )}
          </span>
          <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>
            aberto em {quando(t.dateCreation)}
          </span>
        </div>
      </div>

      {/* CONVERSA — um painel só, do primeiro texto até a caixa de resposta.
          A descrição do chamado entra como a mensagem de abertura porque é
          exatamente isso: o que o solicitante escreveu quando abriu. Separá-la
          numa seção própria deixava duas caixas soltas e encurtava o histórico. */}
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}>
        <div
          className="row between"
          style={{ alignItems: "center", padding: "9px 13px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 800 }}>Conversa</span>
          <span className="muted" style={{ fontSize: 11 }}>
            {t.timeline.length + (t.description ? 1 : 0)} mensagem(ns)
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, maxHeight: 420, minHeight: 200, overflowY: "auto" }}>
          {t.description && (
            <Mensagem
              autor={t.requesterName || "—"}
              data={t.dateCreation}
              texto={t.description}
              etiqueta="abertura"
              destaque="abertura"
            />
          )}

          {t.timeline.map((e, i) => (
            <Mensagem
              key={`${e.kind}-${e.id}-${i}`}
              autor={e.author || "—"}
              data={e.date}
              texto={e.content}
              etiqueta={e.kind}
              privado={e.isPrivate}
              destaque={/solu/i.test(e.kind) ? "solucao" : "normal"}
            />
          ))}

          {!t.description && t.timeline.length === 0 && (
            <div className="muted" style={{ fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>
              Nada escrito neste chamado ainda.
            </div>
          )}
        </div>

        {/* Composer ancorado no fim da conversa, como num chat. */}
        <div style={{ borderTop: "1px solid var(--line)", padding: 12, background: "var(--surface-2)" }}>
          <textarea
            className="input"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Responder neste chamado…"
            style={{ width: "100%", resize: "vertical", fontSize: 13 }}
          />
          <div className="row gap12" style={{ alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <label className="row gap8 muted" style={{ alignItems: "center", fontSize: 12 }}>
              <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} /> só para a equipe
            </label>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={enviando || !texto.trim()} onClick={enviar}>
              <Icon name="msg" size={14} /> {enviando ? "Enviando…" : "Responder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Uma mensagem da conversa. `destaque` muda só a faixa lateral: abertura marca de
// onde a demanda partiu, solução marca onde ela terminou — o meio fica neutro pra
// esses dois se enxergarem numa rolagem longa.
function Mensagem({
  autor,
  data,
  texto,
  etiqueta,
  privado,
  destaque,
}: {
  autor: string;
  data: string | null;
  texto: string;
  etiqueta: string;
  privado?: boolean;
  destaque: "abertura" | "solucao" | "normal";
}) {
  const faixa =
    destaque === "solucao" ? "var(--st-done)" : destaque === "abertura" ? "var(--primary)" : "transparent";
  const fundo = destaque === "solucao" ? "var(--st-done-bg)" : "var(--surface-2)";

  return (
    <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
      <Av nome={autor} size={30} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: fundo,
          border: "1px solid var(--line)",
          borderLeft: destaque === "normal" ? "1px solid var(--line)" : `3px solid ${faixa}`,
          borderRadius: "var(--r-md)",
          padding: "10px 13px",
        }}
      >
        <div className="row gap8" style={{ alignItems: "baseline", flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{autor}</span>
          <span className="muted" style={{ fontSize: 11 }}>{etiqueta}</span>
          {privado && <span className="tag" style={{ fontSize: 10 }}>só equipe</span>}
          <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>{quando(data)}</span>
        </div>
        <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)" }}>
          {texto || <span className="muted">—</span>}
        </p>
      </div>
    </div>
  );
}
