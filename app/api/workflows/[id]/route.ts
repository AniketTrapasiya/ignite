import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeWorkflow } from "@/lib/workflow-executor";

type Params = { params: Promise<{ id: string }> };

// GET /api/workflows/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.userId },
    include: {
      executions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, status: true, trigger: true, output: true, error: true, createdAt: true, completedAt: true },
      },
    },
  });

  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workflow });
}

// PUT /api/workflows/[id] — update name, description, nodes, edges, status, triggerType, triggerConfig
export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowedFields = ["name", "description", "nodes", "edges", "status", "triggerType", "triggerConfig"];
  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) data[key] = body[key];
  }

  const workflow = await prisma.workflow.updateMany({
    where: { id, userId: user.userId },
    data: data as never,
  });

  if (workflow.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/workflows/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await prisma.workflow.deleteMany({
    where: { id, userId: user.userId },
  });

  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// POST /api/workflows/[id]/execute — trigger manual execution
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.userId },
  });

  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let triggerData: Record<string, unknown> = {};
  try {
    const body = await request.json();
    triggerData = body.trigger ?? {};
  } catch {
    // trigger data is optional
  }

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: id,
      userId: user.userId,
      status: "PENDING",
      trigger: { type: "manual", data: triggerData } as never,
      stepLogs: [] as never,
    },
  });

  // Run in background — don't await so HTTP responds immediately
  executeWorkflow(workflow, execution.id, user.userId).catch(console.error);

  return NextResponse.json({ executionId: execution.id, status: "PENDING" }, { status: 202 });
}
