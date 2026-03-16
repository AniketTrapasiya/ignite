/**
 * GitHub integration — create issues or add comments from engine results.
 *
 * Credentials:
 *   apiKey  = GitHub Personal Access Token
 *   chatId  = owner/repo  (e.g. "acme/my-repo")
 */

const GITHUB_API = "https://api.github.com";

function ghHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Create a new GitHub issue with the engine result as body.
 */
export async function createGitHubIssue(
  token: string,
  repo: string, // "owner/repo"
  title: string,
  body: string,
  labels: string[] = ["autoflow"]
): Promise<{ ok: boolean; url?: string; error?: string }> {
  // GitHub issue body limit is 65536 chars
  const safeBody = body.length > 65000 ? body.slice(0, 65000) + "\n\n…[truncated]" : body;
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({ title: title.slice(0, 256), body: safeBody, labels }),
    });
    const json = (await res.json()) as { html_url?: string; message?: string };
    if (res.ok && json.html_url) return { ok: true, url: json.html_url };
    return { ok: false, error: json.message ?? `GitHub HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Add a comment to an existing GitHub issue.
 * @param issueNumber  - The issue number to comment on
 */
export async function addGitHubComment(
  token: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const safeBody = body.length > 65000 ? body.slice(0, 65000) + "\n\n…[truncated]" : body;
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: ghHeaders(token),
        body: JSON.stringify({ body: safeBody }),
      }
    );
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: (json as { message?: string }).message ?? `GitHub HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unified — creates a new issue in the configured repo.
 * chatId format: "owner/repo"
 */
export async function sendToGitHub(
  token: string,
  repo: string,
  title: string,
  body: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  return createGitHubIssue(token, repo, title, `> AutoFlow AI Result\n\n${body}`);
}

export function extractResultForGitHub(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
