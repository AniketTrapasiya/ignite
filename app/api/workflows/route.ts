import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workflows — list user's workflows
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await prisma.workflow.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      triggerType: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { executions: true } },
    },
  });

  return NextResponse.json({ workflows });
}

// POST /api/workflows — create a new workflow
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; description?: string; nodes?: unknown; edges?: unknown; triggerType?: string; triggerConfig?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, nodes = [], edges = [], triggerType = "manual", triggerConfig = {} } = body;

  if (!name?.toString().trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId: user.userId,
      name: name.toString().trim(),
      description: description?.toString().trim(),
      nodes: nodes as never,
      edges: edges as never,
      triggerType,
      triggerConfig: triggerConfig as never,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ workflow }, { status: 201 });
}
