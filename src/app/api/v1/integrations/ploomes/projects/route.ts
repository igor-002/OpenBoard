import { NextResponse } from "next/server";
import { INTEGRATION_AUTH_ERROR, integrationAuthError } from "@/lib/integration-auth";
import { IntegrationError, createPloomesProject, ploomesProjectSchema } from "@/server/integrations/ploomes-projects";
import { resolveIntegrationWorkspace } from "@/server/integrations/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = integrationAuthError(request);
  if (authError) return NextResponse.json({ error: INTEGRATION_AUTH_ERROR[authError] }, { status: authError });

  const workspace = await resolveIntegrationWorkspace();
  if (!workspace.ok) return NextResponse.json({ error: workspace.code }, { status: workspace.status });
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
    const result = await createPloomesProject(workspace.workspaceId, parsed.data, request.headers.get("idempotency-key")!.trim());
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof IntegrationError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
