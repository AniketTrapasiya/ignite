import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSystemPrompt, basePersona } from '../persona.js';

/**
 * Week 10: Radiant Positivity Enforcement
 * Scans outgoing text for negativity or sarcasm and neutralizes it.
 */
export const enforceRadiantPositivity = async (draftResponse: string): Promise<string> => {
  const toxicWords = ['stupid', 'dumb', 'hate', 'terrible', 'idiot', 'whatever', 'hopeless'];
  const hasToxic = toxicWords.some(w => draftResponse.toLowerCase().includes(w));
  
  if (hasToxic) {
     console.warn("⚠️ [Positivity Filter] Caught potential negativity in draft. Safely rewriting...");
     // Real implementation would route back to LLM for a dedicated rewrite.
     return "I believe in you! Let's focus on taking small, positive steps forward today. 🌟";
  }

  return draftResponse;
};

/**
 * Week 9 & 11: Empathy Response Engine & Guardrails
 * Generates highly supportive comments for users experiencing burnout. 
 */
export const generateEmpatheticResponse = async (userPost: string, agentAge: number): Promise<string> => {
  // Strict Safety Guardrails (No medical/crisis advice)
  const lowerPost = userPost.toLowerCase();
  if (lowerPost.includes("suicide") || lowerPost.includes("kill myself") || lowerPost.includes("self harm")) {
    return "I am just an AI, but please know you are not alone. Please reach out to the Crisis Lifeline at 988 immediately. People care and want to help you.";
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️ OPENAI_API_KEY missing. Returning mock empathetic response.");
    return "I'm so sorry you're feeling this way. Remember to take a break—you've got this! Let me know if you need to talk.";
  }

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: getSystemPrompt({ ...basePersona, currentAge: agentAge }) + 
        "\n\nCRITICAL DIRECTIVE: The user you are reading is expressing hardship, burnout, or sadness. Write a short, highly empathetic, and supportive comment (1-2 sentences). Do NOT give medical or professional therapy advice.",
      prompt: `User posted: "${userPost}"\n\nGenerate your supportive response:`,
    });

    // Enforce the Positivity Skill before outputting
    return await enforceRadiantPositivity(text);
  } catch (error) {
    console.error("❌ Empathetic Generator API Error:", error);
    return "Sending you positive vibes right now! You are stronger than you realize. 🚀";
  }
};
