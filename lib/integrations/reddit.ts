/**
 * Reddit integration — read posts, search subreddits, fetch trending.
 *
 * Credentials:
 *   apiKey = "ClientID:ClientSecret"  (Reddit app credentials)
 *   chatId = Default subreddit to monitor (e.g. "artificial" or "technology")
 *
 * Uses Reddit's OAuth2 app-only flow (no user login required).
 */

const REDDIT_API = "https://oauth.reddit.com";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  permalink: string;
  selftext?: string;
  created: number;
  author: string;
}

/**
 * Get an app-only OAuth token from Reddit.
 */
async function getRedditToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(REDDIT_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "AutoFlowAI/1.0",
      },
      body: "grant_type=client_credentials",
    });
    const json = await res.json() as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse "ClientID:ClientSecret" credential string.
 */
function parseRedditCreds(cred: string): { clientId: string; clientSecret: string } | null {
  const idx = cred.indexOf(":");
  if (idx < 0) return null;
  return { clientId: cred.slice(0, idx), clientSecret: cred.slice(idx + 1) };
}

/**
 * Search Reddit for posts matching a query.
 */
export async function searchReddit(
  credential: string,
  query: string,
  subreddit?: string,
  limit = 10
): Promise<{ ok: boolean; posts?: RedditPost[]; error?: string }> {
  const parsed = parseRedditCreds(credential);
  if (!parsed) return { ok: false, error: "Credential must be 'ClientID:ClientSecret'" };

  const token = await getRedditToken(parsed.clientId, parsed.clientSecret);
  if (!token) return { ok: false, error: "Failed to get Reddit access token" };

  try {
    const sub = subreddit ? `/r/${subreddit}` : "";
    const params = new URLSearchParams({ q: query, limit: String(limit), sort: "relevance", t: "week" });
    const res = await fetch(`${REDDIT_API}${sub}/search?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "AutoFlowAI/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Reddit HTTP ${res.status}` };
    const data = await res.json() as {
      data: { children: Array<{ data: { id: string; title: string; subreddit: string; score: number; num_comments: number; url: string; permalink: string; selftext: string; created_utc: number; author: string } }> };
    };
    const posts: RedditPost[] = data.data.children.map((c) => ({
      id: c.data.id,
      title: c.data.title,
      subreddit: c.data.subreddit,
      score: c.data.score,
      numComments: c.data.num_comments,
      url: c.data.url,
      permalink: `https://reddit.com${c.data.permalink}`,
      selftext: c.data.selftext?.slice(0, 300),
      created: c.data.created_utc,
      author: c.data.author,
    }));
    return { ok: true, posts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get hot/top posts from a subreddit.
 */
export async function getSubredditPosts(
  credential: string,
  subreddit: string,
  sort: "hot" | "top" | "new" = "hot",
  limit = 10
): Promise<{ ok: boolean; posts?: RedditPost[]; error?: string }> {
  const parsed = parseRedditCreds(credential);
  if (!parsed) return { ok: false, error: "Credential must be 'ClientID:ClientSecret'" };

  const token = await getRedditToken(parsed.clientId, parsed.clientSecret);
  if (!token) return { ok: false, error: "Failed to get Reddit access token" };

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const res = await fetch(`${REDDIT_API}/r/${subreddit}/${sort}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "AutoFlowAI/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Reddit HTTP ${res.status}` };
    const data = await res.json() as {
      data: { children: Array<{ data: { id: string; title: string; subreddit: string; score: number; num_comments: number; url: string; permalink: string; selftext: string; created_utc: number; author: string } }> };
    };
    const posts: RedditPost[] = data.data.children.map((c) => ({
      id: c.data.id, title: c.data.title, subreddit: c.data.subreddit,
      score: c.data.score, numComments: c.data.num_comments,
      url: c.data.url, permalink: `https://reddit.com${c.data.permalink}`,
      selftext: c.data.selftext?.slice(0, 300),
      created: c.data.created_utc, author: c.data.author,
    }));
    return { ok: true, posts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatRedditContext(posts: RedditPost[]): string {
  return posts
    .map((p, i) => `${i + 1}. [r/${p.subreddit}] "${p.title}" — ${p.score} upvotes, ${p.numComments} comments\n   ${p.permalink}`)
    .join("\n\n");
}
