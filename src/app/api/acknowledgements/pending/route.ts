import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPendingTaskAcknowledgements } from "@/server/task-acknowledgements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await getPendingTaskAcknowledgements(user.id);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
