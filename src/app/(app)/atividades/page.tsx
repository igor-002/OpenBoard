import { requireModule } from "@/lib/permissions";
import { getAtividadesData } from "@/server/atividades";
import { AtividadesView } from "@/components/atividades/AtividadesView";
import type { TaskColumn, TaskOrigin } from "@/lib/types";

export default async function AtividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; tipo?: string; origem?: string; status?: string; cliente?: string; from?: string; to?: string }>;
}) {
  const user = await requireModule("gestao");
  const sp = await searchParams;

  const data = await getAtividadesData(user.workspaceId, {
    assigneeId: sp.assignee,
    tipoId: sp.tipo,
    origem: sp.origem as TaskOrigin | undefined,
    column: sp.status as TaskColumn | undefined,
    clienteId: sp.cliente,
    from: sp.from,
    to: sp.to,
  });

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <AtividadesView
        data={data}
        currentUser={{ id: user.id, name: user.name, initials: user.initials, color: user.color }}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
