/**
 * Week 16: System Failsafes Setup
 * Global configuration preventing runaway LLM queries and API bill shock.
 */
export const checkSystemFailsafes = async (interactionsToday: number, isKillSwitchEngaged: boolean) => {
  const HARD_LIMIT_INTERACTIONS = 20; // Prevent spam/bot bans
  
  if (isKillSwitchEngaged) {
    console.error("🛑 CRITICAL: Global Kill Switch is active. Agent is paralyzed by admin.");
    return false; // Deny execution
  }

  if (interactionsToday >= HARD_LIMIT_INTERACTIONS) {
    console.warn(`🛑 WARNING: Agent hit daily interaction limit (${HARD_LIMIT_INTERACTIONS}). Entering forced sleep.`);
    return false; // Deny execution
  }

  return true; // Safe to proceed
};
