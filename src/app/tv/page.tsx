import { resolveTvWorkspace, getTvData } from "@/server/tv";
import { TvBoard } from "@/components/tv/TvBoard";

export const dynamic = "force-dynamic";

// Painel de TV (kiosk). Acesso por token: /tv?key=SEGREDO. Sem login, só leitura.
export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const ws = await resolveTvWorkspace(key);

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
        Acesso negado · token inválido ou ausente.
      </div>
    );
  }

  const data = await getTvData(ws);
  return <TvBoard initial={data} tvKey={key!} />;
}
