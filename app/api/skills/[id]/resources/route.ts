import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTextModel } from "@/lib/providers";
import { generateText } from "ai";

type CurriculumWeek = { week: number; topic: string; description: string; days: { day: number; title: string; focus: string }[] };
type CurriculumData = { curriculum: CurriculumWeek[] };

interface Resource {
  title: string;
  url: string;
  type: "youtube" | "article" | "docs" | "course";
  description: string;
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

function buildFallbackResources(topic: string, goalTitle: string): Resource[] {
  const query = encodeURIComponent(`${topic} ${goalTitle} tutorial`);
  return [
    {
      title: `${topic} — YouTube Tutorial`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      type: "youtube",
      description: `Search YouTube for "${topic}" tutorials`,
    },
    {
      title: `${topic} — freeCodeCamp Guide`,
      url: `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(`${topic} ${goalTitle}`)}`,
      type: "article",
      description: `Free in-depth articles on ${topic}`,
    },
    {
      title: `${topic} — MDN Web Docs`,
      url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(`${topic}`)}`,
      type: "docs",
      description: `Official documentation and references`,
    },
  ];
}

// GET /api/skills/[id]/resources?week=N
// Returns YouTube + blog + docs links for the given week's topic
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const weekNum = parseInt(req.nextUrl.searchParams.get("week") ?? "1", 10);

  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    select: { title: true, level: true, curriculum: true },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const curriculum = goal.curriculum as CurriculumData | null;
  const week = curriculum?.curriculum?.find((w) => w.week === weekNum);
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const fallback = buildFallbackResources(week.topic, goal.title);

  try {
    const model = await resolveTextModel(user.userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system:
        "You are a learning resource curator. Return only valid JSON arrays. All URLs must be real, working public URLs (YouTube videos, official docs, well-known learning sites).",
      prompt: `Suggest 6 high-quality learning resources for Week ${weekNum} of "${goal.title}" (level: ${goal.level}).

Week topic: "${week.topic}"
Week description: "${week.description}"
Days covered: ${week.days.map((d) => d.title).join(", ")}

Return a JSON array of exactly 6 resources:
[
  {
    "title": "Resource title",
    "url": "https://actual-real-url.com",
    "type": "youtube",
    "description": "One sentence about what you'll learn here"
  }
]

Resource type must be one of: "youtube", "article", "docs", "course"

Requirements:
- Include at least 2 YouTube links (use https://www.youtube.com/watch?v=REAL_ID or https://youtu.be/REAL_ID — use well-known channels like Fireship, Traversy Media, freeCodeCamp, or The Coding Train)
- Include at least 2 article links (MDN, freeCodeCamp, CSS-Tricks, dev.to, or similar)
- Include at least 1 official documentation link
- URLs must be for well-known, public resources actually about "${week.topic}" and "${goal.title}"
- Titles and descriptions must accurately describe the resource`,
      maxOutputTokens: 1000,
    });

    const resources = safeParseJSON<Resource[]>(text, fallback);
    // Validate structure
    const valid = resources.filter(
      (r) => r.title && r.url && r.type && r.description && r.url.startsWith("http")
    );
    return NextResponse.json({ week: weekNum, topic: week.topic, resources: valid.length >= 3 ? valid : fallback });
  } catch {
    return NextResponse.json({ week: weekNum, topic: week.topic, resources: fallback });
  }
}
