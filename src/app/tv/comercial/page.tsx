import { getComercialTvData } from "@/server/comercial/tv";
import { validateTvAccess } from "@/lib/tv-auth";
import { ComercialTvBoard } from "@/components/comercial/ComercialTvBoard";

export const dynamic = "force-dynamic";

// Painel de TV comercial (kiosk). Requer ?key=TV_TOKEN — só leitura, mesmo padrão do /tv.
export default async function ComercialTvPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!(await validateTvAccess(key, "comercial"))) {
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
        Acesso negado.
      </div>
    );
  }

  const data = await getComercialTvData();
  return <ComercialTvBoard initial={data} tvKey={key!} />;
}
