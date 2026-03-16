import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — update label
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cred = await prisma.aICredential.findFirst({
    where: { id, userId: user.userId },
  });
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.aICredential.update({
    where: { id },
    data: { label: body.label ?? cred.label },
    select: { id: true, provider: true, label: true, createdAt: true },
  });

  return NextResponse.json({ credential: updated });
}

// DELETE — remove credential
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const cred = await prisma.aICredential.findFirst({
    where: { id, userId: user.userId },
  });
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.aICredential.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
