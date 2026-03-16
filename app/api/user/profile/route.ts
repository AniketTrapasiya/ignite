import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email } = body as { name?: string; email?: string };

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const normalizedEmail = email ? normalizeEmail(email) : undefined;

  // If email changed, check uniqueness
  if (normalizedEmail && normalizedEmail !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.userId },
    data: {
      name: name.trim(),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user: updated });
}
