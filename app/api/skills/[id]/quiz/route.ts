import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTextModel } from "@/lib/providers";
import { generateText } from "ai";

type CurriculumDay = { day: number; title: string; focus: string };
type CurriculumWeek = { week: number; topic: string; description: string; days: CurriculumDay[] };
type CurriculumData = { curriculum: CurriculumWeek[] };

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

// GET /api/skills/[id]/quiz?week=N
// Generate a 5-question quiz for the given completed week
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const weekNum = parseInt(req.nextUrl.searchParams.get("week") ?? "1", 10);

  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    include: {
      challenges: {
        where: { status: "completed" },
        select: { day: true, title: true, description: true, feedback: true, score: true },
      },
    },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const curriculum = goal.curriculum as CurriculumData | null;
  const week = curriculum?.curriculum?.find((w) => w.week === weekNum);
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  // Summarize what was learned this week from completed challenges
  const weekDayRange = week.days.map((d) => d.day);
  const weekChallenges = goal.challenges.filter((c) => weekDayRange.includes(c.day));
  const learningSummary = weekChallenges
    .map((c) => `Day ${c.day}: ${c.title} — ${c.description?.slice(0, 100)}`)
    .join("\n");

  const fallbackQuestions: QuizQuestion[] = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    question: `What is a key concept from Week ${weekNum} (${week.topic})?`,
    options: ["Concept A", "Concept B", "Concept C", "Concept D"],
    correctIndex: 0,
    explanation: `Week ${weekNum} covered: ${week.description}`,
  }));

  try {
    const model = await resolveTextModel(user.userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system:
        "You are an expert educator. Return only valid JSON arrays, no markdown, no code blocks.",
      prompt: `Create a 5-question multiple-choice quiz to test understanding of Week ${weekNum} of "${goal.title}".

Week topic: "${week.topic}"
Week description: "${week.description}"
Topics covered this week:
${week.days.map((d) => `- Day ${d.day}: ${d.title} (${d.focus})`).join("\n")}

What the student practiced:
${learningSummary || "(No completed challenges found for this week)"}

Return ONLY a JSON array with exactly 5 question objects:
[
  {
    "id": 1,
    "question": "Clear, specific question about a concept from this week",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why this is correct (1-2 sentences)"
  }
]

Rules:
- Questions must be answerable based on the Week ${weekNum} content
- Make one option clearly correct, others plausible but wrong
- correctIndex is zero-based (0-3)
- Keep questions concise and unambiguous`,
      maxOutputTokens: 1500,
    });

    const questions = safeParseJSON<QuizQuestion[]>(text, fallbackQuestions);
    return NextResponse.json({ week: weekNum, topic: week.topic, questions });
  } catch {
    return NextResponse.json({ week: weekNum, topic: week.topic, questions: fallbackQuestions });
  }
}

// POST /api/skills/[id]/quiz
// Body: { week: number, answers: number[] }  (answers are correctIndex values chosen by user)
// Returns: { score, correctCount, total, results: { questionId, correct, explanation }[] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    select: { id: true, title: true },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { week?: number; answers?: number[]; questions?: QuizQuestion[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { week, answers, questions } = body;
  if (!Array.isArray(answers) || !Array.isArray(questions)) {
    return NextResponse.json({ error: "answers and questions are required arrays" }, { status: 400 });
  }

  const results = questions.map((q, i) => ({
    questionId: q.id,
    question: q.question,
    userAnswer: answers[i] ?? -1,
    correctAnswer: q.correctIndex,
    correct: answers[i] === q.correctIndex,
    explanation: q.explanation,
    options: q.options,
  }));

  const correctCount = results.filter((r) => r.correct).length;
  const score = Math.round((correctCount / questions.length) * 100);

  // Save quiz result as a notification
  const passed = score >= 60;
  try {
    await prisma.notification.create({
      data: {
        userId: user.userId,
        type: passed ? "success" : "info",
        title: passed ? `✅ Week ${week} Quiz Passed! (${score}%)` : `📝 Week ${week} Quiz: ${score}% — Keep Practicing`,
        message: `You scored ${correctCount}/${questions.length} on the Week ${week} quiz for "${goal.title}".`,
        link: `/dashboard/skills/${id}`,
      },
    });
  } catch {
    // Non-critical
  }

  return NextResponse.json({ score, correctCount, total: questions.length, passed, results });
}
