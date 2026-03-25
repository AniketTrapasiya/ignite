import { runGamingStreamLoop } from './lib/agent/streamObserver.js';
import { basePersona } from './lib/agent/persona.js';

async function testMonth5() {
  console.log("==================================================");
  console.log("🎥 TESTING LIVE STREAMING & VOICE ENGINE (MONTH 5)");
  console.log("==================================================\n");

  console.log("--- 1. TWITCH / YOUTUBE STREAM LOOP ---");
  console.log("Starting a simulated 3-tick gameplay loop for the 18-year-old persona...\n");

  // Run the gaming loop simulate vision ingestion, physical keystrokes, and TTS output
  await runGamingStreamLoop(basePersona.currentAge);

  console.log("\n==================================================");
  console.log("✅ MONTH 5 STREAMING ENGINE TEST COMPLETE");
  console.log("==================================================");
}

testMonth5().catch(console.error);
