import { tavily } from "@tavily/core";

/**
 * Fetches the daily news to populate the agent's context window.
 * This simulates the agent "reading the news" when waking up.
 */
export const fetchDailyNews = async (topic: string = "tech and gaming") => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ TAVILY_API_KEY not found. Returning mock news for context layer.");
    return [
      { title: "AI Digital Twin Launched", content: "A new autonomous agent aims to spread positivity online 24/7." },
      { title: "Next-Gen Gaming Engine", content: "New Unreal Engine update optimizes graphics for live streaming." }
    ];
  }

  try {
    const tvly = tavily({ apiKey });
    const response = await tvly.search(topic, {
      searchDepth: "basic",
      includeAnswer: false,
      maxResults: 3 // Keep small to avoid LLM context overflow
    });

    return response.results.map(r => ({
      title: r.title,
      content: r.content.substring(0, 150) + '...' // truncate heavily for summary
    }));
  } catch (error) {
    console.error("❌ News fetch error (MCP Tool Failed):", error);
    return [];
  }
};
