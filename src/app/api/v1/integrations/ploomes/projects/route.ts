import { NextResponse } from "next/server";
import { INTEGRATION_AUTH_ERROR, integrationAuthError, integrationWorkspaceId } from "@/lib/integration-auth";
import { IntegrationError, createPloomesProject, ploomesProjectSchema } from "@/server/integrations/ploomes-projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = integrationAuthError(request);
  if (authError) return NextResponse.json({ error: INTEGRATION_AUTH_ERROR[authError] }, { status: authError });

  const workspaceId = integrationWorkspaceId();
  if (!workspaceId) return NextResponse.json({ error: "integration_unavailable" }, { status: 500 });
  if (!request.headers.get("idempotency-key")?.trim()) {
    return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ploomesProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  try {
    const result = await createPloomesProject(workspaceId, parsed.data, request.headers.get("idempotency-key")!.trim());
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof IntegrationError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
