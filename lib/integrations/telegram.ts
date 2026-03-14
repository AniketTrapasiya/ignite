const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Send a text message via the Telegram Bot API.
 * Returns { ok: true } on success or { ok: false, description } on failure.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; description?: string }> {
  // Telegram max message size is 4096 chars; truncate with notice if needed
  const safeText =
    text.length > MAX_MESSAGE_LENGTH
      ? text.slice(0, MAX_MESSAGE_LENGTH) + "\n\n…[truncated]"
      : text;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        parse_mode: "HTML",
      }),
    });

    // Telegram always returns JSON
    const json = (await res.json()) as { ok: boolean; description?: string };
    return json;
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extracts the RESULT: section from engine output, or falls back to the full text.
 */
export function extractResultForTelegram(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
