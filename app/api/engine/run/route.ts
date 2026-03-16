import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runEngine } from "@/lib/engine";
import { createNotification } from "@/lib/notify";
import { resolveApiKey } from "@/lib/providers";

export const maxDuration = 60; // Allow longer streaming responses

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check that at least one AI provider is available
  const geminiKey = await resolveApiKey(user.userId, "gemini");
  const openaiKey = await resolveApiKey(user.userId, "openai");
  const groqKey = await resolveApiKey(user.userId, "groq");
  const anthropicKey = await resolveApiKey(user.userId, "anthropic");
  if (!geminiKey && !openaiKey && !groqKey && !anthropicKey) {
    return NextResponse.json(
      { error: "No AI provider configured. Add an API key in Settings → AI Keys." },
      { status: 503 }
    );
  }

  let body: { prompt?: string; memoryIds?: string[]; mods?: string[]; model?: string; mediaContext?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, memoryIds = [], mods = [], model = "gemini-2.5-flash", mediaContext } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  let runId: string;
  let stream: Awaited<ReturnType<typeof runEngine>>["stream"];

  try {
    const result = await runEngine(user.userId, prompt.trim(), memoryIds, mods, model, mediaContext);
    runId = result.runId;
    stream = result.stream;
  } catch (err) {
    return NextResponse.json(
      { error: `Engine failed to start: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ runId })}\n\n`));
      try {
        // Stream all events: text, tool calls, tool results
        for await (const part of stream.fullStream) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = part as any;
          if (p.type === "text-delta" && (p.text || p.textDelta)) {
            const text: string = p.text ?? p.textDelta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } else if (p.type === "tool-call") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ toolCall: { name: p.toolName, args: p.input ?? p.args } })}\n\n`
              )
            );
          } else if (p.type === "tool-result") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ toolResult: { name: p.toolName, result: p.output ?? p.result } })}\n\n`
              )
            );
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        createNotification(
          user.userId,
          "success",
          "Engine run complete",
          `Your prompt was processed successfully.`,
          `/dashboard/engine`
        ).catch(() => { });
      } catch (err) {
        console.error("Streaming error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
        );
        createNotification(
          user.userId,
          "error",
          "Engine run failed",
          errorMessage,
          `/dashboard/engine`
        ).catch(() => { });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
