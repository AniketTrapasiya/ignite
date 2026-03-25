import { AgentState } from './orchestrator.js';

/**
 * Week 15: The 24/7 Daily Loop Integration
 * Maps the agent's internal cycle state based on the local time.
 * Prevents continuous API pinging by establishing human-like "Wake/Sleep" boundaries.
 */
export const determineCurrentCycle = (currentHour: number): AgentState['currentCycle'] | "sleeping" => {
  // 08:00 - 09:00 Waking Up (Reads news)
  if (currentHour >= 8 && currentHour < 9) return "waking";
  
  // 09:00 - 17:00 Working (LinkedIn professional networking)
  if (currentHour >= 9 && currentHour < 17) return "working";
  
  // 17:00 - 20:00 Socializing (Checking feeds, empathy protocol triggers)
  if (currentHour >= 17 && currentHour < 20) return "socializing";
  
  // 20:00 - 23:00 Gaming/Live (Twitch streaming setup)
  if (currentHour >= 20 && currentHour < 23) return "gaming";
  
  // 23:00 - 08:00 Sleeping (Deep reflection, memory archiving)
  return "sleeping";
};
