import { nearestRankPercentile } from "../../src/testing/perfProfiles.ts";

export interface EventTimingEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  interactionId?: number;
}

export interface InteractionLatencyResult {
  interactionCount: number;
  p75LatencyMs: number;
  durationsAscending: readonly number[];
  overBudget: boolean;
  budgetMs: number;
}

export const INTERACTION_LATENCY_BUDGET_MS = 200;
export const MIN_INTERACTION_SAMPLES = 20;

/**
 * Evaluates interaction latency from Performance Event Timing entries:
 * 1. Groups entries by interactionId, taking each interaction's longest duration.
 * 2. Refuses fewer than 20 interaction samples.
 * 3. Computes p75 by nearest rank (for 20 sorted values, selects the 15th).
 * 4. Compares against the 200 ms budget.
 */
export function evaluateInteractionLatency(
  entries: readonly EventTimingEntry[],
  budgetMs: number = INTERACTION_LATENCY_BUDGET_MS,
  minSamples: number = MIN_INTERACTION_SAMPLES,
): InteractionLatencyResult {
  const maxDurationByInteraction = new Map<number, number>();
  let syntheticId = -1;

  for (const entry of entries) {
    // If interactionId is provided and > 0, group by it; otherwise treat as discrete interaction
    const id =
      entry.interactionId !== undefined && entry.interactionId > 0
        ? entry.interactionId
        : syntheticId--;
    const current = maxDurationByInteraction.get(id) ?? 0;
    if (entry.duration > current) {
      maxDurationByInteraction.set(id, entry.duration);
    }
  }

  const durations = Array.from(maxDurationByInteraction.values()).sort((a, b) => a - b);

  if (durations.length < minSamples) {
    throw new Error(
      `Evaluation refused: at least ${minSamples} interaction samples required, got ${durations.length}`,
    );
  }

  const p75 = nearestRankPercentile(durations, 0.75, minSamples);

  return {
    interactionCount: durations.length,
    p75LatencyMs: p75,
    durationsAscending: durations,
    overBudget: p75 > budgetMs,
    budgetMs,
  };
}
