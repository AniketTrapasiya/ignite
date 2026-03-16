/**
 * Twilio integration — send SMS.
 *
 * Credentials (all stored by user in the integrations UI):
 *   apiKey     = "AccountSID:AuthToken"  (colon-separated)
 *   fromNumber = Your Twilio phone number (E.164, e.g. +14155552671)
 *   chatId     = Recipient phone number (E.164, e.g. +919876543210)
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * Send an SMS via Twilio REST API.
 */
export async function sendTwilioSMS(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  // SMS has a 1600-char limit (Twilio merges long SMS)
  const safeBody = body.length > 1500 ? body.slice(0, 1500) + "…[truncated]" : body;

  const params = new URLSearchParams({ From: from, To: to, Body: safeBody });
  const authHeader =
    "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const res = await fetch(
      `${TWILIO_API}/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: params.toString(),
      }
    );
    const json = (await res.json()) as { sid?: string; message?: string; error_message?: string };
    if (res.ok && json.sid) return { ok: true, sid: json.sid };
    return {
      ok: false,
      error: json.message ?? json.error_message ?? `Twilio HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse an "AccountSID:AuthToken" credential string.
 */
export function parseTwilioCreds(cred: string): { sid: string; token: string } | null {
  const parts = cred.split(":");
  if (parts.length < 2) return null;
  const sid = parts[0].trim();
  const token = parts.slice(1).join(":").trim();
  return sid && token ? { sid, token } : null;
}

export function extractResultForTwilio(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
