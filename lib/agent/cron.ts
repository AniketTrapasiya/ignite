import { prisma } from '@/lib/prisma';

/**
 * Triggered at 23:59 every simulated day.
 * Extracts key learnings and relationships from the day's messages to prevent context overflow.
 */
export const runDailySummarization = async (userId: string): Promise<string> => {
  console.log(`[Cron: 23:59] Running daily summarization for User: ${userId}`);
  
  // 1. Fetch today's memories for this user
  const today = new Date();
  today.setHours(0,0,0,0);

  const memories = await prisma.engineMemory.findMany({
    where: {
      userId,
      createdAt: { gte: today }
    }
  });

  if (memories.length === 0) {
    return "No significant events today.";
  }

  // 2. Logic to summarize (In production, call an LLM)
  const contentToSummarize = memories.map(m => m.content).join("\n");
  const mockSummary = `Summarized ${memories.length} events: The agent processed various tasks and refined its memory graph.`;
  
  return mockSummary;
};
