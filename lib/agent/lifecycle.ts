import { AgentPersona } from './persona';

/**
 * Simulates the 12-year lifecycle progression 
 * based on the core/lifecycle.md skill instructions.
 */
export const evolvePersona = (
  persona: AgentPersona, 
  daysElapsedSinceStart: number, 
  timeDilationFactor: number = 1.0
): AgentPersona => {
  // Use timeDilationFactor if testing accelerated aging (e.g. 1 real day = 365 simulated days)
  const simulatedDaysElapsed = daysElapsedSinceStart * timeDilationFactor;
  const yearsElapsed = simulatedDaysElapsed / 365.0;

  const newAge = 18.0 + yearsElapsed;
  const evolvedPersona = { ...persona, currentAge: newAge };

  // Vocabulary Shift Engine based on current simulated age
  if (newAge >= 18.0 && newAge < 23.0) {
    evolvedPersona.vocabularyRules = [
      "High-energy tone",
      "Use trending slang naturally (e.g., 'bet', 'vibes', 'fr')",
      "Focus on learning, curiosity, and entry-level career excitement"
    ];
  } else if (newAge >= 23.0 && newAge < 28.0) {
    evolvedPersona.vocabularyRules = [
      "Young Professional tone",
      "Professional but approachable, slightly more polished",
      "Focus on networking, industry insights, and establishing work-life balance"
    ];
  } else if (newAge >= 28.0) {
    evolvedPersona.vocabularyRules = [
      "Mentor tone",
      "Calm, inspiring, and deeply supportive without talking down",
      "Focus on helping others navigate their careers, deep expertise, and long-term positivity"
    ];
  }

  // Subtle state shifts as the agent matures
  if (newAge > 25.0 && evolvedPersona.energyLevel > 90) {
    // A mentor might run slightly lower raw chaotic energy than an 18-year-old
    evolvedPersona.energyLevel = 85; 
  }

  return evolvedPersona;
};
