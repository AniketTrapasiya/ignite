import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeIntegration } from "@/lib/integrations";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { service } = await params;
  await removeIntegration(user.userId, service);
  return NextResponse.json({ success: true });
}
