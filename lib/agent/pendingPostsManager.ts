import { prisma } from '@/lib/prisma';

export interface PendingPost {
  id: string;
  userId: string;
  platform: 'linkedin' | 'twitter';
  targetUrl: string;
  content: string;
  timestamp: number;
}

export const savePendingPost = async (post: Omit<PendingPost, 'id' | 'timestamp'>): Promise<string> => {
  const result = await prisma.agentDraft.create({
    data: {
      userId: post.userId,
      platform: post.platform,
      targetUrl: post.targetUrl,
      content: post.content,
    }
  });

  return result.id;
};

export const getLatestPendingPost = async (userId: string): Promise<PendingPost | null> => {
  const post = await prisma.agentDraft.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });

  if (!post) return null;
  return {
    ...post,
    platform: post.platform as 'linkedin' | 'twitter',
    timestamp: post.createdAt.getTime()
  };
};

export const getAllPendingPosts = async (userIdStr?: string): Promise<PendingPost[]> => {
  const posts = await prisma.agentDraft.findMany({
    where: userIdStr ? { userId: userIdStr, status: 'pending' } : { status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });

  return posts.map(p => ({
    ...p,
    platform: p.platform as 'linkedin' | 'twitter',
    timestamp: p.createdAt.getTime()
  }));
};

export const updatePendingPost = async (id: string, newContent: string) => {
  await prisma.agentDraft.update({
    where: { id },
    data: { content: newContent }
  });
};

export const clearPendingPost = async (id: string) => {
  await prisma.agentDraft.update({
    where: { id },
    data: { status: 'rejected' } // Or delete it if preferred
  });
};
