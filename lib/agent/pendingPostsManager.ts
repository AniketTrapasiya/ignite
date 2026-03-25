import fs from 'fs';
import path from 'path';

export interface PendingPost {
  id: string;
  userId: string;
  platform: 'linkedin' | 'twitter';
  targetUrl: string;
  content: string;
  timestamp: number;
}

const DB_PATH = path.join(process.cwd(), 'pending_posts.json');

// Initialize local cache file if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([]));
}

export const savePendingPost = async (post: Omit<PendingPost, 'id' | 'timestamp'>): Promise<string> => {
  const id = `post_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const fullPost: PendingPost = { ...post, id, timestamp: Date.now() };

  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  data.push(fullPost);
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

  return id;
};

export const getLatestPendingPost = async (userIdStr: string): Promise<PendingPost | null> => {
  let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  data = data.filter((p: PendingPost) => p.userId === userIdStr);
  if (data.length === 0) return null;
  return data[data.length - 1];
};

export const getAllPendingPosts = async (userIdStr?: string): Promise<PendingPost[]> => {
  let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (userIdStr) {
    data = data.filter((p: PendingPost) => p.userId === userIdStr);
  }
  return data;
};

export const updatePendingPost = async (id: string, newContent: string) => {
  let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const idx = data.findIndex((p: PendingPost) => p.id === id);
  if (idx !== -1) {
    data[idx].content = newContent;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }
};

export const clearPendingPost = async (id: string) => {
  let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  data = data.filter((p: PendingPost) => p.id !== id);
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};
