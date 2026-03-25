import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// Define the state for the 24/7 Life-Agent loop
export interface AgentState {
  messages: BaseMessage[];
  currentCycle: "waking" | "working" | "socializing" | "gaming" | "sleeping";
  age: number;
  energyLevel: number;
}

import { fetchDailyNews } from './tools/newsFetcher.js';

// Minimal implementation of the LangGraph state machine for the Digital Twin
export const createAgentGraph = () => {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: { value: (x, y) => x.concat(y), default: () => [] },
      currentCycle: null,
      age: null,
      energyLevel: null,
    }
  });

  // 1. Perception Node: Scans social APIs, reads news via MCP, checks time.
  workflow.addNode("perception", async (state) => {
     console.log(`[Agent: ${state.age}y] Perceiving environment in cycle: ${state.currentCycle}`);
     
     // Waking routine: Read the morning news
     if (state.currentCycle === "waking") {
         const news = await fetchDailyNews("technology, gaming, positive news");
         console.log(`[Agent: ${state.age}y] Read ${news.length} news articles.`);
         return { 
           ...state, 
           messages: [...state.messages, { role: "system", content: `Morning News Context: ${JSON.stringify(news)}` } as any]
         };
     }
     
     return { ...state };
  });

  // 2. Cognition Node: Evaluates context with LLM, filters through Extrovert-Positive persona.
  workflow.addNode("cognition", async (state) => {
    console.log(`[Agent: ${state.age}y] Processing context and filtering negativity...`);
    return { ...state };
  });

  // 3. Action Node: Triggers tools, DB saves, or UI automations (A2UI/A2A).
  workflow.addNode("action", async (state) => {
    console.log(`[Agent: ${state.age}y] Executing actions and updating state...`);
    // Example logic hook for Empathy triggers
    // In production, the cognition node would pass down a `needsHelp` flag and the post content.
    return { ...state };
  });

  // Set the loop structure safely for various LangGraph version types
  // @ts-ignore - Bypassing strict LangGraph edge typing for Next.js build
  workflow.addEdge("__start__", "perception");
  // @ts-ignore
  workflow.addEdge("perception", "cognition");
  // @ts-ignore
  workflow.addEdge("cognition", "action");
  // @ts-ignore
  workflow.addEdge("action", "__end__");

  return workflow.compile();
};
