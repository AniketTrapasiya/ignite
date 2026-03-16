import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/sessions — list all sessions for current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ sessions });
}

// POST /api/chat/sessions — create a new session
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title as string | undefined) ?? "New Chat";
  const model = (body.model as string | undefined) ?? "gemini-2.5-flash";

  const session = await prisma.chatSession.create({
    data: {
      userId: user.userId,
      title,
      channel: "web",
      model,
    },
  });

  return NextResponse.json({ session }, { status: 201 });
}
