/**
 * Notion integration — append engine results as a new page in a database,
 * or append a block to an existing page.
 *
 * Credentials:
 *   apiKey  = Notion Integration Token (secret_...)
 *   chatId  = Database ID or Page ID to write to
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
  };
}

/**
 * Create a new page inside a Notion database with the engine result.
 */
export async function createNotionPage(
  token: string,
  databaseId: string,
  title: string,
  content: string
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  // Notion paragraph blocks have a 2000-char limit; chunk the content
  const chunks = chunkText(content, 1900);
  const children = chunks.map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: chunk } }],
    },
  }));

  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: databaseId.replace(/-/g, "") },
        properties: {
          // Most databases have a "Name" or "Title" property
          Name: {
            title: [{ type: "text", text: { content: title.slice(0, 250) } }],
          },
        },
        children,
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (res.ok && json.id) return { ok: true, pageId: json.id };
    return { ok: false, error: json.message ?? `Notion HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Append blocks to an existing Notion page.
 */
export async function appendNotionBlocks(
  token: string,
  pageId: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const chunks = chunkText(content, 1900);
  const children = chunks.map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: chunk } }],
    },
  }));

  try {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ children }),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: (json as { message?: string }).message ?? `Notion HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unified write — if chatId looks like a database (32-char hex), create a page;
 * otherwise append blocks to the given page ID.
 */
export async function writeToNotion(
  token: string,
  targetId: string,
  title: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const cleaned = targetId.replace(/-/g, "");
  // Databases used as parent for new pages — heuristic: treated as DB if ID was passed
  // Users can choose — we always try createPage first, fall back to append
  const result = await createNotionPage(token, cleaned, title, content);
  if (result.ok) return result;
  // If create failed (e.g. it's a plain page, not a DB), try appending
  return appendNotionBlocks(token, targetId, `**${title}**\n\n${content}`);
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export function extractResultForNotion(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
