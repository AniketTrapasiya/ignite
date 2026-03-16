/**
 * Meta Ads (Facebook Marketing API) integration.
 *
 * Credentials:
 *   apiKey   = Meta Personal Access Token (or System User Token)
 *   chatId   = Ad Account ID (act_XXXXXXXXXXXXXXXXX)
 *
 * Supports: reading campaigns, ad sets, ads, insights.
 * All operations are read-only by default for safety.
 */

const META_GRAPH = "https://graph.facebook.com/v19.0";

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaInsight {
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  reach: string;
  date_start: string;
  date_stop: string;
}

/**
 * List campaigns for an ad account.
 */
export async function listMetaCampaigns(
  accessToken: string,
  adAccountId: string,
  limit = 10
): Promise<{ ok: boolean; campaigns?: MetaCampaign[]; error?: string }> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const params = new URLSearchParams({
      fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
      limit: String(limit),
      access_token: accessToken,
    });
    const res = await fetch(`${META_GRAPH}/${accountId}/campaigns?${params}`, { cache: "no-store" });
    const json = await res.json() as {
      data?: MetaCampaign[];
      error?: { message: string };
    };
    if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? `Meta HTTP ${res.status}` };
    return { ok: true, campaigns: json.data ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get campaign insights (performance metrics) for a date range.
 */
export async function getMetaInsights(
  accessToken: string,
  adAccountId: string,
  datePreset: "today" | "yesterday" | "last_7d" | "last_30d" | "this_month" = "last_7d"
): Promise<{ ok: boolean; insights?: MetaInsight[]; error?: string }> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const params = new URLSearchParams({
      fields: "campaign_name,impressions,clicks,spend,ctr,cpc,reach",
      date_preset: datePreset,
      level: "campaign",
      access_token: accessToken,
    });
    const res = await fetch(`${META_GRAPH}/${accountId}/insights?${params}`, { cache: "no-store" });
    const json = await res.json() as {
      data?: MetaInsight[];
      error?: { message: string };
    };
    if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? `Meta HTTP ${res.status}` };
    return { ok: true, insights: json.data ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Format campaigns as context text for the engine.
 */
export function formatMetaAdsContext(campaigns: MetaCampaign[], insights: MetaInsight[]): string {
  const insightMap = Object.fromEntries(insights.map((i) => [i.campaign_name, i]));
  return campaigns.map((c) => {
    const ins = insightMap[c.name];
    return [
      `Campaign: ${c.name} [${c.status}]`,
      `  Objective: ${c.objective}`,
      ins ? `  Impressions: ${Number(ins.impressions).toLocaleString()} | Clicks: ${Number(ins.clicks).toLocaleString()} | Spend: $${ins.spend} | CTR: ${ins.ctr}%` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");
}

export function extractResultForMetaAds(engineOutput: string): string {
  const match = engineOutput.match(/RESULT:\s*([\s\S]+)$/);
  return match ? match[1].trim() : engineOutput.trim();
}
