import { requireUser } from "@/lib/auth";
import { getGlpiReport, glpiConfigured, type StatusFilter } from "@/server/glpi/queries";
import { getTrackedUsers } from "@/server/glpi/users";
import { Icon } from "@/components/ui/Icon";
import { GlpiDemandas } from "@/components/marketing/GlpiDemandas";
import { NovaDemanda } from "@/components/marketing/NovaDemanda";

const VALID_STATUS: StatusFilter[] = ["abertos", "pendentes", "solucionados", "fechados", "todos"];

export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; status?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const requesterId = sp.user ? Number(sp.user) : null;
  const status = (VALID_STATUS.includes(sp.status as StatusFilter) ? sp.status : "abertos") as StatusFilter;
  const configured = glpiConfigured();

  const [report, trackedUsers] = configured
    ? await Promise.all([
        getGlpiReport({ requesterId: Number.isInteger(requesterId) ? requesterId : null, status }),
        getTrackedUsers(),
      ])
    : [null, []];
  const glpiBase = (process.env.GLPI_URL ?? "").replace(/\/$/, "");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Demandas (GLPI)</h1>
          <p className="page-sub">
            Chamados abertos pela equipe de marketing no GLPI. Monitoramento de demandas e projetos,
            sincronizado automaticamente.
          </p>
        </div>
        {configured && trackedUsers.length > 0 && <NovaDemanda trackedUsers={trackedUsers} />}
      </div>

      {!configured ? (
        <div className="card card-pad" style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: "3px solid var(--st-risk)" }}>
          <span style={{ color: "var(--st-risk)" }}><Icon name="alert" /></span>
          <div>
            <div style={{ fontWeight: 800 }}>GLPI não configurado</div>
            <div className="muted">
              Defina <code>GLPI_URL</code>, <code>GLPI_CLIENT_ID</code>, <code>GLPI_CLIENT_SECRET</code>,{" "}
              <code>GLPI_USERNAME</code>, <code>GLPI_PASSWORD</code> e <code>GLPI_TRACKED_USER_IDS</code>.
              Veja <code>glpi-api-v2-integracao.md</code>.
            </div>
          </div>
        </div>
      ) : (
        <GlpiDemandas
          report={report!}
          requesterId={Number.isInteger(requesterId) ? requesterId : null}
          status={status}
          glpiBase={glpiBase}
          isAdmin={user.role === "admin"}
        />
      )}
    </div>
  );
}
