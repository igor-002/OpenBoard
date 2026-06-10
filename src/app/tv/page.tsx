import { resolveTvWorkspace, getTvData } from "@/server/tv";
import { TvBoard } from "@/components/tv/TvBoard";

export const dynamic = "force-dynamic";

// Painel de TV (kiosk). Acesso livre em /tv, sem login e sem token — só leitura.
export default async function TvPage() {
  const ws = await resolveTvWorkspace();

  if (!ws) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1020",
          color: "#94a3b8",
          fontFamily: "var(--font-display, system-ui)",
          fontSize: 18,
        }}
      >
        Nenhum workspace disponível.
      </div>
    );
  }

  const data = await getTvData(ws);
  return <TvBoard initial={data} />;
}
