import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIntegrations, saveIntegration } from "@/lib/integrations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrations = await getIntegrations(user.userId);
  return NextResponse.json({ integrations });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { service, credentials } = body;

  if (!service || !credentials) {
    return NextResponse.json({ error: "service and credentials are required" }, { status: 400 });
  }

  await saveIntegration(user.userId, service, credentials);
  return NextResponse.json({ success: true });
}
