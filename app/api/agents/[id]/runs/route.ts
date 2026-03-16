import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/agents/[id]/runs — list all runs for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (agent.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await prisma.agentRun.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      triggerData: true,
      output: true,
      actionsLog: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ runs });
}
