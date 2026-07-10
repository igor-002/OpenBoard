import Link from "next/link";
import { requireModule } from "@/lib/permissions";
import { getMargem } from "@/server/comercial/queries";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { brl } from "@/lib/format";

export default async function MargemPage() {
  const user = await requireModule("margem"); // dado sensível: gate extra além do comercial
  const { rows, semCusto } = await getMargem(user.workspaceId);

  const totReceita = rows.reduce((a, r) => a + r.mrrAtivoCents, 0);
  const totCusto = rows.reduce((a, r) => a + r.custoCents, 0);
  const totMargem = totReceita - totCusto;
  const totHoras = rows.reduce((a, r) => a + r.horas, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Margem real</h1>
          <p className="page-sub">MRR mensal do cliente × custo das horas apontadas no projeto — só projetos vinculados a um cliente IXC</p>
        </div>
      </div>

      {semCusto && (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--pr-med)" }}>
          <span style={{ color: "var(--pr-med)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>Custo/hora não definido</div>
            <div className="muted">Defina o custo/hora de cada pessoa em <Link href="/settings/users">Usuários</Link> para o cálculo de custo ficar real. Até lá, o custo aparece como R$ 0.</div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card card-pad muted" style={{ marginTop: "var(--gap)" }}>
          Nenhum projeto vinculado a cliente. Vincule projetos a clientes na visão <Link href="/comercial/clientes">Clientes (360)</Link>.
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginTop: "var(--gap)" }}>
            <StatCard icon="wallet" label="Receita (MRR/mês)" value={brl(totReceita)} foot="clientes vinculados" accent="var(--st-done)" />
            <StatCard icon="clock" label="Custo de horas" value={brl(totCusto)} foot={`${totHoras.toFixed(1)}h apontadas`} accent="var(--st-review)" />
            <StatCard icon="trendUp" label="Margem" value={brl(totMargem)} foot="receita − custo" accent={totMargem >= 0 ? "var(--st-done)" : "var(--st-risk)"} />
            <StatCard icon="layers" label="Projetos" value={rows.length} foot="com vínculo" accent="var(--primary)" />
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            <Card title="Margem por projeto" sub="Ordenado por margem" pad={false}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Projeto</th>
                    <th style={{ textAlign: "left" }}>Cliente</th>
                    <th style={{ textAlign: "right" }}>MRR/mês</th>
                    <th style={{ textAlign: "right" }}>Horas</th>
                    <th style={{ textAlign: "right" }}>Custo</th>
                    <th style={{ textAlign: "right" }}>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.projectId}>
                      <td><Link href={`/projects/${r.projectId}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{r.projectName}</Link></td>
                      <td className="muted">{r.clienteNome}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(r.mrrAtivoCents)}</td>
                      <td style={{ textAlign: "right" }} className="muted">{r.horas.toFixed(1)}h</td>
                      <td style={{ textAlign: "right" }}>{brl(r.custoCents)}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: r.margemCents >= 0 ? "var(--st-done)" : "var(--st-risk)" }}>{brl(r.margemCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
