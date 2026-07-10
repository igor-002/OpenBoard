import { resolveTvWorkspace, getTvData } from "@/server/tv";
import { validateTvAccess } from "@/lib/tv-auth";
import { TvBoard } from "@/components/tv/TvBoard";

export const dynamic = "force-dynamic";

// Mensagem centralizada no estilo kiosk (fundo escuro).
function TvMessage({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

// Painel de TV (kiosk). Requer ?key=TV_TOKEN — só leitura, sem sessão.
export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!(await validateTvAccess(key, "projetos"))) {
    return <TvMessage>Acesso negado.</TvMessage>;
  }

  const ws = await resolveTvWorkspace();
  if (!ws) {
    return <TvMessage>Nenhum workspace disponível.</TvMessage>;
  }

  const data = await getTvData(ws);
  return <TvBoard initial={data} tvKey={key!} />;
}
