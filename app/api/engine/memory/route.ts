import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMemories, createMemory, searchMemories } from "@/lib/memory";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q");

  if (q) {
    const results = await searchMemories(user.userId, q);
    return NextResponse.json({ memories: results });
  }

  const memories = await getMemories(user.userId);
  return NextResponse.json({ memories });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, content, tags } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const memory = await createMemory(user.userId, title, content, tags ?? []);
  return NextResponse.json({ memory }, { status: 201 });
}
