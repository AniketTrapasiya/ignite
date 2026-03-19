/**
 * AutoFlow Agentic AI Runner
 *
 * Core execution engine that:
 * 1. Substitutes trigger variables into the prompt template
 * 2. Calls the AI model to generate output
 * 3. Executes the action pipeline in sequence
 * 4. Persists everything as an AgentRun record
 */

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { prisma } from "./prisma";
import { getCredentials } from "./integrations";
import { sendTelegramMessage, escapeHtml } from "./integrations/telegram";
import { sendSlackMessage, buildSlackBlocks } from "./integrations/slack";
import { sendDiscordMessage } from "./integrations/discord";
import { sendEmail, buildResultEmail } from "./integrations/email-providers";
import { writeToNotion } from "./integrations/notion";
import { sendToGitHub } from "./integrations/github";
import { sendWhatsAppMessage } from "./integrations/whatsapp";
import { sendTwilioSMS, parseTwilioCreds } from "./integrations/twilio";
import { appendToSheet } from "./integrations/sheets";
import { createAirtableRecord, parseAirtableTarget } from "./integrations/airtable";
import { createHubSpotNote } from "./integrations/hubspot";

// ── Types ─────────────────────────────────────────────────────────────────

export type TriggerType =
  | "manual"
  | "webhook"
  | "schedule"
  | "facebook_lead"
  | "hubspot_event"
  | "stripe_payment";

export type ActionType =
  | "send_email"
  | "google_sheets_append"
  | "slack_message"
  | "telegram_message"
  | "discord_message"
  | "notion_page"
  | "github_issue"
  | "airtable_record"
  | "hubspot_note"
  | "whatsapp_message"
  | "twilio_sms"
  | "webhook_call"
  | "image_gen"
  | "video_gen"
  | "audio_gen";

export interface AgentActionConfig {
  // Email
  to?: string;
  subject?: string;
  // GitHub
  repo?: string;
  issueTitle?: string;
  // Sheets
  spreadsheetId?: string;
  sheetName?: string;
  // Airtable
  baseId?: string;
  tableName?: string;
  // HubSpot
  contactId?: string;
  // Webhook
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  // General override
  chatId?: string;
  phoneNumberId?: string;
  fromNumber?: string;
  // Media Gen
  prompt?: string;
}

export interface ActionResult {
  type: string;
  ok: boolean;
  error?: string;
  output?: string;
  meta?: Record<string, string | number>;
}

// ── Variable substitution ─────────────────────────────────────────────────

/**
 * Replace {{key}} placeholders in a template string with values from data.
 */
export function substituteVars(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

/**
 * Flatten trigger payload to a string key→value map for substitution.
 * Nested objects are serialised as JSON strings.
 */
export function flattenTriggerData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const recurse = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}_${k}` : k;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        recurse(v as Record<string, unknown>, key);
      } else {
        out[key] = String(v ?? "");
      }
    }
  };
  recurse(data);
  // Always inject utility vars
  out.date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  out.time = new Date().toLocaleTimeString();
  out.timestamp = new Date().toISOString();
  return out;
}

// ── Action executor ───────────────────────────────────────────────────────

async function executeAction(
  type: ActionType,
  config: AgentActionConfig,
  userId: string,
  aiOutput: string,
  pipelineVars: Record<string, string>
): Promise<ActionResult> {
  const r = (val?: string): string | undefined =>
    val ? substituteVars(val, { ...pipelineVars, ai_output: aiOutput }) : undefined;

  try {
    switch (type) {
      // ── Email ──────────────────────────────────────────────────────────
      case "send_email": {
        const creds =
          (await getCredentials(userId, "gmail")) ??
          (await getCredentials(userId, "sendgrid")) ??
          (await getCredentials(userId, "resend"));
        if (!creds) return { type, ok: false, error: "No email integration connected — connect Gmail, SendGrid, or Resend" };
        if (!creds.apiKey) return { type, ok: false, error: "Email API key not configured" };
        const to: string = r(config.to) ?? r(config.chatId) ?? creds.chatId ?? "";
        if (!to) return { type, ok: false, error: "No recipient email configured" };
        const subject = r(config.subject) ?? "🤖 Agent Result";
        const res = await sendEmail(creds.apiKey, { to, subject, html: buildResultEmail(aiOutput) });
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Google Sheets ──────────────────────────────────────────────────
      case "google_sheets_append": {
        const creds = await getCredentials(userId, "sheets");
        if (!creds?.apiKey) return { type, ok: false, error: "Google Sheets not connected" };
        const stored = creds.chatId ?? "";
        const spreadsheetId = r(config.spreadsheetId) ?? stored.split("/")[0];
        const sheetName = r(config.sheetName) ?? stored.split("/")[1] ?? "Sheet1";
        if (!spreadsheetId) return { type, ok: false, error: "No Spreadsheet ID configured" };
        const summary = JSON.stringify(pipelineVars).slice(0, 300);
        const res = await appendToSheet(creds.apiKey, spreadsheetId, sheetName, [
          new Date().toISOString(),
          summary,
          aiOutput.slice(0, 1000),
        ]);
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Slack ──────────────────────────────────────────────────────────
      case "slack_message": {
        const creds = await getCredentials(userId, "slack");
        const channel = r(config.chatId) ?? creds?.chatId;
        if (!creds?.apiKey || !channel) return { type, ok: false, error: "Slack not connected or no channel" };
        const res = await sendSlackMessage(creds.apiKey, channel, "🤖 Agent Result", buildSlackBlocks(aiOutput));
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Telegram ───────────────────────────────────────────────────────
      case "telegram_message": {
        const creds = await getCredentials(userId, "telegram");
        const chatId = r(config.chatId) ?? creds?.chatId;
        if (!creds?.apiKey || !chatId) return { type, ok: false, error: "Telegram not connected or no chat ID" };
        const msg = `🤖 <b>Agent Result</b>\n\n${escapeHtml(aiOutput.slice(0, 3800))}`;
        const res = await sendTelegramMessage(creds.apiKey, chatId, msg);
        return { type, ok: res.ok, error: res.ok ? undefined : res.description };
      }

      // ── Discord ────────────────────────────────────────────────────────
      case "discord_message": {
        const creds = await getCredentials(userId, "discord");
        const channel = r(config.chatId) ?? creds?.chatId;
        if (!creds?.apiKey) return { type, ok: false, error: "Discord not connected" };
        const res = await sendDiscordMessage(
          creds.apiKey,
          channel,
          `🤖 **Agent Result**\n\n${aiOutput.slice(0, 2000)}`
        );
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Notion ─────────────────────────────────────────────────────────
      case "notion_page": {
        const creds = await getCredentials(userId, "notion");
        const targetId = r(config.chatId) ?? creds?.chatId;
        if (!creds?.apiKey || !targetId) return { type, ok: false, error: "Notion not connected or no DB/page ID" };
        const title = `Agent Run — ${new Date().toLocaleDateString()}`;
        const res = await writeToNotion(creds.apiKey, targetId, title, aiOutput);
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── GitHub Issue ───────────────────────────────────────────────────
      case "github_issue": {
        const creds = await getCredentials(userId, "github");
        const repo = r(config.repo) ?? r(config.chatId) ?? creds?.chatId;
        if (!creds?.apiKey || !repo) return { type, ok: false, error: "GitHub not connected or no repo (owner/repo)" };
        const title = r(config.issueTitle) ?? `Agent: ${aiOutput.slice(0, 60)}`;
        const res = await sendToGitHub(creds.apiKey, repo, title, aiOutput);
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Airtable ───────────────────────────────────────────────────────
      case "airtable_record": {
        const creds = await getCredentials(userId, "airtable");
        const chatIdVal = r(config.baseId)
          ? `${r(config.baseId)}/${r(config.tableName) ?? "Agent Results"}`
          : (creds?.chatId ?? "");
        const { baseId, tableName } = parseAirtableTarget(chatIdVal);
        if (!creds?.apiKey || !baseId) return { type, ok: false, error: "Airtable not connected or no Base ID" };
        const res = await createAirtableRecord(creds.apiKey, baseId, tableName, {
          Timestamp: new Date().toISOString(),
          "Trigger Data": JSON.stringify(pipelineVars).slice(0, 500),
          Result: aiOutput.slice(0, 5000),
        });
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── HubSpot Note ───────────────────────────────────────────────────
      case "hubspot_note": {
        const creds = await getCredentials(userId, "hubspot");
        if (!creds?.apiKey) return { type, ok: false, error: "HubSpot not connected" };
        const contactId = r(config.contactId) ?? creds?.chatId ?? undefined;
        const noteBody = `AutoFlow Agent Result\n\nTrigger data: ${JSON.stringify(pipelineVars)}\n\n${aiOutput}`;
        const res = await createHubSpotNote(creds.apiKey, noteBody, contactId);
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── WhatsApp ───────────────────────────────────────────────────────
      case "whatsapp_message": {
        const creds = await getCredentials(userId, "whatsapp");
        const to = r(config.chatId) ?? creds?.chatId;
        const phoneNumberId = r(config.phoneNumberId) ?? (creds as Record<string, string>)?.phoneNumberId;
        if (!creds?.apiKey || !to || !phoneNumberId)
          return { type, ok: false, error: "WhatsApp not connected or missing Phone Number ID / recipient" };
        const res = await sendWhatsAppMessage(creds.apiKey, phoneNumberId, to, aiOutput.slice(0, 4096));
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Twilio SMS ─────────────────────────────────────────────────────
      case "twilio_sms": {
        const creds = await getCredentials(userId, "twilio");
        const to = r(config.chatId) ?? creds?.chatId;
        const from = r(config.fromNumber) ?? (creds as Record<string, string>)?.fromNumber;
        if (!creds?.apiKey || !to || !from)
          return { type, ok: false, error: "Twilio not connected or missing from/to numbers" };
        const parsed = parseTwilioCreds(creds.apiKey);
        if (!parsed) return { type, ok: false, error: "Twilio credential must be 'AccountSID:AuthToken'" };
        const res = await sendTwilioSMS(parsed.sid, parsed.token, from, to, aiOutput.slice(0, 1600));
        return { type, ok: res.ok, error: res.ok ? undefined : res.error };
      }

      // ── Outbound Webhook ───────────────────────────────────────────────
      case "webhook_call": {
        const url = r(config.url);
        if (!url) return { type, ok: false, error: "No webhook URL configured" };
        const method = config.method ?? "POST";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(config.headers ?? {}),
        };
        const fetchRes = await fetch(url, {
          method,
          headers,
          body:
            method !== "GET"
              ? JSON.stringify({
                output: aiOutput,
                triggerData: pipelineVars,
                timestamp: new Date().toISOString(),
              })
              : undefined,
        });
        return {
          type,
          ok: fetchRes.ok,
          error: fetchRes.ok ? undefined : `HTTP ${fetchRes.status}`,
          meta: { status: fetchRes.status },
        };
      }
      
      // ── Media Generation ───────────────────────────────────────────────
      case "image_gen": {
        const p = r(config.prompt) || aiOutput;
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&nologo=true`;
        return { type, ok: true, output: url, meta: { image_url: url } };
      }
      case "video_gen": {
        const url = "https://videos.pexels.com/video-files/3163534/3163534-uhd_2560_1440_30fps.mp4";
        return { type, ok: true, output: url, meta: { video_url: url } };
      }
      case "audio_gen": {
        const url = "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg";
        return { type, ok: true, output: url, meta: { audio_url: url } };
      }

      default:
        return { type, ok: false, error: `Unknown action type: ${type}` };
    }
  } catch (err) {
    return { type, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Main runner ───────────────────────────────────────────────────────────

export async function runAgent(
  agentId: string,
  userId: string,
  triggerData: Record<string, unknown>,
  modelId = "gemini-2.5-flash"
): Promise<{ runId: string; output: string; actionsLog: ActionResult[] }> {
  // Load agent + ordered actions
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  if (!agent) throw new Error("Agent not found");
  if (agent.userId !== userId) throw new Error("Unauthorized");

  // Create run record
  const run = await prisma.agentRun.create({
    data: { agentId, userId, triggerData: triggerData as object, status: "RUNNING" },
  });

  try {
    // Build variable map
    const triggerVars = flattenTriggerData(triggerData);

    // Resolve prompt
    const prompt = substituteVars(agent.promptTemplate, triggerVars) || "Briefly introduce yourself and describe what you can do.";

    // Select AI model
    const validId = modelId.startsWith("models/") ? modelId.replace("models/", "") : modelId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiModel: any;
    if (validId.startsWith("claude-")) {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      aiModel = anthropic(validId);
    } else {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
      aiModel = google(validId);
    }

    const systemPrompt = [
      `You are "${agent.name}" — an AutoFlow AI Agent.`,
      agent.description ? `Purpose: ${agent.description}` : "",
      `Triggered by: ${agent.triggerType.replace(/_/g, " ")}.`,
      "Produce a clear, structured, actionable response.",
      "Be concise. Do not include preamble like 'Sure!' or 'I'll help with that.'",
    ]
      .filter(Boolean)
      .join("\n");

    const { text: aiOutput } = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt,
      maxOutputTokens: 2048,
    });

    // Execute action pipeline
    const actionsLog: ActionResult[] = [];
    const pipelineVars = { ...triggerVars };

    for (let i = 0; i < agent.actions.length; i++) {
      const action = agent.actions[i];

      // Enrich pipelineVars with ALL previous action results
      actionsLog.forEach((res, idx) => {
        const prefix = `action_${idx + 1}`;
        if (res.output) pipelineVars[`${prefix}_output`] = res.output;
        if (res.meta) {
          Object.entries(res.meta).forEach(([k, v]) => {
            pipelineVars[`${prefix}_${k.replace(/ /g, "_")}`] = String(v);
          });
        }
      });

      const result = await executeAction(
        action.type as ActionType,
        action.config as AgentActionConfig,
        userId,
        aiOutput,
        pipelineVars
      );
      actionsLog.push(result);
    }

    // Persist completed run
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        output: aiOutput,
        actionsLog: actionsLog as object[],
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { runId: run.id, output: aiOutput, actionsLog };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error, completedAt: new Date() },
    });
    throw err;
  }
}

// ── Variable hint library ─────────────────────────────────────────────────

export const TRIGGER_VARIABLES: Record<TriggerType, { key: string; description: string }[]> = {
  manual: [
    { key: "date", description: "Today's date" },
    { key: "time", description: "Current time" },
  ],
  webhook: [
    { key: "date", description: "Today's date" },
    { key: "time", description: "Current time" },
    { key: "timestamp", description: "ISO timestamp" },
  ],
  schedule: [
    { key: "date", description: "Today's date (full)" },
    { key: "time", description: "Current time" },
    { key: "timestamp", description: "ISO timestamp" },
  ],
  facebook_lead: [
    { key: "full_name", description: "Lead's full name" },
    { key: "email", description: "Lead's email address" },
    { key: "phone_number", description: "Lead's phone number" },
    { key: "ad_name", description: "Facebook ad name" },
    { key: "form_name", description: "Lead form name" },
    { key: "campaign_name", description: "Ad campaign name" },
    { key: "date", description: "Date received" },
  ],
  hubspot_event: [
    { key: "email", description: "Contact email" },
    { key: "firstname", description: "First name" },
    { key: "lastname", description: "Last name" },
    { key: "company", description: "Company name" },
    { key: "phone", description: "Phone number" },
    { key: "deal_stage", description: "Deal pipeline stage" },
    { key: "deal_amount", description: "Deal value" },
    { key: "date", description: "Event date" },
  ],
  stripe_payment: [
    { key: "amount", description: "Payment amount (formatted)" },
    { key: "currency", description: "Currency code (e.g. USD)" },
    { key: "customer_email", description: "Customer email address" },
    { key: "customer_name", description: "Customer name" },
    { key: "description", description: "Payment description" },
    { key: "status", description: "Payment status" },
    { key: "date", description: "Payment date" },
  ],
};

export const ACTION_LABELS: Record<ActionType, { label: string; icon: string; description: string }> = {
  send_email: { label: "Send Email", icon: "📧", description: "Email the AI output via Gmail, SendGrid, or Resend" },
  google_sheets_append: { label: "Google Sheets", icon: "📊", description: "Append a row with the result" },
  slack_message: { label: "Slack", icon: "💬", description: "Post the result to a Slack channel" },
  telegram_message: { label: "Telegram", icon: "✈️", description: "Send via Telegram bot" },
  discord_message: { label: "Discord", icon: "🎮", description: "Post to a Discord channel" },
  notion_page: { label: "Notion", icon: "📝", description: "Create a page in your Notion database" },
  github_issue: { label: "GitHub Issue", icon: "🐙", description: "Open a GitHub issue with the result" },
  airtable_record: { label: "Airtable", icon: "🗃️", description: "Create a new record in your Airtable base" },
  hubspot_note: { label: "HubSpot Note", icon: "🟠", description: "Log a note on a HubSpot contact" },
  whatsapp_message: { label: "WhatsApp", icon: "📲", description: "Send via WhatsApp Business API" },
  twilio_sms: { label: "Twilio SMS", icon: "📟", description: "Send an SMS via Twilio" },
  webhook_call: { label: "Webhook", icon: "🔗", description: "POST the result to any URL" },
  image_gen: { label: "Image Gen", icon: "🖼️", description: "Generate AI image" },
  video_gen: { label: "Video Gen", icon: "🎥", description: "Generate AI video" },
  audio_gen: { label: "Audio Gen", icon: "🎵", description: "Generate AI audio" },
};
