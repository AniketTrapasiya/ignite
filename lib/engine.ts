import { streamText, stepCountIs } from "ai";
import { prisma } from "./prisma";
import { resolveTextModel } from "./providers";
import { agentTools } from "./agent-tools";
import { formatMemoriesForPrompt, searchMemories } from "./memory";
import { buildModsContext, getActiveServices, getCredentials } from "./integrations";
import { sendTelegramMessage, extractResultForTelegram, escapeHtml } from "./integrations/telegram";
import { sendSlackMessage, buildSlackBlocks, extractResultForSlack } from "./integrations/slack";
import { sendDiscordMessage, extractResultForDiscord } from "./integrations/discord";
import { sendEmail, buildResultEmail, extractResultForEmail } from "./integrations/email-providers";
import { writeToNotion, extractResultForNotion } from "./integrations/notion";
import { sendToGitHub, extractResultForGitHub } from "./integrations/github";
import { sendWhatsAppMessage, extractResultForWhatsApp } from "./integrations/whatsapp";
import { sendTwilioSMS, parseTwilioCreds, extractResultForTwilio } from "./integrations/twilio";
import { appendToSheet, extractResultForSheets } from "./integrations/sheets";
import { createAirtableRecord, parseAirtableTarget, extractResultForAirtable } from "./integrations/airtable";
import { createHubSpotNote, extractResultForHubSpot } from "./integrations/hubspot";

const SYSTEM_PROMPT = `You are AutoFlow — an intelligent automation engine.
You are powerful, precise, and execution-focused.
When given a task you:
1. Break it into clear numbered steps
2. Execute each step using the available tools when real data is needed
3. Log every action with prefix: STEP: your message
4. When complete output: RESULT: final summary
5. If an error occurs output: ERROR: what failed and why

You have access to the following TOOLS — use them proactively:
- webSearch: search the web for real-time information
- httpRequest: call any REST API or webhook
- extractPage: fetch and read a webpage
- getCurrentTime: get the current date/time
- parseJson: parse and extract fields from JSON
- evaluateExpression: run safe math or string calculations
- summarizeText: extract key points from long content

IMPORTANT: Any integrations listed below (e.g. Telegram, Slack, Gmail) are BACKEND OUTPUT CHANNELS.
They are triggered automatically by the system after your RESULT is produced — you do NOT call them yourself.
Do NOT attempt to invoke any integration as a tool. Do NOT output errors about missing tools.
Just complete your task and write your RESULT. The system handles delivery.

Be thorough but concise. Think like an automation engineer.`;

export async function runEngine(
  userId: string,
  prompt: string,
  selectedMemoryIds: string[],
  selectedMods: string[],
  modelId = "gemini-2.0-flash",
  mediaContext?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ runId: string; stream: any }> {
  // Load selected memories — fail gracefully if DB is down
  let memories: Awaited<ReturnType<typeof searchMemories>> = [];
  try {
    const allMemories = await searchMemories(userId, prompt, 5);
    memories = selectedMemoryIds.length > 0
      ? allMemories.filter((m) => selectedMemoryIds.includes(m.id))
      : allMemories.slice(0, 3);
  } catch {
    // Continue without memories if DB is unavailable
  }

  // Load active mods — fail gracefully
  let activeServices: string[] = selectedMods;
  try {
    if (selectedMods.length === 0) {
      activeServices = await getActiveServices(userId);
    }
  } catch {
    // Continue without mods if DB is unavailable
  }

  // Build context
  const memoryContext = formatMemoriesForPrompt(memories);
  const modsContext = buildModsContext(activeServices);

  const fullSystemPrompt = [SYSTEM_PROMPT, memoryContext, modsContext]
    .filter(Boolean)
    .join("\n\n");

  const fullPrompt = mediaContext
    ? `${prompt}\n\n[MEDIA CONTEXT]\n${mediaContext}`
    : prompt;

  // Create run record — optional, continue if DB is down
  let runId = `local-${Date.now()}`;
  try {
    const run = await prisma.engineRun.create({
      data: {
        userId,
        prompt,
        memories: memories.map((m) => m.id),
        mods: activeServices,
        status: "RUNNING",
      },
    });
    runId = run.id;
  } catch {
    // DB not available — run without persistence
  }

  // Resolve AI model from user's stored credentials or env fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiModel: any;
  try {
    aiModel = await resolveTextModel(userId, modelId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to resolve AI provider");
  }

  const stream = streamText({
    model: aiModel,
    system: fullSystemPrompt,
    prompt: fullPrompt,
    maxOutputTokens: 4096,
    tools: agentTools,
    stopWhen: stepCountIs(15),
    onFinish: async ({ text }) => {
      // Persist run output
      try {
        if (!runId.startsWith("local-")) {
          await prisma.engineRun.update({
            where: { id: runId },
            data: { output: text, status: "COMPLETED" },
          });
        }
      } catch {
        // Ignore DB update failure
      }

      // ── Telegram ──────────────────────────────────────────────────────────
      if (activeServices.includes("telegram")) {
        try {
          const creds = await getCredentials(userId, "telegram");
          if (creds?.apiKey && creds?.chatId) {
            const message = escapeHtml(extractResultForTelegram(text));
            const result = await sendTelegramMessage(
              creds.apiKey,
              creds.chatId,
              `🤖 AutoFlow Result\n\n${message}`
            );
            if (!result.ok) console.error("[Telegram] Failed:", result.description);
          } else {
            console.warn("[Telegram] Incomplete credentials");
          }
        } catch (err) {
          console.error("[Telegram] Error:", err);
        }
      }

      // ── Slack ────────────────────────────────────────────────────────────
      if (activeServices.includes("slack")) {
        try {
          const creds = await getCredentials(userId, "slack");
          if (creds?.apiKey && creds?.chatId) {
            const result = extractResultForSlack(text);
            const res = await sendSlackMessage(
              creds.apiKey,
              creds.chatId,
              `🤖 AutoFlow Result`,
              buildSlackBlocks(result)
            );
            if (!res.ok) console.error("[Slack] Failed:", res.error);
          } else {
            console.warn("[Slack] Incomplete credentials");
          }
        } catch (err) {
          console.error("[Slack] Error:", err);
        }
      }

      // ── Discord ──────────────────────────────────────────────────────────
      if (activeServices.includes("discord")) {
        try {
          const creds = await getCredentials(userId, "discord");
          if (creds?.apiKey) {
            const result = extractResultForDiscord(text);
            const res = await sendDiscordMessage(
              creds.apiKey,
              creds.chatId,
              `🤖 **AutoFlow Result**\n\n${result}`
            );
            if (!res.ok) console.error("[Discord] Failed:", res.error);
          } else {
            console.warn("[Discord] Incomplete credentials");
          }
        } catch (err) {
          console.error("[Discord] Error:", err);
        }
      }

      // ── Gmail / SendGrid / Resend ─────────────────────────────────────────
      for (const service of ["gmail", "sendgrid", "resend"] as const) {
        if (activeServices.includes(service)) {
          try {
            const creds = await getCredentials(userId, service);
            if (creds?.apiKey && creds?.chatId) {
              const result = extractResultForEmail(text);
              const res = await sendEmail(creds.apiKey, {
                to: creds.chatId,                  // chatId = recipient email
                subject: "🤖 AutoFlow Result",
                html: buildResultEmail(result),
              });
              if (!res.ok) console.error(`[${service}] Failed:`, res.error);
            } else {
              console.warn(`[${service}] Incomplete credentials`);
            }
          } catch (err) {
            console.error(`[${service}] Error:`, err);
          }
        }
      }

      // ── Notion ───────────────────────────────────────────────────────────
      if (activeServices.includes("notion")) {
        try {
          const creds = await getCredentials(userId, "notion");
          if (creds?.apiKey && creds?.chatId) {
            const result = extractResultForNotion(text);
            const title = `AutoFlow: ${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}`;
            const res = await writeToNotion(creds.apiKey, creds.chatId, title, result);
            if (!res.ok) console.error("[Notion] Failed:", res.error);
          } else {
            console.warn("[Notion] Incomplete credentials");
          }
        } catch (err) {
          console.error("[Notion] Error:", err);
        }
      }

      // ── GitHub ───────────────────────────────────────────────────────────
      if (activeServices.includes("github")) {
        try {
          const creds = await getCredentials(userId, "github");
          if (creds?.apiKey && creds?.chatId) {
            const result = extractResultForGitHub(text);
            const title = `AutoFlow: ${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}`;
            const res = await sendToGitHub(creds.apiKey, creds.chatId, title, result);
            if (!res.ok) console.error("[GitHub] Failed:", res.error);
          } else {
            console.warn("[GitHub] Incomplete credentials — apiKey + chatId (owner/repo) required");
          }
        } catch (err) {
          console.error("[GitHub] Error:", err);
        }
      }

      // ── WhatsApp ─────────────────────────────────────────────────────────
      if (activeServices.includes("whatsapp")) {
        try {
          const creds = await getCredentials(userId, "whatsapp");
          if (creds?.apiKey && creds?.phoneNumberId && creds?.chatId) {
            const result = extractResultForWhatsApp(text);
            const res = await sendWhatsAppMessage(
              creds.apiKey,
              creds.phoneNumberId,
              creds.chatId,
              `🤖 AutoFlow Result\n\n${result}`
            );
            if (!res.ok) console.error("[WhatsApp] Failed:", res.error);
          } else {
            console.warn("[WhatsApp] Incomplete — needs Access Token, Phone Number ID, and Recipient Phone in credentials");
          }
        } catch (err) {
          console.error("[WhatsApp] Error:", err);
        }
      }

      // ── Twilio SMS ───────────────────────────────────────────────────────
      if (activeServices.includes("twilio")) {
        try {
          const creds = await getCredentials(userId, "twilio");
          if (creds?.apiKey && creds?.fromNumber && creds?.chatId) {
            const parsed = parseTwilioCreds(creds.apiKey);
            if (parsed) {
              const result = extractResultForTwilio(text);
              const res = await sendTwilioSMS(
                parsed.sid,
                parsed.token,
                creds.fromNumber,
                creds.chatId,
                `AutoFlow Result:\n\n${result}`
              );
              if (!res.ok) console.error("[Twilio] Failed:", res.error);
            } else {
              console.warn("[Twilio] apiKey must be 'AccountSID:AuthToken'");
            }
          } else {
            console.warn("[Twilio] Incomplete — needs Account SID:Auth Token, Your Twilio Number, and Recipient Phone in credentials");
          }
        } catch (err) {
          console.error("[Twilio] Error:", err);
        }
      }

      // ── Google Sheets ────────────────────────────────────────────────────
      if (activeServices.includes("sheets")) {
        try {
          const creds = await getCredentials(userId, "sheets");
          if (creds?.apiKey && creds?.chatId) {
            const result = extractResultForSheets(text);
            const idx = creds.chatId.indexOf("/");
            const spreadsheetId = idx > 0 ? creds.chatId.slice(0, idx) : creds.chatId;
            const sheetName = idx > 0 ? creds.chatId.slice(idx + 1) : "Sheet1";
            const res = await appendToSheet(creds.apiKey, spreadsheetId, sheetName, [
              new Date().toISOString(),
              prompt.slice(0, 200),
              result.slice(0, 1000),
            ]);
            if (!res.ok) console.error("[Sheets] Failed:", res.error);
          } else {
            console.warn("[Sheets] Incomplete — needs Service Account JSON and Spreadsheet ID in credentials");
          }
        } catch (err) {
          console.error("[Sheets] Error:", err);
        }
      }

      // ── Airtable ─────────────────────────────────────────────────────────
      if (activeServices.includes("airtable")) {
        try {
          const creds = await getCredentials(userId, "airtable");
          if (creds?.apiKey && creds?.chatId) {
            const result = extractResultForAirtable(text);
            const { baseId, tableName } = parseAirtableTarget(creds.chatId);
            const res = await createAirtableRecord(creds.apiKey, baseId, tableName, {
              Timestamp: new Date().toISOString(),
              Prompt: prompt.slice(0, 500),
              Result: result.slice(0, 5000),
            });
            if (!res.ok) console.error("[Airtable] Failed:", res.error);
          } else {
            console.warn("[Airtable] Incomplete — needs Personal Access Token and Base ID in credentials");
          }
        } catch (err) {
          console.error("[Airtable] Error:", err);
        }
      }

      // ── HubSpot ──────────────────────────────────────────────────────────
      if (activeServices.includes("hubspot")) {
        try {
          const creds = await getCredentials(userId, "hubspot");
          if (creds?.apiKey) {
            const result = extractResultForHubSpot(text);
            const noteBody = `AutoFlow Result\n\nPrompt: ${prompt}\n\n${result}`;
            const res = await createHubSpotNote(creds.apiKey, noteBody, creds.chatId || undefined);
            if (!res.ok) console.error("[HubSpot] Failed:", res.error);
          } else {
            console.warn("[HubSpot] Incomplete — needs Private App Token in credentials");
          }
        } catch (err) {
          console.error("[HubSpot] Error:", err);
        }
      }
    },
  });

  return { runId, stream };
}

export async function cancelRun(runId: string, userId: string): Promise<void> {
  try {
    await prisma.engineRun.updateMany({
      where: { id: runId, userId, status: "RUNNING" },
      data: { status: "CANCELLED" },
    });
  } catch {
    // Ignore
  }
}

export async function getRunHistory(userId: string, limit = 10) {
  return prisma.engineRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      prompt: true,
      status: true,
      output: true,
      mods: true,
      createdAt: true,
    },
  });
}
