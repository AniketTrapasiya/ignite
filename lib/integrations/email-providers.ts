/**
 * Email delivery integrations:
 *  - SendGrid  (apiKey = SG.xxx)
 *  - Resend    (apiKey = re_xxx)
 *  - Gmail     (apiKey = app-password, stored as "user@gmail.com:app-password")
 *
 * All expose a unified `sendEmail()` that auto-detects the provider.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// ── SendGrid ────────────────────────────────────────────────────────────────
export async function sendViaSendGrid(
  apiKey: string,
  payload: EmailPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: payload.from ?? "noreply@autoflow.ai" },
        subject: payload.subject,
        content: [{ type: "text/html", value: payload.html }],
      }),
    });
    if (res.status === 202) return { ok: true };
    const text = await res.text();
    return { ok: false, error: `SendGrid HTTP ${res.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Resend ──────────────────────────────────────────────────────────────────
export async function sendViaResend(
  apiKey: string,
  payload: EmailPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: payload.from ?? "AutoFlow AI <noreply@autoflow.ai>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return {
      ok: false,
      error: (json as { message?: string }).message ?? `Resend HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Gmail via SMTP (Nodemailer) ─────────────────────────────────────────────
// apiKey format: "user@gmail.com:app-password"
export async function sendViaGmail(
  credential: string,
  payload: EmailPayload
): Promise<{ ok: boolean; error?: string }> {
  const [user, ...passParts] = credential.split(":");
  const pass = passParts.join(":");
  if (!user || !pass) {
    return { ok: false, error: "Gmail credential must be 'user@gmail.com:app-password'" };
  }
  try {
    // Dynamically import nodemailer so it only loads on the server
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: payload.from ?? `AutoFlow AI <${user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unified send — auto-detects provider from the apiKey prefix.
 * SendGrid  → starts with "SG."
 * Resend    → starts with "re_"
 * Gmail     → contains "@gmail.com:"
 */
export async function sendEmail(
  apiKey: string,
  payload: EmailPayload
): Promise<{ ok: boolean; error?: string }> {
  if (apiKey.startsWith("SG.")) return sendViaSendGrid(apiKey, payload);
  if (apiKey.startsWith("re_")) return sendViaResend(apiKey, payload);
  if (apiKey.toLowerCase().includes("@gmail.com:")) return sendViaGmail(apiKey, payload);
  return { ok: false, error: "Unknown email provider. Key must start with SG. (SendGrid), re_ (Resend), or be user@gmail.com:password." };
}

/**
 * Build a clean HTML email body from engine result text.
 */
export function buildResultEmail(result: string): string {
  const escaped = result
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
  <h2 style="color:#111827;margin-bottom:4px;">🤖 AutoFlow Result</h2>
  <p style="color:#6b7280;font-size:13px;margin-top:0;">${new Date().toUTCString()}</p>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;margin-top:16px;color:#374151;font-size:14px;line-height:1.7;">
    ${escaped}
  </div>
  <p style="color:#9ca3af;font-size:11px;margin-top:16px;text-align:center;">Sent by AutoFlow AI</p>
</div>`;
}

export function extractResultForEmail(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
