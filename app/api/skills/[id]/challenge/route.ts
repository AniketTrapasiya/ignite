import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChallenge, reviewChallenge } from "@/lib/skills";

type CurriculumDay = { day: number; title: string; focus: string };
type CurriculumWeek = { week: number; topic: string; description: string; days: CurriculumDay[] };
type CurriculumData = { curriculum: CurriculumWeek[] };

// GET /api/skills/[id]/challenge — get or auto-generate today's challenge
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const day = goal.currentDay;

  // Return existing challenge if already generated
  const existing = await prisma.skillChallenge.findUnique({
    where: { goalId_day: { goalId: goal.id, day } },
  });
  if (existing) return NextResponse.json({ challenge: existing });

  // Generate from curriculum info
  const curriculum = goal.curriculum as CurriculumData | null;
  const allDays = curriculum?.curriculum?.flatMap((w) => w.days) ?? [];
  const dayInfo = allDays.find((d) => d.day === day) ?? {
    day,
    title: `Day ${day} — ${goal.title}`,
    focus: goal.title,
  };

  const raw = await generateChallenge(
    user.userId,
    goal.title,
    goal.level,
    day,
    dayInfo.title,
    dayInfo.focus
  );

  const challenge = await prisma.skillChallenge.create({
    data: {
      goalId: goal.id,
      userId: user.userId,
      day,
      title: raw.title,
      description: raw.description,
      type: raw.type,
      difficulty: raw.difficulty,
      hints: raw.hints,
    },
  });

  return NextResponse.json({ challenge });
}

// POST /api/skills/[id]/challenge — submit answer for review
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { challengeId?: string; submission?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { challengeId, submission } = body;
  if (!submission?.trim()) {
    return NextResponse.json({ error: "submission is required" }, { status: 400 });
  }
  if (!challengeId) {
    return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
  }

  const challenge = await prisma.skillChallenge.findFirst({
    where: { id: challengeId, goalId: goal.id },
  });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (challenge.status === "completed") {
    return NextResponse.json({ error: "Challenge already completed" }, { status: 400 });
  }

  // AI reviews the submission
  const review = await reviewChallenge(
    user.userId,
    goal.title,
    challenge.title,
    challenge.description,
    submission.trim(),
    challenge.difficulty
  );

  // Persist the completed challenge
  const updated = await prisma.skillChallenge.update({
    where: { id: challengeId },
    data: {
      submission: submission.trim(),
      feedback: review.feedback,
      score: review.score,
      xpEarned: review.xpEarned,
      status: "completed",
      completedAt: new Date(),
    },
  });

  // Update goal: XP, streak, advance day
  const newXp = goal.totalXp + review.xpEarned;
  const nextDay = Math.min(goal.currentDay + 1, goal.totalDays);

  // Streak logic: was last active today or yesterday?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastActive = goal.lastActiveAt ? new Date(goal.lastActiveAt) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);
  const daysSinceActive = lastActive
    ? Math.round((today.getTime() - lastActive.getTime()) / 86_400_000)
    : 999;
  const newStreak = daysSinceActive <= 1 ? goal.streakDays + 1 : 1;
  const newLongest = Math.max(goal.longestStreak, newStreak);
  const isCompleted = nextDay >= goal.totalDays;

  await prisma.skillGoal.update({
    where: { id: goal.id },
    data: {
      totalXp: newXp,
      currentDay: nextDay,
      streakDays: newStreak,
      longestStreak: newLongest,
      lastActiveAt: new Date(),
      status: isCompleted ? "completed" : "active",
    },
  });

  // Auto-save learning to Engine Memory so the AI engine can reference it
  try {
    await prisma.engineMemory.create({
      data: {
        userId: user.userId,
        title: `[${goal.title}] Day ${challenge.day}: ${challenge.title}`,
        content: `Challenge: ${challenge.description}\n\nMy work:\n${submission.trim()}\n\nAI Feedback: ${review.feedback}`,
        tags: [
          "skill-learning",
          goal.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30),
        ],
      },
    });
  } catch {
    // Memory save failure is non-critical
  }

  // Streak milestone notifications
  if ([3, 7, 14, 30].includes(newStreak)) {
    try {
      await prisma.notification.create({
        data: {
          userId: user.userId,
          type: "success",
          title: `🔥 ${newStreak}-Day Streak!`,
          message: `Incredible dedication! You've practiced "${goal.title}" for ${newStreak} days straight. Your consistency is building real skills.`,
          link: `/dashboard/skills/${goal.id}`,
        },
      });
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({
    challenge: updated,
    review,
    newDay: nextDay,
    newXp,
    newStreak,
    isCompleted,
  });
}
