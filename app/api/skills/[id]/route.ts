import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/skills/[id] — get goal with all challenges
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    include: {
      challenges: { orderBy: { day: "asc" } },
    },
  });

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
}

// DELETE /api/skills/[id] — delete a skill goal
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.skillGoal.deleteMany({
    where: { id, userId: user.userId },
  });

  return NextResponse.json({ ok: true });
}
