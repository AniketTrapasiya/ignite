import { NextRequest, NextResponse } from 'next/server';
import { basePersona } from '@/lib/agent/persona';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * Month 6 - Week 21: Backend "Agent Vitals" Endpoints
 * Exposes the Digital Twin's internal status to the React Dashboard.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  let userId = "guest";

  if (token) {
    try {
      const decoded = await verifyToken(token);
      if (typeof decoded !== 'string') userId = decoded.userId;
    } catch(e) {}
  }

  const vitals = {
    userId,
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
