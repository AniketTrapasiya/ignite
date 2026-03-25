import { NextResponse } from 'next/server';
import { getAllPendingPosts, updatePendingPost, clearPendingPost, getLatestPendingPost } from '@/lib/agent/pendingPostsManager';
import { executePlaywrightPublish } from '@/lib/agent/tools/socialWriter';
import { sendTelegramMessage } from '@/lib/integrations/telegram';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId'); 
    if (!userId) return NextResponse.json({ posts: [] });
    const posts = await getAllPendingPosts(userId);
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch pending posts' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, action, newContent, userId = '123' } = await req.json();

    if (action === 'update') {
      await updatePendingPost(id, newContent);
      return NextResponse.json({ success: true, message: 'Draft updated successfully' });
    }

    if (action === 'reject') {
      await clearPendingPost(id);
      return NextResponse.json({ success: true, message: 'Draft discarded' });
    }

    if (action === 'approve') {
      // If we provided newContent, auto update it before publishing just in case
      if (newContent) {
        await updatePendingPost(id, newContent);
      }

      // We need to fetch it to get the platform/url
      const allPosts = await getAllPendingPosts(userId);
      const post = allPosts.find(p => p.id === id);

      if (!post) {
        return NextResponse.json({ error: 'Post not found in queue' }, { status: 404 });
      }

      // Execute physically
      const success = await executePlaywrightPublish(post.platform, post.targetUrl, post.content);
      
      if (success) {
        await clearPendingPost(id);
        
        // Let's also sync Telegram to let the user know it was approved via Dashboard
        try {
          const integration = await prisma.integration.findUnique({
             where: { userId_service: { userId, service: 'telegram' } }
          });
          if (integration) {
            const decryptedCreds = decrypt(integration.credentials);
            const creds = JSON.parse(decryptedCreds);
            const botToken = creds.botToken || process.env.TELEGRAM_BOT_TOKEN;
            const chatId = creds.chatId || creds.chat_id;
            
            if (botToken && chatId) {
               await sendTelegramMessage(botToken, chatId, `✅ Notice: Draft for ${post.platform} was approved manually via the Web Dashboard and successfully published!`);
            }
          }
        } catch(e) {
          console.error("Dashboard notification failed:", e);
        }

        return NextResponse.json({ success: true, message: 'Published successfully!' });
      } else {
        return NextResponse.json({ error: 'Playwright execution failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
