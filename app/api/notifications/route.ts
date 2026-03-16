import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — list for current user (last 30)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unread = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ notifications, unread });
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: user.userId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
