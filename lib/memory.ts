import { prisma } from "./prisma";
import { Pinecone } from "@pinecone-database/pinecone";

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
}

// ── Short-term: PostgreSQL ──────────────────────────────────────────────

export async function getMemories(userId: string): Promise<MemoryItem[]> {
  return prisma.engineMemory.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, content: true, tags: true, pinned: true, createdAt: true },
  });
}

export async function createMemory(
  userId: string,
  title: string,
  content: string,
  tags: string[] = []
): Promise<MemoryItem> {
  const memory = await prisma.engineMemory.create({
    data: { userId, title, content, tags },
    select: { id: true, title: true, content: true, tags: true, pinned: true, createdAt: true },
  });

  // Push to Pinecone async (non-blocking; silently fails if not configured)
  upsertToPinecone(memory.id, userId, title, content).catch(() => null);

  return memory;
}

export async function deleteMemory(id: string, userId: string): Promise<void> {
  await prisma.engineMemory.deleteMany({ where: { id, userId } });
}

export async function togglePin(id: string, userId: string, pinned: boolean): Promise<void> {
  await prisma.engineMemory.updateMany({ where: { id, userId }, data: { pinned } });
}

// ── Long-term: Pinecone ─────────────────────────────────────────────────

function getPineconeClient(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) return null;
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

/**
 * Embed text via OpenAI-compatible API.
 * Requires OPENAI_API_KEY env var. Returns empty array if unavailable.
 */
async function getEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) return [];
  const json = await res.json() as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? [];
}

async function upsertToPinecone(
  id: string,
  userId: string,
  title: string,
  content: string
): Promise<void> {
  const pc = getPineconeClient();
  if (!pc) return;
  try {
    const vector = await getEmbedding(`${title}\n${content}`);
    if (vector.length === 0) return; // No embedding available
    const index = pc.index(process.env.PINECONE_INDEX_NAME ?? "autoflow-memory");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (index as any).upsert([
      {
        id,
        values: vector,
        metadata: { userId, title, content: content.slice(0, 500) },
      },
    ]);
    await prisma.engineMemory.update({ where: { id }, data: { pineconeId: id } });
  } catch {
    // Silent fail — Pinecone is optional
  }
}

export async function searchMemories(
  userId: string,
  query: string,
  topK = 5
): Promise<MemoryItem[]> {
  const pc = getPineconeClient();

  if (pc && process.env.OPENAI_API_KEY) {
    try {
      const vector = await getEmbedding(query);
      if (vector.length > 0) {
        const index = pc.index(process.env.PINECONE_INDEX_NAME ?? "autoflow-memory");
        const results = await index.query({
          vector,
          topK,
          filter: { userId },
          includeMetadata: true,
        });
        const ids = results.matches.map((m) => m.id);
        if (ids.length > 0) {
          return prisma.engineMemory.findMany({
            where: { id: { in: ids }, userId },
            select: { id: true, title: true, content: true, tags: true, pinned: true, createdAt: true },
          });
        }
      }
    } catch {
      // Fall through to keyword search
    }
  }

  // Fallback: keyword search in Postgres
  return prisma.engineMemory.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: topK,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, content: true, tags: true, pinned: true, createdAt: true },
  });
}

// ── Format memories for injection into agent context ────────────────────

export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (memories.length === 0) return "";
  return (
    "[MEMORY CONTEXT]\n" +
    memories.map((m, i) => `${i + 1}. ${m.title}:\n${m.content}`).join("\n\n")
  );
}
