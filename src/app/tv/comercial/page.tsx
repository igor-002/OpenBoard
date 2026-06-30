import { getComercialTvData } from "@/server/comercial/tv";
import { ComercialTvBoard } from "@/components/comercial/ComercialTvBoard";

export const dynamic = "force-dynamic";

// Painel de TV comercial (kiosk). Herda o layout/CSS de /tv e é público (proxy
// libera o prefixo /tv). Acesso livre, só leitura — mesmo padrão do /tv.
export default async function ComercialTvPage() {
  const data = await getComercialTvData();
  return <ComercialTvBoard initial={data} />;
}
