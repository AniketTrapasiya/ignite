import { determineCurrentCycle } from './lib/agent/scheduler.js';
import { checkSystemFailsafes } from './lib/agent/failsafe.js';
import { postSocialComment } from './lib/agent/tools/socialWriter.js';
import dotenv from 'dotenv';
dotenv.config();

async function testMonth4() {
  console.log("==================================================");
  console.log("⚙️ TESTING 24/7 AUTONOMY & A2UI WRITES (MONTH 4)");
  console.log("==================================================\n");

  console.log("--- 1. 24/7 CIRCADIAN RHYTHM SCHEDULER ---");
  const testHours = [8, 14, 18, 21, 3];
  testHours.forEach(hour => {
    const cycle = determineCurrentCycle(hour);
    console.log(`Time: ${hour.toString().padStart(2, '0')}:00 -> Cycle: [${cycle.toUpperCase()}]`);
  });

  console.log("\n--- 2. SYSTEM FAILSAFES & LIMITS ---");
  console.log(`Testing normal operation (5 interactions today, Kill Switch OFF):`);
  let safe = await checkSystemFailsafes(5, false);
  console.log(`> Proceeding: ${safe ? "✅ YES" : "❌ NO"}`);

  console.log(`\nTesting interaction hard limit (21 interactions today, Kill Switch OFF):`);
  safe = await checkSystemFailsafes(21, false);
  console.log(`> Proceeding: ${safe ? "✅ YES" : "❌ NO"}`);

  console.log(`\nTesting Kill Switch override (3 interactions today, Kill Switch ON):`);
  safe = await checkSystemFailsafes(3, true);
  console.log(`> Proceeding: ${safe ? "✅ YES" : "❌ NO"}`);

  console.log("\n--- 3. A2UI WRITE PROTOCOLS & BOT EVASION ---");
  console.log("Attempting to post an empathetic comment via Playwright stealth browser...");
  const comment = "Sending you positive vibes! You are stronger than you realize. 🚀";
  
  // Target a neutral URL to safely test the headless launch, delay execution, and shutdown.
  const success = await postSocialComment('linkedin', 'https://example.com', comment);
  console.log(`> Playwright A2UI Action Successful: ${success ? "✅ Yes" : "❌ No"}`);

  console.log("\n==================================================");
  console.log("✅ MONTH 4 AUTONOMY TEST COMPLETE");
  console.log("==================================================");
}

testMonth4().catch(console.error);
