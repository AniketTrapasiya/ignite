import { Pinecone } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';

// Initialize Pinecone Client lazily so it doesn't crash environments without keys
let pineconeClient: Pinecone | null = null;
export const getPinecone = () => {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is missing from environment variables.");
    }
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

export const getVectorIndex = (indexName: string) => {
  return getPinecone().index(indexName);
};

// Initialize Neo4j Driver for Graph Database (Relational memory - people, concepts)
export const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://localhost',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

export const closeNeo4j = async () => {
  await neo4jDriver.close();
};

export const saveMemory = async (content: string, tags: string[], userId: string = "123") => {
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  
  let vector: number[];
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: content,
        model: "text-embedding-3-small"
      })
    });
    
    const embedData = await response.json();
    if (!embedData.data || !embedData.data[0]) {
        throw new Error("OpenAI Embedding Failed. Falling back to zero-vector for connectivity test.");
    }
    vector = embedData.data[0].embedding;
  } catch (e) {
    console.warn("⚠️ Embedding fallback triggered:", e);
    // 1536 dimensions is standard for text-embedding-3-small
    vector = new Array(1536).fill(0);
  }
  
  const memoryId = "mem_" + Date.now();
  
  // 2. Save Semantic Memory to Pinecone
  // Make sure Pinecone has an index named exactly as below or mapped to env variable
  const indexName = process.env.PINECONE_INDEX || "ignite-memory";
  const pinecone = getPinecone();
  const index = pinecone.index(indexName); 
  
  // @ts-ignore bypassing strict Pinecone typing
  await index.upsert([
    {
      id: memoryId,
      values: vector,
      metadata: { content, tags: tags.join(","), userId, timestamp: Date.now() }
    }
  ]);
  
  // 3. Save Relational Memory to Neo4j
  const session = neo4jDriver.session();
  try {
    await session.run(
      `
      MERGE (u:User {id: $userId})
      CREATE (m:Memory {id: $memoryId, content: $content, timestamp: timestamp()})
      CREATE (u)-[:REMEMBERS]->(m)
      WITH m
      UNWIND $tags AS tag
      MERGE (t:Concept {name: tag})
      CREATE (m)-[:RELATES_TO]->(t)
      `,
      { userId, memoryId, content, tags }
    );
  } finally {
    await session.close();
  }
  
  return memoryId;
};
