import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCurriculum } from "@/lib/skills";

// GET /api/skills — list user's skill goals
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.skillGoal.findMany({
    where: { userId: user.userId },
    include: {
      challenges: {
        select: { id: true, day: true, status: true, xpEarned: true, score: true },
        orderBy: { day: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ goals });
}

// POST /api/skills — create a new skill goal with AI curriculum
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; level?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, level = "beginner", description } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Generate personalized 30-day curriculum with AI
  const curriculumData = await generateCurriculum(
    user.userId,
    title.trim(),
    level,
    description?.trim()
  );

  const goal = await prisma.skillGoal.create({
    data: {
      userId: user.userId,
      title: title.trim(),
      level,
      description: description?.trim() || null,
      curriculum: curriculumData,
    },
    include: { challenges: true },
  });

  return NextResponse.json({ goal }, { status: 201 });
}
