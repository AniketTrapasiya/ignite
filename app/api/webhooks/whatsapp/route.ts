/**
 * WhatsApp Cloud API Webhook
 *
 * How to configure in Meta Business:
 * 1. Go to your App > WhatsApp > Configuration
 * 2. Set Webhook URL to: https://yourdomain.com/api/webhooks/whatsapp?userId=YOUR_USER_ID
 * 3. Set Verify Token to the value you entered in AutoFlow's WhatsApp integration as "Webhook Verify Token"
 * 4. Subscribe to "messages" webhook field
 *
 * GET  — Meta verifies the webhook URL during setup
 * POST — Meta sends incoming message events here
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

// ── GET: Webhook Verification ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const userId = searchParams.get("userId");

  if (!mode || !token || !challenge) {
    return new NextResponse("Missing parameters", { status: 400 });
  }
  if (mode !== "subscribe") {
    return new NextResponse("Invalid mode", { status: 403 });
  }

  try {
    // Look up this user's WhatsApp credentials and verify the token matches
    const query = userId
      ? { userId_service: { userId, service: "whatsapp" } }
      : null;

    if (!query) {
      return new NextResponse("userId query param required", { status: 400 });
    }

    const integration = await prisma.integration.findUnique({ where: query });
    if (!integration) {
      return new NextResponse("Integration not found", { status: 403 });
    }

    const creds = JSON.parse(decrypt(integration.credentials)) as Record<string, string>;
    if (creds.webhookToken !== token) {
      return new NextResponse("Verification token mismatch", { status: 403 });
    }

    // Return the challenge to complete verification
    return new NextResponse(challenge, { status: 200 });
  } catch (err) {
    console.error("[WhatsApp Webhook] Verification error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// ── POST: Receive Messages ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Extract message entries from the WhatsApp webhook payload
  try {
    const entries = (body.entry as Array<{
      changes: Array<{
        value: {
          messages?: Array<{
            from: string;
            type: string;
            text?: { body: string };
            image?: { id: string; caption?: string };
            document?: { id: string; filename?: string; caption?: string };
            timestamp: string;
          }>;
          metadata?: { phone_number_id: string; display_phone_number: string };
        };
      }>;
    }>) ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        const messages = change.value?.messages ?? [];

        for (const msg of messages) {
          const senderPhone = msg.from;
          const textContent = msg.text?.body?.trim();

          if (!textContent || !phoneNumberId) continue;
          if (msg.type !== "text") continue; // Only handle text for now

          // Process the message in background (return 200 immediately)
          processWhatsAppMessage({
            phoneNumberId,
            senderPhone,
            text: textContent,
          }).catch((err) => {
            console.error("[WhatsApp Chatbot] Processing error:", err);
          });
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Processing error:", err);
  }

  // Always return 200 to Meta to acknowledge receipt
  return NextResponse.json({ status: "ok" });
}

// ── Chatbot Logic ─────────────────────────────────────────────────────────
async function processWhatsAppMessage({
  phoneNumberId,
  senderPhone,
  text,
}: {
  phoneNumberId: string;
  senderPhone: string;
  text: string;
}) {
  // 1. Find the user who owns this WhatsApp phone number ID
  const integrations = await prisma.integration.findMany({
    where: { service: "whatsapp" },
  });

  let userId: string | null = null;
  let accessToken: string | null = null;

  for (const integration of integrations) {
    try {
      const creds = JSON.parse(decrypt(integration.credentials)) as Record<string, string>;
      if (creds.phoneNumberId === phoneNumberId) {
        userId = integration.userId;
        accessToken = creds.apiKey ?? null;
        break;
      }
    } catch {
      // Skip malformed credentials
    }
  }

  if (!userId || !accessToken) {
    console.warn("[WhatsApp Chatbot] No user found for phoneNumberId:", phoneNumberId);
    return;
  }

  // 2. Find or create a chat session for this sender
  let session = await prisma.chatSession.findFirst({
    where: { userId, channel: "whatsapp", channelId: senderPhone },
    orderBy: { updatedAt: "desc" },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        userId,
        title: `WhatsApp: ${senderPhone}`,
        channel: "whatsapp",
        channelId: senderPhone,
        model: "gemini-2.5-flash",
      },
    });
  }

  // 3. Persist incoming user message
  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: "user", content: text },
  });

  // 4. Load conversation history (last 10 exchanges)
  const { loadSessionHistory, streamChatTurn } = await import("@/lib/chat-engine");
  const history = await loadSessionHistory(session.id, 10);

  // 5. Stream the engine response, collecting full text
  let fullText = "";

  type CredReq = {
    toolName: string;
    title: string;
    description: string;
    fields: { name: string; label: string; type: string; required: boolean }[];
  };
  let credentialRequest: CredReq | null = null;

  const stream = await streamChatTurn({
    userId,
    sessionId: session.id,
    history,
    userMessage: text,
    modelId: session.model ?? "gemini-2.5-flash",
  });

  // Read the entire stream
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.text) fullText += event.text as string;
        if (event.credentialRequest) credentialRequest = event.credentialRequest as CredReq;
      } catch {
        // Ignore parse errors
      }
    }
  }

  // 6. Build the reply
  let reply = fullText.trim();

  if (credentialRequest) {
    // Build a WhatsApp-friendly credential request message
    const fieldList = credentialRequest.fields
      .map((f) => `• ${f.label}${f.required ? " (required)" : " (optional)"}`)
      .join("\n");

    reply = [
      `🔐 *${credentialRequest.title}*`,
      "",
      credentialRequest.description,
      "",
      "Please reply with the following information:",
      fieldList,
      "",
      "_You can also set these up permanently in the Integrations settings._",
    ].join("\n");
  }

  if (!reply) return;

  // Truncate if needed (WhatsApp limit ~4000 chars)
  if (reply.length > 3800) reply = reply.slice(0, 3800) + "\n…[truncated]";

  // 7. Send reply via WhatsApp
  const { sendWhatsAppMessage } = await import("@/lib/integrations/whatsapp");
  await sendWhatsAppMessage(accessToken, phoneNumberId, senderPhone, reply);
}
