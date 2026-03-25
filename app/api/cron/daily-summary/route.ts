import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runDailySummarization } from '@/lib/agent/cron';

export async function GET(request: Request) {
  // Check authorization header for Vercel Cron
  const { searchParams } = new URL(request.url);
  const cronKey = request.headers.get('Authorization');
  
  if (process.env.VERCEL_ENV === 'production' && cronKey !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true }
    });

    const results = [];
    for (const user of users) {
      const summary = await runDailySummarization(user.id);
      results.push({ userId: user.id, name: user.name, summary });
    }

    return NextResponse.json({ success: true, processed: results.length, details: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
