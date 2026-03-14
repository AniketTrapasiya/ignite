import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCredentials } from "@/lib/integrations";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { service } = await params;
  const credentials = await getCredentials(user.userId, service);

  if (!credentials) {
    return NextResponse.json({ ok: false, error: "No credentials found" }, { status: 404 });
  }

  // Basic validation: just confirm credentials exist (real test per service can be added later)
  return NextResponse.json({ ok: true, message: "Credentials found and decrypted successfully" });
}
