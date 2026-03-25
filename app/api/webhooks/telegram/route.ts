import { NextResponse } from 'next/server';
import { getLatestPendingPost, clearPendingPost } from '@/lib/agent/pendingPostsManager';
import { executePlaywrightPublish } from '@/lib/agent/tools/socialWriter';
import { sendTelegramMessage } from '@/lib/integrations/telegram';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/**
 * Handles incoming webhooks from Telegram.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Safety check for Telegram structure
    const message = body?.message;
    if (!message || !message.text || !message.chat) {
      return NextResponse.json({ status: "Ignored" }, { status: 200 });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim().toLowerCase();

    // Find which user this Telegram chat actually belongs to!
    const integrations = await prisma.integration.findMany({
      where: { service: 'telegram', status: 'connected' }
    });

    let matchedUserId: string | null = null;
    let botToken = process.env.TELEGRAM_BOT_TOKEN;

    for (const integration of integrations) {
      try {
        const decryptedCreds = decrypt(integration.credentials);
        const creds = JSON.parse(decryptedCreds);
        if (creds.chatId === chatId || creds.chat_id === chatId) {
          matchedUserId = integration.userId;
          if (creds.botToken) botToken = creds.botToken;
          break;
        }
      } catch(e) {}
    }

    if (!matchedUserId) {
      console.log(`[Webhook] Unrecognized Telegram chatId: ${chatId}`);
      return NextResponse.json({ status: "Ignored: Unrecognized user" });
    }

    // Check if user is saying "ok" or "publish"
    if (text === 'ok' || text === 'publish' || text === 'approve') {
      
      const pending = await getLatestPendingPost(matchedUserId);
      if (!pending) {
        if (botToken) await sendTelegramMessage(botToken, chatId, "❌ No pending agent drafts found in your queue.");
        return NextResponse.json({ status: "No pending posts" });
      }

      if (botToken) await sendTelegramMessage(botToken, chatId, `🤖 Agent is taking control of the browser... publishing to ${pending.platform} now!`);

      // 1. Physically execute the Playwright automation
      const success = await executePlaywrightPublish(pending.platform, pending.targetUrl, pending.content);
      
      if (success) {
        // 2. Remove from pending queue
        await clearPendingPost(pending.id);
        if (botToken) await sendTelegramMessage(botToken, chatId, `✅ Successfully published the comment! The agent has returned to standby.`);
      } else {
        if (botToken) await sendTelegramMessage(botToken, chatId, `⚠️ Playwright automation failed. Please check server logs and the target URL validity.`);
      }

    } else {
      // Ignore other messages, or add command logic here
      if (botToken) await sendTelegramMessage(botToken, chatId, "I only understand 'OK' to approve your latest pending Agent draft.");
    }

    return NextResponse.json({ status: "Success" });
  } catch (err: any) {
    console.error("Telegram Webhook Error:", err.stack);
    return NextResponse.json({ error: "Webhook parsing failed: " + err.message + "\n" + err.stack }, { status: 500 });
  }
}
