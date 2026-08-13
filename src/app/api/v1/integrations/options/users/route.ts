import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INTEGRATION_AUTH_ERROR, integrationAuthError, integrationWorkspaceId } from "@/lib/integration-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = integrationAuthError(request);
  if (authError) return NextResponse.json({ error: INTEGRATION_AUTH_ERROR[authError] }, { status: authError });
  const workspaceId = integrationWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "integration_unavailable" }, { status: 500 });

  const users = await db.user.findMany({
    where: { workspaceId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, jobTitle: true },
  });
  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}
