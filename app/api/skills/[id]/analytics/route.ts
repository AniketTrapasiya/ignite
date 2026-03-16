import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/skills/[id]/analytics
// Returns computed learning analytics for the skill goal
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    include: {
      challenges: {
        where: { status: "completed" },
        orderBy: { day: "asc" },
        select: {
          day: true,
          score: true,
          xpEarned: true,
          difficulty: true,
          type: true,
          completedAt: true,
        },
      },
    },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const completed = goal.challenges;
  const totalCompleted = completed.length;
  const completionRate = Math.round(((goal.currentDay - 1) / goal.totalDays) * 100);

  // Score trend — day-by-day scores for line chart
  const scoreTrend = completed.map((c) => ({
    day: c.day,
    score: c.score ?? 0,
    xp: c.xpEarned,
  }));

  // Average score
  const avgScore =
    totalCompleted > 0
      ? Math.round(completed.reduce((sum, c) => sum + (c.score ?? 0), 0) / totalCompleted)
      : 0;

  // XP velocity — XP earned per last 7 completed days vs the 7 before
  const last7 = completed.slice(-7);
  const prev7 = completed.slice(-14, -7);
  const xpLast7 = last7.reduce((s, c) => s + c.xpEarned, 0);
  const xpPrev7 = prev7.reduce((s, c) => s + c.xpEarned, 0);
  const xpVelocityDelta = xpPrev7 > 0 ? Math.round(((xpLast7 - xpPrev7) / xpPrev7) * 100) : 0;

  // Per-week breakdown
  type CurriculumWeek = { week: number; topic: string; days: { day: number }[] };
  const curriculum = goal.curriculum as { curriculum: CurriculumWeek[] } | null;
  const weeks = curriculum?.curriculum ?? [];

  const weeklyBreakdown = weeks.map((w) => {
    const weekDays = w.days.map((d) => d.day);
    const weekChallenges = completed.filter((c) => weekDays.includes(c.day));
    const weekAvgScore =
      weekChallenges.length > 0
        ? Math.round(weekChallenges.reduce((s, c) => s + (c.score ?? 0), 0) / weekChallenges.length)
        : null;
    return {
      week: w.week,
      topic: w.topic,
      completedDays: weekChallenges.length,
      totalDays: w.days.length,
      avgScore: weekAvgScore,
      totalXp: weekChallenges.reduce((s, c) => s + c.xpEarned, 0),
    };
  });

  // Difficulty breakdown
  const byDifficulty = ["easy", "medium", "hard"].map((diff) => {
    const items = completed.filter((c) => c.difficulty === diff);
    return {
      difficulty: diff,
      count: items.length,
      avgScore:
        items.length > 0
          ? Math.round(items.reduce((s, c) => s + (c.score ?? 0), 0) / items.length)
          : 0,
    };
  });

  // Streak info
  const currentStreak = goal.streakDays;
  const longestStreak = goal.longestStreak;

  // Personal best day
  const bestDay =
    completed.length > 0
      ? completed.reduce((best, c) => ((c.score ?? 0) > (best.score ?? 0) ? c : best))
      : null;

  return NextResponse.json({
    totalCompleted,
    completionRate,
    avgScore,
    totalXp: goal.totalXp,
    currentStreak,
    longestStreak,
    xpLast7,
    xpVelocityDelta,
    scoreTrend,
    weeklyBreakdown,
    byDifficulty,
    bestDay: bestDay ? { day: bestDay.day, score: bestDay.score } : null,
    currentDay: goal.currentDay,
    totalDays: goal.totalDays,
  });
}
