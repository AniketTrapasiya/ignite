import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/sessions/[id] — fetch a session with all messages
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await prisma.chatSession.findFirst({
    where: { id, userId: user.userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ session });
}

// PATCH /api/chat/sessions/[id] — rename a session
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = body.title as string | undefined;

  const session = await prisma.chatSession.updateMany({
    where: { id, userId: user.userId },
    data: { title },
  });

  if (session.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/chat/sessions/[id] — delete a session and its messages
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const deleted = await prisma.chatSession.deleteMany({
    where: { id, userId: user.userId },
  });

  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
