const SLACK_API = "https://slack.com/api";

/**
 * Post a message to a Slack channel using a Bot Token.
 * @param botToken  - xoxb-... token
 * @param channel   - Channel ID (C...) or name (#general)
 * @param text      - Plain text fallback
 * @param blocks    - Optional Block Kit blocks
 */
export async function sendSlackMessage(
  botToken: string,
  channel: string,
  text: string,
  blocks?: object[]
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { channel, text };
  if (blocks?.length) body.blocks = blocks;

  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    return json;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Build a rich Slack Block Kit message for AutoFlow results.
 */
export function buildSlackBlocks(result: string): object[] {
  // Slack block text has a 3000-char limit per section
  const safe = result.length > 2800 ? result.slice(0, 2800) + "\n…[truncated]" : result;
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "🤖 AutoFlow Result", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: safe },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `*AutoFlow AI* · ${new Date().toUTCString()}` },
      ],
    },
  ];
}

/**
 * Extracts the RESULT: section from engine output, or falls back to the full text.
 */
export function extractResultForSlack(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
