import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLeadDetail } from "@/server/comercial/leads";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { brl, hourLabel, fullLabel } from "@/lib/format";
import { leadStageMeta } from "@/lib/leads";
import { LeadAnalise, type AnalisePontos, type AnaliseView } from "@/components/comercial/LeadAnalise";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const data = await getLeadDetail(id);
  if (!data) notFound();
  const { lead, mensagens, assignedUserName, historico } = data;
  const stage = leadStageMeta(lead.stage);
  // tempo no estágio atual = intervalo aberto do último evento (calculado no server)
  const naFilaMs = historico.length ? historico[historico.length - 1].durationMs : null;
  const diasNaFila = naFilaMs != null ? naFilaMs / 86_400_000 : 0;
  const fmtDur = (ms: number) => {
    const h = ms / 3_600_000;
    if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}min`;
    if (h < 48) return `${Math.round(h)}h`;
    return `${(h / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;
  };

  const analise: AnaliseView = {
    nota: lead.analiseNota,
    resumo: lead.analiseResumo,
    pontos: (lead.analisePontos as unknown as AnalisePontos) ?? null,
    modelo: lead.analiseModelo,
    tokensIn: lead.analiseTokensIn,
    tokensOut: lead.analiseTokensOut,
    custoUsdMicros: lead.analiseCustoUsdMicros,
    at: lead.analiseAt ? lead.analiseAt.toISOString() : null,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/comercial/leads" className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="chevLeft" size={14} /> Leads</Link>
          <h1 className="page-title">{lead.nome}</h1>
          <p className="page-sub">
            {lead.empresa ? `${lead.empresa} · ` : ""}<span style={{ color: stage.c, fontWeight: 700 }}>{stage.label}</span>
            {naFilaMs != null && (
              <span style={{ color: diasNaFila > 7 && lead.stage !== "ganho" && lead.stage !== "perdido" ? "var(--st-risk)" : "var(--muted)", fontWeight: 700 }}>
                {" "}· nesta fila há {fmtDur(naFilaMs)}
              </span>
            )}
            {lead.origem ? ` · origem ${lead.origem}` : ""}
            {lead.finalizadoAt && (
              <span className="badge" style={{ marginLeft: 8, color: "var(--st-done)", background: "var(--st-done-bg)", fontWeight: 700 }}>
                Atendimento finalizado · {fullLabel(new Date(lead.finalizadoAt))}
              </span>
            )}
          </p>
        </div>
        {lead.ixcClienteId && (
          <Link className="btn btn-ghost" href={`/comercial/clientes/${lead.ixcClienteId}`}>Ver cliente 360 <Icon name="chevRight" size={14} /></Link>
        )}
      </div>

      {/* Info do lead */}
      <Card title="Informações">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          <Field label="Contato">{lead.contato ?? "—"}</Field>
          <Field label="E-mail">{lead.email ?? "—"}</Field>
          <Field label="CNPJ / CPF">{lead.cnpjCpf ?? "—"}</Field>
          <Field label="Valor estimado">{lead.valorEstimadoCents > 0 ? <b>{brl(lead.valorEstimadoCents)}</b> : "—"}</Field>
          <Field label="Responsável">{assignedUserName ?? "—"}</Field>
          <Field label="Último contato">{fullLabel(new Date(lead.lastContactAt))} {hourLabel(new Date(lead.lastContactAt))}</Field>
        </div>
      </Card>

      {/* Histórico de filas (movimentações do funil) */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Histórico de filas" sub="Por onde o lead passou e quanto tempo ficou em cada estágio" pad>
          {historico.length === 0 ? (
            <div className="muted">Sem movimentações registradas ainda.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {historico.map((h, i) => {
                const to = leadStageMeta(h.toStage);
                const last = i === historico.length - 1;
                return (
                  <div key={h.id} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: to.c, border: "2px solid var(--surface)", boxShadow: `0 0 0 2px ${to.c}`, marginTop: 4, flexShrink: 0 }} />
                      {!last && <span style={{ width: 2, flex: 1, background: "var(--line)", minHeight: 18 }} />}
                    </div>
                    <div style={{ paddingBottom: last ? 0 : 16 }}>
                      <div className="row gap8" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
                        <b style={{ fontSize: 13.5, color: to.c }}>{h.fromStage === null ? `Entrou no funil (${to.label})` : `${leadStageMeta(h.fromStage).label} → ${to.label}`}</b>
                        <span className="muted" style={{ fontSize: 12 }}>{fullLabel(new Date(h.at))} {hourLabel(new Date(h.at))}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                        {h.durationMs != null && !last && `ficou ${fmtDur(h.durationMs)} nesta fila`}
                        {h.durationMs != null && last && lead.stage !== "ganho" && lead.stage !== "perdido" && `nesta fila há ${fmtDur(h.durationMs)}`}
                        {h.movedByName ? `${h.durationMs != null && (!last || (lead.stage !== "ganho" && lead.stage !== "perdido")) ? " · " : ""}movido por ${h.movedByName}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Conversa */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Conversa" sub={`${mensagens.length} mensagem(ns) do atendimento`} pad={false}>
          {mensagens.length === 0 ? (
            <div className="card-pad muted">Nenhuma mensagem registrada para este lead.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 18px 18px", maxHeight: 460, overflowY: "auto" }}>
              {mensagens.map((m) => (
                <div key={m.id} style={{ borderLeft: `3px solid ${m.mensagemBot ? "var(--primary)" : "var(--st-progress)"}`, paddingLeft: 12 }}>
                  <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m.remetente ?? "?"}{m.mensagemBot ? " (bot/IA)" : ""}</span>
                    <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{m.sentAt ? hourLabel(new Date(m.sentAt)) : ""}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", marginTop: 2 }}>{m.mensagem}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Análise IA */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Análise da IA" sub="Avaliação do atendimento (sob demanda)" pad={false}>
          <LeadAnalise leadId={lead.id} hasMensagens={mensagens.length > 0} analise={analise} />
        </Card>
      </div>
    </div>
  );
}
