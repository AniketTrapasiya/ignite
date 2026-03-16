import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queryLearningContext } from "@/lib/skills-rag";
import { resolveTextModel } from "@/lib/providers";
import { generateText } from "ai";

// POST /api/skills/[id]/chat
// Body: { message: string }
// Returns: { reply: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify goal ownership
  const goal = await prisma.skillGoal.findFirst({
    where: { id, userId: user.userId },
    select: { id: true, title: true, level: true, currentDay: true },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  // Query Pinecone namespace for relevant past learning context
  const contexts = await queryLearningContext(user.userId, message);
  const contextBlock =
    contexts.length > 0
      ? `\n\n[STUDENT'S PAST LEARNING CONTEXT — from their Pinecone namespace]\n` +
      contexts
        .map(
          (c, i) =>
            `${i + 1}. Day ${c.day} | ${c.topic}: ${c.challengeTitle}\n   Score: ${c.score}/100\n   ${c.content.slice(0, 300)}`
        )
        .join("\n\n")
      : "";

  const systemPrompt = `You are an expert learning coach and mentor for "${goal.title}".
The student is on Day ${goal.currentDay}/30 of their personalized learning journey (level: ${goal.level}).
Your role is to answer questions, clarify concepts, give practical examples, and guide them based on what they have already learned.
Be concise, encouraging, and specific. Use examples aligned to their current topic and level.
If you reference something from their past work, note it explicitly.${contextBlock}`;

  try {
    const model = await resolveTextModel(user.userId, "gemini-2.5-flash");
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: message,
      maxOutputTokens: 800,
    });
    return NextResponse.json({ reply: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
