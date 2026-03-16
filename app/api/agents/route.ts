import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/agents — list agents for current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = await prisma.agent.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    include: {
      actions: { orderBy: { order: "asc" } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, createdAt: true },
      },
      _count: { select: { runs: true } },
    },
  });

  return NextResponse.json({ agents });
}

// POST /api/agents — create a new agent
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    description?: string;
    icon?: string;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    promptTemplate?: string;
    actions?: Array<{ type: string; config: Record<string, unknown> }>;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const agent = await prisma.agent.create({
    data: {
      userId: user.userId,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      icon: body.icon ?? "🤖",
      triggerType: body.triggerType ?? "manual",
      triggerConfig: (body.triggerConfig ?? {}) as object,
      promptTemplate: body.promptTemplate ?? "",
      status: (body.status as "DRAFT" | "ACTIVE" | "PAUSED") ?? "ACTIVE",
      actions: body.actions?.length
        ? {
          create: body.actions.map((a, idx) => ({
            type: a.type,
            config: a.config as object,
            order: idx,
          })),
        }
        : undefined,
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ agent }, { status: 201 });
}
