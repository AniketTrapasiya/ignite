import { NextResponse } from 'next/server';
import { fetchDailyNews } from '@/lib/agent/tools/newsFetcher';
import { sendTelegramMessage } from '@/lib/integrations/telegram';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  // Prevent unauthorized access if deployed to Vercel production
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("⏰ Daily Cron triggered: Fetching news for Telegram...");
    const news = await fetchDailyNews("technology and positive AI news");
    
    if (!news || news.length === 0) {
      return NextResponse.json({ message: "No news found today." }, { status: 200 });
    }

    let message = "🌟 <b>Daily Agent News Update</b> 🌟\n\n";
    news.forEach((n: any, idx: number) => {
      // Telegram HTML mode safe tags
      message += `${idx + 1}. <a href="${n.url}">${n.title}</a>\n`;
    });

    // Multi-Tenant Upgrade: Broadcast to all connected Telegram users
    const integrations = await prisma.integration.findMany({
      where: { service: 'telegram', status: 'connected' }
    });

    if (integrations.length === 0) {
      console.warn("⚠️ No connected Telegram users found in the database.");
      return NextResponse.json({ message: "No users to send news to." }, { status: 200 });
    }

    let sentCount = 0;
    for (const integration of integrations) {
      try {
        const decryptedCreds = decrypt(integration.credentials);
        const creds = JSON.parse(decryptedCreds);
        const botToken = creds.botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chatId = creds.chatId || creds.chat_id;

        if (botToken && chatId) {
          const { ok } = await sendTelegramMessage(botToken, chatId, message);
          if (ok) sentCount++;
        }
      } catch (e) {
        console.error(`Failed to dispatch news to user ${integration.userId}`, e);
      }
    }

    console.log(`✅ News successfully dispatched to ${sentCount} Telegram users.`);
    return NextResponse.json({ message: `Broadcasted to ${sentCount} users.` }, { status: 200 });
  } catch (error) {
    console.error("❌ Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
