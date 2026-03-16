import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCredentials } from "@/lib/integrations";
import { sendTelegramMessage } from "@/lib/integrations/telegram";

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

  // Telegram-specific test: send a real test message
  if (service === "telegram") {
    if (!credentials.apiKey) {
      return NextResponse.json({ ok: false, error: "Bot token missing" }, { status: 400 });
    }
    if (!credentials.chatId) {
      return NextResponse.json({ ok: false, error: "Chat ID missing — reconnect Telegram and enter your Chat ID" }, { status: 400 });
    }

    const result = await sendTelegramMessage(
      credentials.apiKey,
      credentials.chatId,
      "✅ AutoFlow connected! This is a test message from your AutoFlow engine."
    );

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.description ?? "Telegram API rejected the message",
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Test message sent to Telegram successfully!" });
  }

  // Generic: just confirm credentials exist
  return NextResponse.json({ ok: true, message: "Credentials found and decrypted successfully" });
}
