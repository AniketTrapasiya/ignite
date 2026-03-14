import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runEngine } from "@/lib/engine";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add it to your .env file." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { prompt, memoryIds = [], mods = [] } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const { runId, stream } = await runEngine(user.userId, prompt.trim(), memoryIds, mods);

  // Stream the response as text/event-stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      // First: send the runId
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ runId })}\n\n`));

      try {
        for await (const chunk of stream.textStream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
