import { NextResponse } from 'next/server';
import { fetchDailyNews } from '@/lib/agent/tools/newsFetcher';
import { sendTelegramMessage } from '@/lib/integrations/telegram';

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

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn("⚠️ Missing Telegram credentials. News fetched but not sent.");
      return NextResponse.json({ message: "News fetched, but missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID." }, { status: 200 });
    }

    const { ok, description } = await sendTelegramMessage(botToken, chatId, message);

    if (!ok) {
      throw new Error(`Telegram API Error: ${description}`);
    }

    console.log("✅ News successfully dispatched to Telegram.");
    return NextResponse.json({ message: "News successfully sent to Telegram!" }, { status: 200 });
  } catch (error) {
    console.error("❌ Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
