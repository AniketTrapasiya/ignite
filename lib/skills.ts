/**
 * lib/skills.ts
 * AI generation helpers for the Skill Accelerator feature.
 * Generates curricula, daily challenges, and reviews submissions.
 */
import { generateText } from "ai";
import { resolveTextModel } from "@/lib/providers";

export type CurriculumDay = { day: number; title: string; focus: string };
export type CurriculumWeek = {
  week: number;
  topic: string;
  description: string;
  days: CurriculumDay[];
};
export type Curriculum = { curriculum: CurriculumWeek[] };

export type ChallengeReview = {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  nextStepHint: string;
  xpEarned: number;
};

const XP_TABLE: Record<string, number> = { easy: 50, medium: 100, hard: 150 };

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

// ── Curriculum Generation ────────────────────────────────────────────────────

function buildFallbackCurriculum(title: string): Curriculum {
  const weekThemes = [
    { topic: "Foundations", desc: "Core concepts and getting started" },
    { topic: "Core Skills", desc: "Building essential knowledge" },
    { topic: "Practice & Apply", desc: "Hands-on application" },
    { topic: "Advanced & Project", desc: "Advanced techniques and final project" },
  ];
  return {
    curriculum: weekThemes.map((wt, wi) => ({
      week: wi + 1,
      topic: wt.topic,
      description: `${wt.desc} in ${title}`,
      days: Array.from({ length: wi === 3 ? 9 : 7 }, (_, di) => {
        const day = wi * 7 + di + 1;
        return {
          day,
          title: `${title} — ${wt.topic} Day ${di + 1}`,
          focus: `Practice ${title} ${wt.topic.toLowerCase()} concepts`,
        };
      }),
    })),
  };
}

export async function generateCurriculum(
  userId: string,
  title: string,
  level: string,
  description?: string
): Promise<Curriculum> {
  const fallback = buildFallbackCurriculum(title);
  try {
    const model = await resolveTextModel(userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system: "You are an expert curriculum designer. Return only valid JSON, no markdown, no code blocks, no extra text.",
      prompt: `Create a personalized 30-day learning plan for: "${title}" (level: ${level}).${description ? ` Context: ${description}` : ""}

Return EXACTLY this JSON structure (4 weeks × 7 days = 28 days, plus days 29 and 30 in week 4):
{
  "curriculum": [
    {
      "week": 1,
      "topic": "Week topic name",
      "description": "What this week covers in 1 sentence",
      "days": [
        { "day": 1, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 2, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 3, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 4, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 5, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 6, "title": "Day title", "focus": "Specific thing to practice today" },
        { "day": 7, "title": "Day title", "focus": "Specific thing to practice today" }
      ]
    },
    { "week": 2, ... same structure ... },
    { "week": 3, ... same structure ... },
    { "week": 4, "days": [ days 22-30 (9 days) ] }
  ]
}

Guidelines: Week 1=Fundamentals, Week 2=Core, Week 3=Intermediate, Week 4=Advanced+Project. Be specific and actionable.`,
      maxOutputTokens: 3500,
    });
    const parsed = safeParseJSON<Curriculum>(text, fallback);
    return parsed.curriculum?.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ── Challenge Generation ─────────────────────────────────────────────────────

export async function generateChallenge(
  userId: string,
  goalTitle: string,
  level: string,
  day: number,
  dayTitle: string,
  dayFocus: string
): Promise<{ title: string; description: string; type: string; difficulty: string; hints: string[] }> {
  const difficultyForDay = day <= 7 ? "easy" : day <= 21 ? "medium" : "hard";
  const typeForDay = day <= 10 ? "practice" : day <= 20 ? "code" : "project";
  const fallback = {
    title: `Day ${day}: ${dayTitle}`,
    description: `Practice "${dayFocus}" today. Spend 20–30 minutes exploring this topic. Write what you learn, create a concrete example that demonstrates the concept, and note one real-world use case you could apply this to.`,
    type: typeForDay,
    difficulty: difficultyForDay,
    hints: [
      "Start with the simplest possible version of the concept",
      "Look up one official documentation example or reference",
      "Explain the concept back to yourself in plain language",
    ],
  };
  try {
    const model = await resolveTextModel(userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system: "You are an expert learning coach. Return only valid JSON, no markdown, no code blocks.",
      prompt: `Create a practical hands-on challenge for day ${day}/30 of learning "${goalTitle}" (${level} level).
Today's topic: "${dayTitle}". Focus: "${dayFocus}".

The challenge must be completable in 15–30 minutes. Return ONLY this JSON:
{
  "title": "Action-oriented challenge title (max 8 words)",
  "description": "Clear instructions: what to do, what context matters, what success looks like. 3-4 sentences.",
  "type": "${typeForDay}",
  "difficulty": "${difficultyForDay}",
  "hints": ["Specific actionable hint 1", "Specific actionable hint 2", "Specific actionable hint 3"]
}`,
      maxOutputTokens: 700,
    });
    const parsed = safeParseJSON<typeof fallback>(text, fallback);
    return parsed.title ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ── Challenge Review ─────────────────────────────────────────────────────────

export async function reviewChallenge(
  userId: string,
  goalTitle: string,
  challengeTitle: string,
  challengeDesc: string,
  submission: string,
  difficulty: string
): Promise<ChallengeReview> {
  const base = XP_TABLE[difficulty] ?? 100;
  const fallback: ChallengeReview = {
    score: 75,
    feedback:
      "Great work completing today's challenge! Consistent practice is the most powerful predictor of skill development. Keep showing up.",
    strengths: ["Dedicated effort", "Completing the challenge consistently"],
    improvements: ["Go deeper on the core concepts in tomorrow's session"],
    nextStepHint: "Review today's work briefly before starting tomorrow's challenge.",
    xpEarned: base,
  };
  try {
    const model = await resolveTextModel(userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system: "You are an encouraging expert mentor. Return only valid JSON, no markdown.",
      prompt: `Review this student's work for their "${goalTitle}" learning journey.

CHALLENGE: ${challengeTitle}
${challengeDesc}

STUDENT'S SUBMISSION:
${submission.slice(0, 2500)}

Provide encouraging, specific, constructive feedback. Return ONLY this JSON:
{
  "score": 80,
  "feedback": "2-3 sentences of overall assessment. Be warm and specific.",
  "strengths": ["Specific thing done well", "Another strength"],
  "improvements": ["One specific area to improve", "Another growth opportunity"],
  "nextStepHint": "One concrete actionable tip for tomorrow's learning"
}

Score 0-100. Be generous for genuine effort (any real attempt = minimum 60). Focus on growth.`,
      maxOutputTokens: 550,
    });
    const parsed = safeParseJSON<ChallengeReview>(text, fallback);
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 75));
    const bonus = Math.round((score / 100) * 50);
    return {
      score,
      feedback: parsed.feedback || fallback.feedback,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fallback.strengths,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : fallback.improvements,
      nextStepHint: parsed.nextStepHint || fallback.nextStepHint,
      xpEarned: base + bonus,
    };
  } catch {
    return fallback;
  }
}
