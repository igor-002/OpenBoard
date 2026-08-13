import "server-only";
import { db } from "@/lib/db";
import { integrationWorkspaceId } from "@/lib/integration-auth";

// Resolve o workspace da integração e confirma que ele existe de verdade.
//
// Sem esta checagem, um INTEGRATION_WORKSPACE_ID errado (o nome do workspace no
// lugar do id, o id de outro ambiente) devolvia `200` com lista vazia — que
// parece "workspace sem categorias" e esconde erro de configuração. Erro de
// deploy tem que aparecer como erro.
export async function resolveIntegrationWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; status: 500; code: string }
> {
  const workspaceId = integrationWorkspaceId();
  if (!workspaceId) return { ok: false, status: 500, code: "integration_unavailable" };

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) {
    console.error(
      `[integracoes] INTEGRATION_WORKSPACE_ID="${workspaceId}" nao existe. ` +
        `Use o id do workspace (coluna "id" da tabela Workspace), nao o nome.`,
    );
    return { ok: false, status: 500, code: "integration_workspace_not_found" };
  }
  return { ok: true, workspaceId: workspace.id };
}
