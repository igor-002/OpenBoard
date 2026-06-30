import { requireUser } from "@/lib/auth";
import { getRecentSyncRuns, ixcConfigured } from "@/server/comercial/queries";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SyncButton } from "@/components/comercial/SyncButton";
import { fullLabel, hourLabel } from "@/lib/format";

export default async function SyncPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [runs, configured] = await Promise.all([
    getRecentSyncRuns(),
    Promise.resolve(ixcConfigured()),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Sincronização</h1>
          <p className="page-sub">Puxa vendedores, contratos e MRR do IXC pro espelho local.</p>
        </div>
        {isAdmin && configured && <SyncButton />}
      </div>

      {!configured && (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--st-risk)" }}>
          <span style={{ color: "var(--st-risk)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>IXC não configurado</div>
            <div className="muted">Defina <code>IXC_TOKEN</code> / <code>IXC_PROXY_URL</code>. Veja <code>IXC_INTEGRATION_HANDOFF.md</code>.</div>
          </div>
        </div>
      )}
      {configured && !isAdmin && (
        <div className="muted" style={{ marginBottom: "var(--gap)" }}>Apenas administradores podem disparar o sync.</div>
      )}

      <Card title="Histórico" sub="Últimas execuções" pad={false}>
        {runs.length === 0 ? (
          <div className="card-pad muted">Nenhuma execução ainda.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Quando</th>
                <th style={{ textAlign: "left" }}>Tipo</th>
                <th style={{ textAlign: "right" }}>Registros</th>
                <th style={{ textAlign: "right" }}>Erros</th>
                <th style={{ textAlign: "right" }}>Duração</th>
                <th style={{ textAlign: "left" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{fullLabel(new Date(r.startedAt))} {hourLabel(new Date(r.startedAt))}</td>
                  <td>{r.kind}</td>
                  <td style={{ textAlign: "right" }}>{r.processed}</td>
                  <td style={{ textAlign: "right" }}>{r.errors}</td>
                  <td style={{ textAlign: "right" }}>{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td style={{ color: r.fatalError ? "var(--st-risk)" : r.finishedAt ? "var(--st-done)" : "var(--muted)" }}>
                    {r.fatalError ? "Falhou" : r.finishedAt ? "OK" : "Rodando…"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
