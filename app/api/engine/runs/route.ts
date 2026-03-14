import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRunHistory } from "@/lib/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await getRunHistory(user.userId, 20);
  return NextResponse.json({ runs });
}
