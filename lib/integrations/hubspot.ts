/**
 * HubSpot CRM integration.
 *
 * Credentials:
 *   apiKey = HubSpot Private App Token (Bearer token)
 *   chatId = Owner Email or Contact ID to associate notes with (optional)
 *
 * Engine results are saved as CRM Notes (Engagements) in HubSpot.
 */

const HS_API = "https://api.hubapi.com";

/**
 * Create a note (engagement) in HubSpot.
 * If contactId is provided, associate the note with that contact.
 */
export async function createHubSpotNote(
  token: string,
  noteBody: string,
  contactId?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const safeBody = noteBody.length > 65000 ? noteBody.slice(0, 65000) + "\n…[truncated]" : noteBody;

  try {
    // Use the CRM Notes API (v3 objects)
    const properties: Record<string, string> = {
      hs_note_body: safeBody,
      hs_timestamp: new Date().toISOString(),
    };

    const body: Record<string, unknown> = { properties };
    if (contactId) {
      body.associations = [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ];
    }

    const res = await fetch(`${HS_API}/crm/v3/objects/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as { id?: string; message?: string };
    if (res.ok && json.id) return { ok: true, id: json.id };
    return { ok: false, error: json.message ?? `HubSpot HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Create a contact in HubSpot.
 */
export async function createHubSpotContact(
  token: string,
  email: string,
  properties: Record<string, string> = {}
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ properties: { email, ...properties } }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (res.ok && json.id) return { ok: true, id: json.id };
    return { ok: false, error: json.message ?? `HubSpot HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function extractResultForHubSpot(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
