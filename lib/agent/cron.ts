import { AgentState } from './orchestrator';

/**
 * Triggered at 23:59 every simulated day.
 * Extracts key learnings and relationships from the day's messages to prevent context overflow.
 */
export const runDailySummarization = async (state: AgentState): Promise<string> => {
  console.log(`[Cron: 23:59] Running daily summarization for Agent Age: ${state.age}`);
  
  if (state.messages.length === 0) {
    return "No significant events today.";
  }

  // In production, this would pass `state.messages` to an LLM with a prompt like:
  // "Summarize the key events, emotions, and people the agent interacted with today."
  const mockSummary = "Today I learned a lot about networking and made 3 new connections. Felt highly energetic and positive.";
  
  return mockSummary;
};
