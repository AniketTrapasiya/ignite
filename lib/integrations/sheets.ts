/**
 * Google Sheets integration via Google Sheets API v4.
 *
 * Credentials:
 *   apiKey      = Google API Key (for public sheets) OR
 *                 Service Account JSON (stringified, for private sheets)
 *   chatId      = Spreadsheet ID (from the sheet URL)
 *   sheetName   = Sheet/Tab name (default: "Sheet1")
 *
 * Engine results are appended as a new row: [timestamp, prompt_summary, result]
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Append a row to a Google Sheet.
 * Uses a Service Account JSON key for auth.
 */
export async function appendToSheet(
  serviceAccountJson: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<{ ok: boolean; updatedRows?: number; error?: string }> {
  try {
    // Build a simple JWT for Google API — requires service account
    const sa = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };

    const token = await getGoogleAccessToken(sa.client_email, sa.private_key, [
      "https://www.googleapis.com/auth/spreadsheets",
    ]);
    if (!token) return { ok: false, error: "Failed to obtain Google access token" };

    const range = `${sheetName}!A1`;
    const res = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ values: [values] }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: (err as { error?: { message: string } }).error?.message ?? `Sheets HTTP ${res.status}`,
      };
    }
    const data = await res.json() as { updates?: { updatedRows: number } };
    return { ok: true, updatedRows: data.updates?.updatedRows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Minimal Google JWT / access token via the token endpoint.
 * Uses RS256 signing via the Web Crypto API available in Node.js 18+.
 */
async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
  scopes: string[]
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: scopes.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    ).toString("base64url");

    const signingInput = `${header}.${payload}`;

    // Import PEM private key
    const pemBody = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "");
    const keyBuffer = Buffer.from(pemBody, "base64");

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await globalThis.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      Buffer.from(signingInput)
    );

    const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    return tokenData.access_token ?? null;
  } catch {
    return null;
  }
}

export function extractResultForSheets(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
