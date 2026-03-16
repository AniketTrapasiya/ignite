/**
 * Airtable integration.
 *
 * Credentials:
 *   apiKey    = Airtable Personal Access Token
 *   chatId    = Base ID (appXXXXXXXXXXXXXX) or "baseId/TableName"
 *
 * Engine results are saved as new records in the specified table.
 * Default table: "AutoFlow Results"
 */

const AIRTABLE_API = "https://api.airtable.com/v0";

/**
 * Create a new record in an Airtable table.
 */
export async function createAirtableRecord(
  token: string,
  baseId: string,
  tableName: string,
  fields: Record<string, string | number | boolean>
): Promise<{ ok: boolean; recordId?: string; error?: string }> {
  try {
    const res = await fetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } | string };
    if (res.ok && (json as { id?: string }).id) return { ok: true, recordId: (json as { id: string }).id };
    const errStr = typeof json.error === "string" ? json.error : json.error?.message ?? `Airtable HTTP ${res.status}`;
    return { ok: false, error: errStr };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse chatId which can be "baseId" or "baseId/TableName".
 */
export function parseAirtableTarget(chatId: string): { baseId: string; tableName: string } {
  const [baseId, ...rest] = chatId.split("/");
  return { baseId, tableName: rest.join("/") || "AutoFlow Results" };
}

export function extractResultForAirtable(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
