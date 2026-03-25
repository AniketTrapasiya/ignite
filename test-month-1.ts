import dotenv from 'dotenv';
dotenv.config();

import { createAgentGraph } from './lib/agent/orchestrator.js';
import { basePersona, getSystemPrompt } from './lib/agent/persona.js';
import { evolvePersona } from './lib/agent/lifecycle.js';
import { calculateMemoryWeight } from './lib/agent/memoryWeight.js';
import { runDailySummarization } from './lib/agent/cron.js';
import { archiveMemory } from './lib/agent/memoryArchive.js';

async function testMonth1GrowthEngine() {
  console.log("==========================================");
  console.log("🚀 TESTING 12-YEAR GROWTH ENGINE (MONTH 1)");
  console.log("==========================================\n");

  // 1. Initial State
  console.log("--- 1. INITIAL 18-YEAR-OLD PERSONA ---");
  const initialPrompt = getSystemPrompt(basePersona);
  console.log(initialPrompt.substring(0, 300) + "...\n");

  // 2. Lifecycle Evolution (Aging by 5 years to age 23)
  console.log("--- 2. LIFECYCLE EVOLUTION (SIMULATING 5 YEARS LATER) ---");
  const daysPassed = 5 * 365; 
  const evolvedPersona = evolvePersona(basePersona, daysPassed);
  console.log(`Agent aged from ${basePersona.currentAge} to ${evolvedPersona.currentAge}`);
  console.log("New Vocabulary Focus:", evolvedPersona.vocabularyRules.join(" | "));
  console.log("\nEvolved System Prompt Preview:\n" + getSystemPrompt(evolvedPersona).substring(0, 300) + "...\n");

  // 3. Memory Weighting (Decay simulation)
  console.log("--- 3. MEMORY SEMANTIC WEIGHTING ---");
  const currentTime = Date.now();
  const sixMonthsAgo = currentTime - (180 * 24 * 60 * 60 * 1000);
  const fiveYearsAgo = currentTime - (5 * 365 * 24 * 60 * 60 * 1000);
  
  const weightRecent = calculateMemoryWeight(sixMonthsAgo, currentTime);
  const weightOld = calculateMemoryWeight(fiveYearsAgo, currentTime);
  console.log(`Weight for 6-month-old memory (Recent): ${weightRecent.toFixed(2)} (x2.0 standard)`);
  console.log(`Weight for 5-year-old memory (Fading):  ${weightOld.toFixed(2)} (decay applied)\n`);

  // 4. LangGraph Orchestration with Evolved State
  console.log("--- 4. LANGGRAPH ORCHESTRATION ---");
  const app = createAgentGraph();
  const state: any = {
    messages: [
      { role: "user", content: "Had a great streaming session today!" },
      { role: "user", content: "Networked with 5 new LinkedIn connections." }
    ],
    currentCycle: "socializing",
    age: evolvedPersona.currentAge,
    energyLevel: evolvedPersona.energyLevel
  };
  
  const finalState = await app.invoke(state);
  console.log(`Graph executed. Final Age in state: ${finalState.age}\n`);

  // 5. Daily Summarization & Archiving
  console.log("--- 5. DAILY CRON SUMMARIZATION & ARCHIVING ---");
  // @ts-ignore
  const summary = await runDailySummarization(finalState);
  console.log("Cron Generated Summary:\n", summary);

  console.log("\nAttempting to archive to Pinecone Vector DB...");
  // Dummy embedding vector (OpenAI's text-embedding-3-small creates 1536 dims usually)
  const mockVector = new Array(1536).fill(0.1); 
  
  if (!process.env.PINECONE_API_KEY) {
    console.log("⚠️  PINECONE_API_KEY not found in .env.");
    console.log("Please add your key to .env and run this test again to verify DB connection.");
  } else {
    try {
      await archiveMemory({
        id: `memory_${Date.now()}`,
        text: summary,
        tags: [`Age: ${evolvedPersona.currentAge}`, "Emotion: Positive"],
        timestampMs: Date.now()
      }, mockVector);
    } catch (error) {
      console.error("❌ Failed to connect or upsert to Pinecone. Check API key and Index dimension:", error);
    }
  }

  console.log("\n==========================================");
  console.log("✅ MONTH 1 GROWTH ENGINE TEST COMPLETE");
  console.log("==========================================");
}

testMonth1GrowthEngine().catch(console.error);
