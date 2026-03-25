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
