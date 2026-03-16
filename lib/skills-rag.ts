/**
 * lib/skills-rag.ts
 * Namespace-based Pinecone operations for Skill Accelerator RAG.
 *
 * Each user's learning data is stored in a dedicated Pinecone namespace
 * named `skills-{userId}` on the shared index — no new index is created.
 * This isolates data per user without relying on metadata filters.
 */
import { Pinecone } from "@pinecone-database/pinecone";

// ── Pinecone client ──────────────────────────────────────────────────────────

function getPinecone(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) return null;
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

function getIndexName(): string {
  return process.env.PINECONE_INDEX_NAME ?? "autoflow-memory";
}

// ── Embedding helper ─────────────────────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { embedding: number[] }[] };
        return json.data[0]?.embedding ?? [];
      }
    } catch {
      // fall through to Gemini
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
          }),
        }
      );
      if (res.ok) {
        const json = (await res.json()) as { embedding: { values: number[] } };
        return json.embedding?.values ?? [];
      }
    } catch {
      // silent fail
    }
  }

  return [];
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface LearningContext {
  content: string;
  day: number;
  topic: string;
  score: number;
  challengeTitle: string;
}

// ── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Store a completed challenge submission in the user's namespace.
 * Called automatically after each challenge submission.
 */
export async function upsertLearningEntry(
  userId: string,
  entryId: string,
  goalTitle: string,
  day: number,
  topic: string,
  challengeTitle: string,
  submission: string,
  feedback: string,
  score: number
): Promise<void> {
  const pc = getPinecone();
  if (!pc) return;

  try {
    const snippet = `Day ${day} | ${topic}: ${challengeTitle}\nWhat I did: ${submission.slice(0, 350)}\nFeedback: ${feedback.slice(0, 250)}\nScore: ${score}/100`;
    const vector = await getEmbedding(`${goalTitle} ${topic} ${challengeTitle} ${snippet}`);
    if (vector.length === 0) return;

    const ns = pc.index(getIndexName()).namespace(`skills-${userId}`);
    await ns.upsert({
      records: [
        {
          id: entryId,
          values: vector,
          metadata: {
            goalTitle,
            day,
            topic,
            challengeTitle,
            content: snippet.slice(0, 500),
            score,
            type: "skill-learning",
          },
        },
      ],
    } as Parameters<typeof ns.upsert>[0]);
  } catch {
    // Pinecone is optional — don't block the main flow
  }
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Retrieve the most relevant past learning entries for a question.
 * Returns empty array when Pinecone is not configured.
 */
export async function queryLearningContext(
  userId: string,
  question: string,
  topK = 6
): Promise<LearningContext[]> {
  const pc = getPinecone();
  if (!pc || !(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)) return [];

  try {
    const vector = await getEmbedding(question);
    if (vector.length === 0) return [];

    const ns = pc.index(getIndexName()).namespace(`skills-${userId}`);
    const results = await ns.query({ vector, topK, includeMetadata: true });

    return results.matches
      .filter((m) => m.score !== undefined && m.score > 0.5)
      .map((m) => ({
        content: (m.metadata?.content as string) ?? "",
        day: (m.metadata?.day as number) ?? 0,
        topic: (m.metadata?.topic as string) ?? "",
        score: (m.metadata?.score as number) ?? 0,
        challengeTitle: (m.metadata?.challengeTitle as string) ?? "",
      }));
  } catch {
    return [];
  }
}

// ── Namespace stats ───────────────────────────────────────────────────────────

/**
 * Fetch aggregate namespace statistics (vector count) for the user.
 * Used to show the user how much learning data they have stored.
 */
export async function getLearningVectorCount(userId: string): Promise<number> {
  const pc = getPinecone();
  if (!pc) return 0;

  try {
    const ns = pc.index(getIndexName()).namespace(`skills-${userId}`);
    const stats = await ns.describeIndexStats();
    return stats.totalRecordCount ?? 0;
  } catch {
    return 0;
  }
}
