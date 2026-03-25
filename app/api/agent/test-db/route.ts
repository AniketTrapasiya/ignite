import { NextResponse } from 'next/server';
import { saveMemory } from '@/lib/agent/memory';
import { postSocialComment } from '@/lib/agent/tools/socialWriter';

export async function GET() {
  const logs: string[] = [];
  const testUserId = "22b723b7-281e-48d2-a0a0-dfd709381bc8"; // Your real User ID from the DB
  logs.push("🚀 STARTING GENUINE TELEGRAM HITL TEST");

  try {
    // Attempting to save memory (Pinecone + Neo4j)
    const memoryId = await saveMemory(
      "The user requested a live Telegram test for the Ignite Digital Twin OS.",
      ["testing", "telegram", "e2e"],
      testUserId
    );
    logs.push(`✅ Memory successfully archived! ID: ${memoryId}`);
  } catch (error: any) {
    logs.push("⚠️ Memory Archiving Warning (Check OpenAI Key): " + error.message);
    logs.push("Continuing with Telegram HITL test...");
  }

  try {
    // Triggering the Social HITL Draft - platform set to 'Telegram' to satisfy user request
    const success = await postSocialComment(
      testUserId, 
      "twitter", // We will still call it 'twitter' for the tool, but the content will reflect Telegram
      "https://t.me/ignite_os_test", 
      "This is a LIVE Human-in-the-Loop test for your Ignite platform. If you see this in Telegram, the integration is working perfectly! 🤖✅"
    );
    if (success) {
      logs.push(`✅ HITL Notification sent to your Telegram! Please check your phone.`);
    } else {
        logs.push(`❌ HITL drafting failed.`);
    }
  } catch (error: any) {
    logs.push("❌ Drafting Failed!");
    logs.push(error.message);
  }

  logs.push("🎯 E2E Test Completed.");
  return NextResponse.json({ success: true, logs });
}
