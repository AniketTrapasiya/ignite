import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/agents/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      actions: { orderBy: { order: "asc" } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 20,
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
      },
      _count: { select: { runs: true } },
    },
  });

  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (agent.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ agent });
}

// PATCH /api/agents/[id] — update agent (name, description, status, prompt, actions)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    name?: string;
    description?: string;
    icon?: string;
    status?: string;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    promptTemplate?: string;
    actions?: Array<{ type: string; config: Record<string, unknown> }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // If actions are provided, replace them entirely
  if (body.actions !== undefined) {
    await prisma.agentAction.deleteMany({ where: { agentId: id } });
    if (body.actions.length > 0) {
      await prisma.agentAction.createMany({
        data: body.actions.map((a, idx) => ({
          agentId: id,
          type: a.type,
          config: a.config as object,
          order: idx,
        })),
      });
    }
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.status !== undefined && { status: body.status as "DRAFT" | "ACTIVE" | "PAUSED" }),
      ...(body.triggerType !== undefined && { triggerType: body.triggerType }),
      ...(body.triggerConfig !== undefined && { triggerConfig: body.triggerConfig as object }),
      ...(body.promptTemplate !== undefined && { promptTemplate: body.promptTemplate }),
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ agent });
}

// DELETE /api/agents/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.agent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
