import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { prisma } from "./prisma";
import { formatMemoriesForPrompt, searchMemories } from "./memory";
import { buildModsContext, getActiveServices } from "./integrations";

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
  selectedMods: string[]
): Promise<{ runId: string; stream: ReturnType<typeof streamText> }> {
  // Load selected memories
  const allMemories = await searchMemories(userId, prompt, 5);
  const memories = selectedMemoryIds.length > 0
    ? allMemories.filter((m) => selectedMemoryIds.includes(m.id))
    : allMemories.slice(0, 3);

  // Load active mods (use provided selection or all connected)
  const activeServices = selectedMods.length > 0
    ? selectedMods
    : await getActiveServices(userId);

  // Build context
  const memoryContext = formatMemoriesForPrompt(memories);
  const modsContext = buildModsContext(activeServices);

  const fullSystemPrompt = [SYSTEM_PROMPT, memoryContext, modsContext]
    .filter(Boolean)
    .join("\n\n");

  // Create run record
  const run = await prisma.engineRun.create({
    data: {
      userId,
      prompt,
      memories: memories.map((m) => m.id),
      mods: activeServices,
      status: "RUNNING",
    },
  });

  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

  const stream = streamText({
    model: google("gemini-2.0-flash"),
    system: fullSystemPrompt,
    prompt,
    maxOutputTokens: 2048,
    onFinish: async ({ text }) => {
      await prisma.engineRun.update({
        where: { id: run.id },
        data: {
          output: text,
          status: "COMPLETED",
        },
      });
    },
  });

  return { runId: run.id, stream };
}

export async function cancelRun(runId: string, userId: string): Promise<void> {
  await prisma.engineRun.updateMany({
    where: { id: runId, userId, status: "RUNNING" },
    data: { status: "CANCELLED" },
  });
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
