import { requireTool } from "@/lib/permissions";
import { getAtividadesData } from "@/server/atividades";
import { AtividadesView } from "@/components/atividades/AtividadesView";

export default async function AtividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; tipo?: string; origem?: string; status?: string; cliente?: string; from?: string; to?: string }>;
}) {
  const user = await requireTool("gestao.atividades");
  const sp = await searchParams;

  const data = await getAtividadesData(user.workspaceId, {
    assigneeId: sp.assignee,
    tipoId: sp.tipo,
    origem: sp.origem,
    status: sp.status,
    clienteId: sp.cliente,
    from: sp.from,
    to: sp.to,
  });

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <AtividadesView data={data} />
    </div>
  );
}
