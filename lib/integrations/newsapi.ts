/**
 * News API integration (newsapi.org).
 *
 * Credentials:
 *   apiKey = News API Key
 *
 * Used as a data enrichment source — inject live news into engine context.
 */

const NEWS_API = "https://newsapi.org/v2";

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  author?: string;
}

/**
 * Search news articles by query.
 */
export async function searchNews(
  apiKey: string,
  query: string,
  pageSize = 5
): Promise<{ ok: boolean; articles?: NewsArticle[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      q: query,
      pageSize: String(pageSize),
      sortBy: "publishedAt",
      language: "en",
      apiKey,
    });
    const res = await fetch(`${NEWS_API}/everything?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { message?: string }).message ?? `NewsAPI HTTP ${res.status}` };
    }
    const data = await res.json() as {
      articles: Array<{
        title: string;
        description: string;
        url: string;
        source: { name: string };
        publishedAt: string;
        author: string;
      }>;
    };
    const articles: NewsArticle[] = (data.articles ?? []).map((a) => ({
      title: a.title,
      description: a.description ?? "",
      url: a.url,
      source: a.source?.name ?? "Unknown",
      publishedAt: a.publishedAt,
      author: a.author,
    }));
    return { ok: true, articles };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get top headlines by category or country.
 */
export async function getTopHeadlines(
  apiKey: string,
  options: { country?: string; category?: string; pageSize?: number } = {}
): Promise<{ ok: boolean; articles?: NewsArticle[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      country: options.country ?? "us",
      pageSize: String(options.pageSize ?? 5),
      apiKey,
    });
    if (options.category) params.set("category", options.category);

    const res = await fetch(`${NEWS_API}/top-headlines?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { message?: string }).message ?? `NewsAPI HTTP ${res.status}` };
    }
    const data = await res.json() as {
      articles: Array<{ title: string; description: string; url: string; source: { name: string }; publishedAt: string; author: string }>;
    };
    const articles: NewsArticle[] = (data.articles ?? []).map((a) => ({
      title: a.title,
      description: a.description ?? "",
      url: a.url,
      source: a.source?.name ?? "Unknown",
      publishedAt: a.publishedAt,
      author: a.author,
    }));
    return { ok: true, articles };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Format articles as text context for the engine.
 */
export function formatNewsContext(articles: NewsArticle[]): string {
  return articles
    .map(
      (a, i) =>
        `${i + 1}. ${a.title} [${a.source}]\n   ${a.description}\n   ${a.url}`
    )
    .join("\n\n");
}
