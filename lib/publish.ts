import { getCredentials } from "./integrations";
import { sendTelegramMediaBuffer } from "./integrations/telegram";
import { sendSlackMessage } from "./integrations/slack";
import { sendDiscordMessage } from "./integrations/discord";
import { sendWhatsAppMessage } from "./integrations/whatsapp";

export type MediaResult = {
  type: "image" | "video" | "audio";
  data: string | Buffer; // base64 or buffer
  url?: string;
  prompt: string;
};

/**
 * Publish a media generation result to multiple platforms.
 */
export async function publishMediaResult(
  userId: string,
  result: MediaResult,
  platforms: string[]
) {
  const { type, data, url, prompt } = result;
  const filename = `ignite-${type}-${Date.now()}.${type === "image" ? "png" : type === "video" ? "mp4" : "mp3"}`;
  const caption = `🔥 Generated ${type} via Ignite Engine\n\n<b>Prompt:</b> ${prompt}`;

  const results = await Promise.all(
    platforms.map(async (platform) => {
      try {
        const creds = await getCredentials(userId, platform);
        if (!creds?.apiKey) return { platform, ok: false, error: "No credentials" };

        if (platform === "telegram") {
          if (!creds.chatId) return { platform, ok: false, error: "No chatId" };
          const res = await sendTelegramMediaBuffer(
            creds.apiKey,
            creds.chatId,
            data,
            type === "image" ? "photo" : type,
            filename,
            caption
          );
          return { platform, ok: res.ok, error: res.description };
        }

        // Fallback for other platforms: send as text link if URL exists, or just notification
        if (platform === "slack") {
          const message = `🤖 *AutoFlow Media Result*\n\n*Type:* ${type}\n*Prompt:* ${prompt}\n${url ? `*Link:* ${url}` : "(File attached to original engine run)"}`;
          const res = await sendSlackMessage(creds.apiKey, creds.chatId || "", message);
          return { platform, ok: res.ok, error: res.error };
        }

        if (platform === "discord") {
          const message = `🤖 **AutoFlow Media Result**\n\n**Type:** ${type}\n**Prompt:** ${prompt}\n${url ? `**Link:** ${url}` : ""}`;
          const res = await sendDiscordMessage(creds.apiKey, creds.chatId || "", message);
          return { platform, ok: res.ok, error: res.error };
        }

        if (platform === "whatsapp") {
          if (!creds.phoneNumberId || !creds.chatId) return { platform, ok: false, error: "Incomplete WA creds" };
          const message = `🤖 AutoFlow Media Result\n\nType: ${type}\nPrompt: ${prompt}\n${url ? `Link: ${url}` : ""}`;
          const res = await sendWhatsAppMessage(creds.apiKey, creds.phoneNumberId, creds.chatId, message);
          return { platform, ok: res.ok, error: res.error };
        }

        return { platform, ok: false, error: "Platform media publishing not fully implemented yet" };
      } catch (err) {
        return { platform, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  return results;
}
