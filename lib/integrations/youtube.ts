/**
 * YouTube Data API v3 integration.
 *
 * Credentials:
 *   apiKey = YouTube Data API v3 Key
 *
 * Used as a data enrichment source — fetch context before the engine runs.
 */

const YT_API = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  viewCount?: string;
  publishedAt: string;
  url: string;
}

/**
 * Search YouTube videos by query.
 */
export async function searchYouTube(
  apiKey: string,
  query: string,
  maxResults = 5
): Promise<{ ok: boolean; videos?: YouTubeVideo[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      maxResults: String(maxResults),
      type: "video",
      order: "relevance",
      key: apiKey,
    });
    const res = await fetch(`${YT_API}/search?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: { message: string } }).error?.message ?? `YouTube HTTP ${res.status}` };
    }
    const data = await res.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          description: string;
          publishedAt: string;
        };
      }>;
    };

    // Fetch stats for view count
    const ids = data.items.map((i) => i.id.videoId).join(",");
    const statsParams = new URLSearchParams({ part: "statistics", id: ids, key: apiKey });
    const statsRes = await fetch(`${YT_API}/videos?${statsParams}`, { cache: "no-store" });
    const statsData = statsRes.ok
      ? (await statsRes.json() as { items: Array<{ id: string; statistics: { viewCount: string } }> })
      : null;
    const statsMap = Object.fromEntries(
      (statsData?.items ?? []).map((i) => [i.id, i.statistics?.viewCount])
    );

    const videos: YouTubeVideo[] = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description.slice(0, 200),
      viewCount: statsMap[item.id.videoId],
      publishedAt: item.snippet.publishedAt,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
    }));

    return { ok: true, videos };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetch trending videos in a given region.
 */
export async function getTrendingYouTube(
  apiKey: string,
  regionCode = "US",
  maxResults = 5
): Promise<{ ok: boolean; videos?: YouTubeVideo[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode,
      maxResults: String(maxResults),
      key: apiKey,
    });
    const res = await fetch(`${YT_API}/videos?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: { message: string } }).error?.message ?? `YouTube HTTP ${res.status}` };
    }
    const data = await res.json() as {
      items: Array<{
        id: string;
        snippet: { title: string; channelTitle: string; description: string; publishedAt: string };
        statistics: { viewCount: string };
      }>;
    };

    const videos: YouTubeVideo[] = data.items.map((item) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description.slice(0, 200),
      viewCount: item.statistics?.viewCount,
      publishedAt: item.snippet.publishedAt,
      url: `https://youtube.com/watch?v=${item.id}`,
    }));

    return { ok: true, videos };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Format YouTube results as a markdown/text block for engine context.
 */
export function formatYouTubeContext(videos: YouTubeVideo[]): string {
  return videos
    .map(
      (v, i) =>
        `${i + 1}. "${v.title}" by ${v.channelTitle}${v.viewCount ? ` (${Number(v.viewCount).toLocaleString()} views)` : ""}\n   ${v.url}\n   ${v.description}`
    )
    .join("\n\n");
}
