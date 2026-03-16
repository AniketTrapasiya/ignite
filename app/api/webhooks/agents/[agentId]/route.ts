/**
 * Webhook Trigger Endpoint for AutoFlow Agents
 *
 * URL:        POST /api/webhooks/agents/[agentId]
 * Auth:       Optional X-Agent-Secret header (set in agent's triggerConfig.secret)
 * Body:       Any JSON — automatically becomes trigger variables
 *
 * Facebook Lead Ads: Subscribe to this URL in your Facebook App > Webhooks.
 *   GET  — Facebook challenge verification (hub.mode, hub.verify_token, hub.challenge)
 *   POST — Facebook sends lead data here
 *
 * HubSpot Workflows: Add this URL as a webhook action in a HubSpot workflow.
 * Stripe:            Add this URL in Stripe Dashboard > Webhooks.
 * Any service:       Just POST JSON to this URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/agent-runner";

export const maxDuration = 60;

// ── GET: Generic challenge verification (Facebook Lead Ads, etc.) ─────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const { searchParams } = new URL(request.url);

  // Facebook-style hub verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, triggerConfig: true },
    });
    if (!agent) return new NextResponse("Agent not found", { status: 404 });

    const config = agent.triggerConfig as Record<string, string>;
    if (config.secret && config.secret !== token) {
      return new NextResponse("Verification token mismatch", { status: 403 });
    }
    // Return challenge as plain text to complete verification
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("OK", { status: 200 });
}

// ── POST: Receive event and trigger agent ─────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, userId: true, status: true, triggerConfig: true, triggerType: true },
  });

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (agent.status !== "ACTIVE") {
    return NextResponse.json({ error: "Agent is not active" }, { status: 409 });
  }

  // Optional secret validation
  const config = agent.triggerConfig as Record<string, string>;
  if (config.secret) {
    const incoming =
      request.headers.get("x-agent-secret") ??
      request.headers.get("x-hub-signature-256") ??
      "";
    // For simple secret check (full HMAC validation can be added per-service)
    if (incoming !== config.secret && !incoming.startsWith("sha256=")) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
  }

  // Parse body
  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      for (const pair of text.split("&")) {
        const [k, v] = pair.split("=");
        if (k) body[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
      }
    }
  } catch {
    // Empty body — ok for manual-style webhook pings
  }

  // Normalize Facebook Lead Ads payload
  if (agent.triggerType === "facebook_lead") {
    body = normalizeFacebookLead(body);
  }

  // Normalize Stripe payment payload
  if (agent.triggerType === "stripe_payment") {
    body = normalizeStripePayment(body);
  }

  // Run agent asynchronously — respond immediately so the webhook caller doesn't timeout
  runAgent(agentId, agent.userId, body).catch((err) =>
    console.error(`[AgentWebhook] Agent ${agentId} run failed:`, err)
  );

  return NextResponse.json({ ok: true, agentId, queued: true });
}

// ── Payload normalizers ───────────────────────────────────────────────────

function normalizeFacebookLead(raw: Record<string, unknown>): Record<string, unknown> {
  try {
    // Facebook sends nested: entry[0].changes[0].value.leadgen_id + field_data
    const entries = (raw.entry as Array<{
      changes: Array<{
        value: {
          leadgen_id?: string;
          ad_name?: string;
          form_name?: string;
          campaign_name?: string;
          field_data?: Array<{ name: string; values: string[] }>;
        };
      }>;
    }>) ?? [];

    const change = entries[0]?.changes?.[0]?.value;
    if (!change) return raw;

    const normalized: Record<string, unknown> = {
      leadgen_id: change.leadgen_id,
      ad_name: change.ad_name,
      form_name: change.form_name,
      campaign_name: change.campaign_name,
    };
    for (const field of change.field_data ?? []) {
      normalized[field.name] = field.values?.[0] ?? "";
    }
    return { ...normalized, _raw: raw };
  } catch {
    return raw;
  }
}

function normalizeStripePayment(raw: Record<string, unknown>): Record<string, unknown> {
  try {
    const obj = (raw.data as { object?: Record<string, unknown> })?.object ?? raw;
    return {
      amount: `${((obj.amount as number) ?? 0) / 100} ${String(obj.currency ?? "usd").toUpperCase()}`,
      currency: String(obj.currency ?? "usd").toUpperCase(),
      customer_email: (obj.billing_details as { email?: string })?.email ?? obj.receipt_email ?? "",
      customer_name: (obj.billing_details as { name?: string })?.name ?? "",
      description: obj.description ?? "",
      status: obj.status ?? "",
      payment_id: obj.id ?? "",
      _raw: raw,
    };
  } catch {
    return raw;
  }
}
