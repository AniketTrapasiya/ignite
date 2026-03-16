/**
 * Discord integration — supports both Webhook URLs and Bot Tokens.
 *
 * Webhook URL  : stored as apiKey  (https://discord.com/api/webhooks/...)
 * Bot Token    : stored as apiKey  (starts with "Bot ..." or raw token)
 * Channel ID   : stored as chatId  (for bot token path)
 */

const MAX_LENGTH = 2000; // Discord message limit

function truncate(text: string): string {
  return text.length > MAX_LENGTH
    ? text.slice(0, MAX_LENGTH - 20) + "\n…[truncated]"
    : text;
}

/**
 * Send via Webhook URL.
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  content: string,
  username = "AutoFlow AI"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        content: truncate(content),
        embeds: [
          {
            color: 0x7c3aed, // purple
            description: truncate(content),
            footer: { text: "AutoFlow AI · " + new Date().toUTCString() },
          },
        ],
      }),
    });
    // Discord webhooks return 204 No Content on success
    if (res.status === 204 || res.ok) return { ok: true };
    const text = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send via Bot Token to a specific Channel ID.
 */
export async function sendDiscordBotMessage(
  botToken: string,
  channelId: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({
          content: truncate(content),
          embeds: [
            {
              color: 0x7c3aed,
              description: truncate(content),
              footer: { text: "AutoFlow AI · " + new Date().toUTCString() },
            },
          ],
        }),
      }
    );
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: (json as { message?: string }).message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unified send — auto-detects webhook vs bot token.
 * apiKey  = webhook URL  OR  raw bot token
 * chatId  = channel ID (only needed for bot token path)
 */
export async function sendDiscordMessage(
  apiKey: string,
  chatId: string | undefined,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (apiKey.startsWith("https://")) {
    return sendDiscordWebhook(apiKey, text);
  }
  if (!chatId) {
    return { ok: false, error: "Channel ID required for bot token auth" };
  }
  const token = apiKey.startsWith("Bot ") ? apiKey.slice(4) : apiKey;
  return sendDiscordBotMessage(token, chatId, text);
}

export function extractResultForDiscord(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
