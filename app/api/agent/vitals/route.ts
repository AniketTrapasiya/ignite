import { NextResponse } from 'next/server';
import { basePersona } from '@/lib/agent/persona';

/**
 * Month 6 - Week 21: Backend "Agent Vitals" Endpoints
 * Exposes the Digital Twin's internal status to the React Dashboard.
 */
export async function GET() {
  // In production, this would query Neo4j and Pinecone to calculate dynamic stats
  // For the initial launch, we read from the core memory and synthesize the vitals
  const vitals = {
    name: basePersona.name,
    currentAge: basePersona.currentAge.toFixed(1), // e.g. "18.2"
    energyLevel: basePersona.energyLevel,
    mode: basePersona.energyLevel > 80 ? "Extrovert-Engaged" : "Deep-Reflection",
    livesImpacted: 1240, // People helped via Empathy Engine
    socialVisibility: "+12.4%", // Engagement growth tracking
    lastAction: "Posted motivational comment on LinkedIn",
    status: "Online - 24/7 Loop Active"
  };

  return NextResponse.json(vitals, { status: 200 });
}
