import { getVectorIndex } from './memory';
import { calculateMemoryWeight } from './memoryWeight';

export interface AgentMemory {
  id: string;
  text: string;
  tags: string[];         // e.g. ["Emotion: Joy", "Age: 18.2"]
  timestampMs: number;
}

/**
 * Archives a daily summary or significant event to the Vector DB (Pinecone).
 * In a real implementation, we would use an embedding model (e.g., OpenAI embeddings)
 * to convert `text` into a vector before upserting.
 */
export const archiveMemory = async (memory: AgentMemory, embeddingVector: number[]) => {
  const index = getVectorIndex(process.env.PINECONE_INDEX_NAME || 'life-agent-memory');

  // @ts-ignore - Pinecone client typing mismatch in this version's UpsertOptions
  await index.upsert([{
    id: memory.id,
    values: embeddingVector,
    metadata: {
      text: memory.text,
      tags: memory.tags,
      timestampMs: memory.timestampMs
    }
  }]);

  console.log(`[Memory Archive] Successfully archived memory ID: ${memory.id}`);
};
