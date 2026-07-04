import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCliente360 } from "@/server/comercial/queries";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { STATUS_LABEL } from "@/lib/ixc";
import { brl, dayLabel } from "@/lib/format";
import { OnboardingButton, LinkProjectForm, UnlinkButton, CobrancaForm } from "@/components/comercial/Cliente360Actions";

const PROJ_STATUS: Record<string, { label: string; c: string }> = {
  progress: { label: "Em andamento", c: "var(--st-progress)" },
  review: { label: "Em revisão", c: "var(--st-review)" },
  done: { label: "Concluído", c: "var(--st-done)" },
  planned: { label: "Planejado", c: "var(--pr-med)" },
};

function statusTone(s: string): { c: string; bg: string } {
  if (s === "A") return { c: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (s === "AA" || s === "P") return { c: "var(--st-progress)", bg: "var(--st-progress-bg)" };
  if (["C", "CN", "CA", "N", "FA"].includes(s)) return { c: "var(--st-risk)", bg: "var(--st-risk-bg)" };
  return { c: "var(--pr-med)", bg: "var(--pr-med-bg)" };
}

export default async function Cliente360Page({ params }: { params: Promise<{ ixcId: string }> }) {
  const { ixcId } = await params;
  const user = await requireUser();
  const data = await getCliente360(ixcId, user.workspaceId);
  if (!data.cliente) notFound();
  const { cliente, contratos, mrrAtivoCents, projetos, projetosDisponiveis, horasTotal } = data;
  const ativos = contratos.filter((c) => c.status === "A").length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/comercial/clientes" className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="chevLeft" size={14} /> Clientes</Link>
          <h1 className="page-title">{cliente.razao}</h1>
          <p className="page-sub">
            {cliente.cnpjCpf ? `${cliente.cnpjCpf} · ` : ""}{cliente.uf ?? ""} · cliente IXC #{cliente.ixcId}
          </p>
        </div>
        {projetos.length === 0 && <OnboardingButton clienteIxcId={cliente.ixcId} />}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatCard icon="wallet" label="MRR ativo" value={brl(mrrAtivoCents)} foot="contratos ativos" accent="var(--st-done)" />
        <StatCard icon="briefcase" label="Contratos" value={contratos.length} foot={`${ativos} ativos`} accent="var(--primary)" />
        <StatCard icon="layers" label="Projetos OpenBoard" value={projetos.length} foot="vinculados" accent="var(--st-progress)" />
        <StatCard icon="clock" label="Horas de projeto" value={horasTotal > 0 ? `${horasTotal.toLocaleString("pt-BR")}h` : "—"} foot={mrrAtivoCents > 0 && horasTotal > 0 ? `${brl(Math.round(mrrAtivoCents / horasTotal))}/h de MRR` : "esforço investido no cliente"} accent="var(--st-review)" />
      </div>

      {/* Contratos IXC */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Contratos (IXC)" sub="Espelho local — fonte de verdade é o IXC" pad={false}>
          {contratos.length === 0 ? (
            <div className="card-pad muted">Sem contratos.</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Contrato</th>
                  <th style={{ textAlign: "left" }}>Vendedor</th>
                  <th style={{ textAlign: "left" }}>Cadastro</th>
                  <th style={{ textAlign: "right" }}>MRR</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => {
                  const tone = statusTone(c.status);
                  return (
                    <tr key={c.ixcId}>
                      <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>#{c.ixcId}</td>
                      <td>{c.vendedorNome ?? "—"}</td>
                      <td className="muted">{c.dataCadastro ? dayLabel(new Date(c.dataCadastro)) : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{c.mrrCents ? brl(c.mrrCents) : "—"}</td>
                      <td><span className="badge" style={{ color: tone.c, background: tone.bg }}>{STATUS_LABEL[c.status] ?? c.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Projetos OpenBoard vinculados */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Card
          title="Projetos OpenBoard"
          sub="Entregas ligadas a este cliente"
          action={<LinkProjectForm clienteIxcId={cliente.ixcId} projetos={projetosDisponiveis} />}
          pad={false}
        >
          {projetos.length === 0 ? (
            <div className="card-pad muted">Nenhum projeto vinculado. Crie a implantação ou vincule um projeto existente acima.</div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {projetos.map((p) => {
                const st = PROJ_STATUS[p.status] ?? { label: p.status, c: "var(--muted)" };
                return (
                  <div key={p.id} style={{ padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
                    <div className="row gap12" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/projects/${p.id}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{p.name}</Link>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: st.c, fontWeight: 700 }}>{st.label}</span> · {p.progress}% · {p.tasksDone}/{p.tasksTotal} tarefas{p.horas > 0 ? ` · ${p.horas.toLocaleString("pt-BR")}h logadas` : ""}{p.dueDate ? ` · prazo ${dayLabel(new Date(p.dueDate))}` : ""}
                        </div>
                      </div>
                      <div className="row gap8" style={{ alignItems: "center" }}>
                        <Link className="btn btn-ghost" href={`/projects/${p.id}`}>Abrir <Icon name="chevRight" size={14} /></Link>
                        <UnlinkButton projectId={p.id} />
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <CobrancaForm projectId={p.id} tituloSugerido={`Cobrança / retenção — ${cliente.razao}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
