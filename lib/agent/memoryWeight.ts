/**
 * Memory weighting utility to prioritize memories based on their "simulated" age.
 * Memories formed within the last simulated year are given higher priority during RAG retrieval.
 */
export const calculateMemoryWeight = (
  memoryTimestampMs: number, 
  currentSimulatedTimestampMs: number
): number => {
  const oneSimulatedYearMs = 365 * 24 * 60 * 60 * 1000;
  const memoryAgeMs = currentSimulatedTimestampMs - memoryTimestampMs;

  // Base weight is 1.0. Memories within the last simulated year get a 2.0 priority multiplier.
  if (memoryAgeMs <= oneSimulatedYearMs) {
    return 2.0;
  } else {
    // Gradually decay weight for older memories (simulating human fading memory)
    const yearsOld = memoryAgeMs / oneSimulatedYearMs;
    // Cap decay so old events are not completely forgotten (min 0.5)
    return Math.max(0.5, 1.0 / yearsOld);
  }
};
