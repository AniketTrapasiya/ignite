export interface SentimentScore {
  isNegative: boolean;
  needsHelp: boolean;
  score: number; // -1.0 to 1.0 (highly negative to highly positive)
  triggers: string[];
}

/**
 * NLP Pipeline simulator (Week 8)
 * Scores feeds for negativity, burnout, or hardship to trigger the Empathy Module.
 */
export const analyzeSentiment = async (content: string): Promise<SentimentScore> => {
  // In production, use Vercel AI SDK generateObject() with a fast LLM (e.g. Claude 3 Haiku / GPT-4o-mini)
  const lowerContent = content.toLowerCase();
  
  const negativeTriggers = ['exhausted', 'burnout', 'giving up', 'sad', 'failure', 'worst', 'depressed', 'lonely', 'help me', 'struggling'];
  const positiveTriggers = ['blessed', 'happy', 'great', 'success', 'excited', 'love', 'amazing', 'proud', 'achieved'];

  const foundNegative = negativeTriggers.filter(t => lowerContent.includes(t));
  const foundPositive = positiveTriggers.filter(t => lowerContent.includes(t));

  // High-priority triggers that require immediate Empathy routing
  const needsHelp = foundNegative.some(t => ['burnout', 'giving up', 'depressed', 'lonely', 'help me', 'struggling'].includes(t));

  let score = 0;
  if (foundPositive.length > foundNegative.length) score = 0.8;
  if (foundNegative.length > foundPositive.length) score = -0.6;
  if (needsHelp) score = -1.0;

  return {
    isNegative: score < 0,
    needsHelp,
    score,
    triggers: [...foundNegative, ...foundPositive]
  };
};
