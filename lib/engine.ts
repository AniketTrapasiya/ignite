import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { prisma } from "./prisma";
import { formatMemoriesForPrompt, searchMemories } from "./memory";
import { buildModsContext, getActiveServices, getCredentials } from "./integrations";
import { sendTelegramMessage, extractResultForTelegram } from "./integrations/telegram";

const SYSTEM_PROMPT = `You are AutoFlow — an intelligent automation engine.
You are powerful, precise, and execution-focused.
When given a task you:
1. Break it into clear numbered steps
2. Execute each step (or describe what you would do with the available tools)
3. Log every action with prefix: STEP: your message
4. When complete output: RESULT: final summary
5. If an error occurs output: ERROR: what failed and why

Be thorough but concise. Think like an automation engineer.`;

export async function runEngine(
  userId: string,
  prompt: string,
  selectedMemoryIds: string[],
  selectedMods: string[],
  modelId = "gemini-2.0-flash"
): Promise<{ runId: string; stream: ReturnType<typeof streamText> }> {
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

  // Select AI model — Anthropic for claude-*, Google for everything else
  const validModelId = modelId.startsWith("models/") ? modelId.replace("models/", "") : modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiModel: any;
  if (validModelId.startsWith("claude-")) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    aiModel = anthropic(validModelId);
  } else {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
    aiModel = google(validModelId);
  }

  const stream = streamText({
    model: aiModel,
    system: fullSystemPrompt,
    prompt,
    maxOutputTokens: 4096,
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

      // Send to Telegram if it's an active mod
      if (activeServices.includes("telegram")) {
        try {
          const creds = await getCredentials(userId, "telegram");
          if (creds?.apiKey && creds?.chatId) {
            const message = extractResultForTelegram(text);
            await sendTelegramMessage(
              creds.apiKey,
              creds.chatId,
              `🤖 <b>AutoFlow Result</b>\n\n${message}`
            );
          }
        } catch {
          // Silent — Telegram is optional
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
