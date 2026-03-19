const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Send a text message via the Telegram Bot API.
 * Optionally attempts to parse and send media URLs found in the text as rich media first.
 * Returns { ok: true } on success or { ok: false, description } on failure.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; description?: string }> {
  
  // Quick scan for common media URLs
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s"',]+/g) || []));
  let mediaSentCount = 0;

  for (const url of urls) {
    // Only send the first 3 media files to avoid spamming
    if (mediaSentCount >= 3) break;

    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || text.includes(`"image_url":"${url}"`);
    const isVideo = url.match(/\.(mp4|webm|mov|m4v)$/i) || text.includes(`"video_url":"${url}"`);
    const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || text.includes(`"audio_url":"${url}"`);

    if (isImage) {
      await sendTelegramMedia(botToken, chatId, url, "sendPhoto", "photo", text.length < 1000 ? text : undefined);
      mediaSentCount++;
    } else if (isVideo) {
      await sendTelegramMedia(botToken, chatId, url, "sendVideo", "video", text.length < 1000 ? text : undefined);
      mediaSentCount++;
    } else if (isAudio) {
      await sendTelegramMedia(botToken, chatId, url, "sendAudio", "audio", text.length < 1000 ? text : undefined);
      mediaSentCount++;
    }
  }

  // If we sent media with a caption, and the text is small, we might not want to send the message again.
  // But Telegram captions are limited, so we usually send the full text separately if it's long.
  if (mediaSentCount > 0 && text.length < 200) {
    return { ok: true };
  }

  // Then send the text (it may contain the JSON string with the URL, so it serves as context/caption)
  const safeText = text.length > MAX_MESSAGE_LENGTH
    ? text.slice(0, MAX_MESSAGE_LENGTH) + "\n\n…[truncated]"
    : text;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
      }),
    });

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
 * Helper to send media directly to Telegram
 */
async function sendTelegramMedia(
  botToken: string, 
  chatId: string, 
  mediaUrl: string, 
  method: string, 
  paramName: string,
  caption?: string
) {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        [paramName]: mediaUrl,
        caption: caption,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("Failed to send telegram media", e);
  }
}

/**
 * Escapes special HTML characters so raw AI output is safe inside parse_mode: HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Extracts the RESULT: section from engine output, or falls back to the full text.
 */
export function extractResultForTelegram(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
