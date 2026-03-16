import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamChatTurn, loadSessionHistory, buildCredentialResolutionMessage } from "@/lib/chat-engine";

// POST /api/chat/sessions/[id]/messages — SSE stream for a new message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  // Verify session ownership
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.userId },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    message?: string;
    mediaContext?: string;
    credentialResponse?: { credentialId: string; values: Record<string, string> };
  };

  let userContent = body.message?.trim() ?? "";

  // If this is a credential response, mark it as resolved and inject it into message
  if (body.credentialResponse) {
    const { credentialId, values } = body.credentialResponse;
    try {
      const pending = await prisma.pendingCredential.findFirst({
        where: { id: credentialId, sessionId },
      });
      if (pending) {
        await prisma.pendingCredential.update({
          where: { id: credentialId },
          data: { resolved: true, values: values as object },
        });
        userContent =
          userContent ||
          buildCredentialResolutionMessage(pending.toolName, values);
      }
    } catch {
      // Proceed regardless
    }
  }

  if (!userContent) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Persist the user message BEFORE streaming
  try {
    await prisma.chatMessage.create({
      data: { sessionId, role: "user", content: userContent },
    });
  } catch {
    // DB unavailable — continue
  }

  // Load conversation history for model context
  const history = await loadSessionHistory(sessionId, 20).catch(() => []);

  const chatStream = await streamChatTurn({
    userId: user.userId,
    sessionId,
    history,
    userMessage: userContent,
    modelId: session.model ?? "gemini-2.5-flash",
    mediaContext: body.mediaContext,
  });

  return new Response(chatStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

// GET /api/chat/sessions/[id]/messages — list all messages for a session
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: user.userId },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}
