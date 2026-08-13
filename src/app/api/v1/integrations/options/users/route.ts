import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INTEGRATION_AUTH_ERROR, integrationAuthError } from "@/lib/integration-auth";
import { resolveIntegrationWorkspace } from "@/server/integrations/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = integrationAuthError(request);
  if (authError) return NextResponse.json({ error: INTEGRATION_AUTH_ERROR[authError] }, { status: authError });
  const workspace = await resolveIntegrationWorkspace();
  if (!workspace.ok) return NextResponse.json({ error: workspace.code }, { status: workspace.status });

  const users = await db.user.findMany({
    where: { workspaceId: workspace.workspaceId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, jobTitle: true },
  });
  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}
