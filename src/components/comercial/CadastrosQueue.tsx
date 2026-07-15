"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { fullLabel } from "@/lib/format";
import {
  SOLICITACAO_STATUS,
  solicitacaoStatusMeta,
  diasAtePrazo,
  isUrgenteEfetivo,
  type SolicitacaoStatus,
} from "@/lib/cadastros";
import type { SolicitacaoCadastro } from "@/generated/prisma";
import { changeStatusAction } from "@/app/(comercial)/comercial/cadastros/actions";

// "2h" / "3 dias" — duração entre duas datas (fim default = agora).
function duracao(inicio: Date | string, fim?: Date | string): string {
  const ms = (fim ? new Date(fim).getTime() : Date.now()) - new Date(inicio).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}min`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return `${dd} ${dd === 1 ? "dia" : "dias"}`;
}
const idade = (d: Date | string) => `há ${duracao(d)}`;

function valorLabel(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Badge do prazo: vermelho vencido, âmbar ≤2 dias, neutro no resto.
function prazoBadge(prazoAt: Date | string | null) {
  const dias = diasAtePrazo(prazoAt);
  if (dias === null) return null;
  const label =
    dias < 0
      ? `VENCIDO há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`
      : dias === 0
        ? "Sobe HOJE"
        : dias === 1
          ? "Sobe amanhã"
          : `Sobe em ${dias} dias`;
  const fg = dias < 0 ? "var(--st-risk)" : dias <= 2 ? "var(--pr-med)" : "var(--muted)";
  const bg = dias < 0 ? "var(--st-risk-bg)" : dias <= 2 ? "var(--pr-med-bg)" : "var(--surface-3)";
  return (
    <span className="badge" style={{ color: fg, background: bg, border: "none", fontWeight: 700 }}>
      <Icon name="clock" size={12} /> {label}
    </span>
  );
}

function Campo({ label, valor }: { label: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink)", wordBreak: "break-word" }}>{valor}</div>
    </div>
  );
}

export function CadastrosQueue({
  itens,
  ativo,
  counts,
}: {
  itens: SolicitacaoCadastro[];
  ativo: SolicitacaoStatus;
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (id: string, status: string) => {
    setErro(null);
    startTransition(async () => {
      const r = await changeStatusAction(id, status);
      if (r.error) setErro(r.error);
      router.refresh();
    });
  };

  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        {SOLICITACAO_STATUS.map((s) => (
          <Link key={s.id} href={`/comercial/cadastros?status=${s.id}`} className={ativo === s.id ? "on" : ""}>
            {s.label} ({counts[s.id] ?? 0})
          </Link>
        ))}
      </div>

      {erro && <div className="form-error" style={{ marginBottom: 12 }}>{erro}</div>}

      {itens.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Nenhuma solicitação em “{solicitacaoStatusMeta(ativo).label}” no momento.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {itens.map((s) => {
          const urgente = isUrgenteEfetivo(s);
          const expandido = aberto === s.id;
          return (
            <div
              key={s.id}
              className="card"
              style={{
                padding: 0,
                overflow: "hidden",
                borderLeft: `4px solid ${urgente ? "var(--st-risk)" : "var(--line)"}`,
              }}
            >
              <div
                onClick={() => setAberto(expandido ? null : s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  cursor: "pointer",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {s.nomeCompleto}
                    {urgente && (
                      <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)", border: "none", fontWeight: 800 }}>
                        <Icon name="alert" size={12} /> URGENTE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {s.cnpjCpf} · solicitado por <strong>{s.solicitante}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {prazoBadge(s.prazoAt)}
                  <span style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }} title={fullLabel(new Date(s.createdAt))}>
                    <Icon name="calendar" size={12} /> {fullLabel(new Date(s.createdAt))} · {idade(s.createdAt)}
                  </span>
                  <Icon name={expandido ? "chevDown" : "chevRight"} size={16} />
                </div>
              </div>

              {expandido && (
                <div style={{ borderTop: "1px solid var(--line)", padding: "16px", background: "var(--surface-2)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                    <Campo label="Solicitante" valor={s.solicitante} />
                    <Campo label="CPF/CNPJ" valor={s.cnpjCpf} />
                    <Campo label="RG" valor={s.rg} />
                    <Campo label="Inscrição Estadual" valor={s.inscricaoEstadual} />
                    <Campo label="Cidade" valor={s.cidade} />
                    <Campo label="Bairro" valor={s.bairro} />
                    <Campo label="Rua" valor={s.rua} />
                    <Campo label="CEP" valor={s.cep} />
                    <Campo label="Ponto de referência" valor={s.pontoReferencia} />
                    <Campo label="Telefone 1" valor={s.telefone1} />
                    <Campo label="Telefone 2" valor={s.telefone2} />
                    <Campo label="E-mail boletos" valor={s.emailBoletos} />
                    <Campo label="Vencimento" valor={s.vencimentoDia ? `Dia ${s.vencimentoDia}` : null} />
                    <Campo label="Plano" valor={s.plano} />
                    <Campo label="Valor" valor={s.valorCents ? valorLabel(s.valorCents) : null} />
                    <Campo label="Situação (form)" valor={s.situacao === "urgente" ? "Urgente" : "Normal"} />
                    <Campo label="Prazo pra subir" valor={s.prazoAt ? fullLabel(new Date(s.prazoAt)) : null} />
                    <Campo
                      label="Finalizado em"
                      valor={s.finalizadoAt ? `${fullLabel(new Date(s.finalizadoAt))} (${duracao(s.createdAt, s.finalizadoAt)} na fila)` : null}
                    />
                  </div>

                  {s.observacao && (
                    <div style={{ marginTop: 14 }}>
                      <Campo label="Observação" valor={s.observacao} />
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    {s.status !== "cadastrado" && (
                      <button className="btn btn-primary" disabled={pending} onClick={() => mudar(s.id, "cadastrado")}>
                        <Icon name="checkCircle" size={14} /> Marcar cadastrado
                      </button>
                    )}
                    {s.status !== "cancelado" && (
                      <button className="btn" disabled={pending} onClick={() => mudar(s.id, "cancelado")}>
                        <Icon name="trash" size={14} /> Cancelar
                      </button>
                    )}
                    {s.status !== "pendente" && (
                      <button className="btn" disabled={pending} onClick={() => mudar(s.id, "pendente")}>
                        <Icon name="clock" size={14} /> Reabrir (pendente)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
