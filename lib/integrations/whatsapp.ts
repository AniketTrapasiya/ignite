/**
 * WhatsApp Business API (Meta Cloud API) integration.
 *
 * Credentials:
 *   apiKey  = Meta WhatsApp Business API Access Token
 *   chatId  = Recipient phone number in E.164 format (e.g. +919876543210)
 *
 * Also requires WHATSAPP_PHONE_NUMBER_ID env var — the sender's Phone Number ID
 * from your Meta Business account.
 */

const META_GRAPH = "https://graph.facebook.com/v19.0";

/**
 * Send a plain text message via WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  recipientPhone: string,
  text: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  // WhatsApp text messages have a 4096-char limit
  const safeText =
    text.length > 4000 ? text.slice(0, 4000) + "\n\n…[truncated]" : text;

  try {
    const res = await fetch(`${META_GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: { preview_url: false, body: safeText },
      }),
    });
    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };
    if (res.ok && json.messages?.[0]?.id) {
      return { ok: true, messageId: json.messages[0].id };
    }
    return { ok: false, error: json.error?.message ?? `Meta API HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function extractResultForWhatsApp(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
