import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runAgent } from "@/lib/agent-runner";

export const maxDuration = 60;

// POST /api/agents/[id]/run — manually trigger an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let triggerData: Record<string, unknown> = {};
  try {
    const body = await request.json().catch(() => ({}));
    triggerData = (body?.triggerData as Record<string, unknown>) ?? {};
  } catch {
    // no body — that's fine for manual triggers
  }

  try {
    const result = await runAgent(id, user.userId, triggerData);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Agent not found") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
