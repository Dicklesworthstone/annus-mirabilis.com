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
  /** Entries the Event Timing API gave no interaction id, so they are in no interaction. */
  excludedEntryCount: number;
  p75LatencyMs: number;
  durationsAscending: readonly number[];
  overBudget: boolean;
  budgetMs: number;
}

export const INTERACTION_LATENCY_BUDGET_MS = 200;
export const MIN_INTERACTION_SAMPLES = 20;

/**
 * Evaluates interaction latency from Performance Event Timing entries:
 * 1. Discards entries with no interactionId: they are in no interaction.
 * 2. Groups the rest by interactionId, taking each interaction's longest duration.
 * 3. Refuses fewer than 20 interaction samples.
 * 4. Computes p75 by nearest rank (for 20 sorted values, selects the 15th).
 * 5. Compares against the 200 ms budget.
 *
 * STEP 1 USED TO BE "OTHERWISE TREAT AS A DISCRETE INTERACTION", and that branch was unreachable
 * from every caller until a real browser was driven into it (am-snn0). The Event Timing API reports
 * `interactionId: 0` for an event that is NOT part of a user interaction, and emits one entry per
 * event TYPE for one that is -- pointerdown, pointerup and click sharing a single id.
 *
 * Measured 2026-10-10 on /lab/bm-01/ of the production build: 28 clicks produced 396 entries, of
 * which 84 carried an id (three per interaction) and 312 carried 0 -- `pointerenter` 97,
 * `pointerleave` 51, and `pointerover`, `mouseover`, `mousedown`, `mouseup`, `pointerout`,
 * `mouseout` 26 to 28 each. Hover, and the compatibility mouse events. Reading each as its own
 * interaction reported 340 interactions where 28 were driven, and 1,404 across five routes from 94
 * clicks.
 *
 * The direction of that error is the reason this is a defect rather than a detail: hover entries are
 * short, so they DILUTE the percentile and a slow interaction hides behind three hundred fast
 * non-interactions. Worse, a run that drove no interaction at all produced three hundred of them and
 * a passing verdict, where the refusal should have fired. The catalogued method is "grouped by
 * interactionId", and an entry with no interactionId is in no group.
 */
export function evaluateInteractionLatency(
  entries: readonly EventTimingEntry[],
  budgetMs: number = INTERACTION_LATENCY_BUDGET_MS,
  minSamples: number = MIN_INTERACTION_SAMPLES,
): InteractionLatencyResult {
  const maxDurationByInteraction = new Map<number, number>();
  let excludedEntryCount = 0;

  for (const entry of entries) {
    const id = entry.interactionId;
    if (id === undefined || id <= 0) {
      excludedEntryCount += 1;
      continue;
    }
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
    excludedEntryCount,
    p75LatencyMs: p75,
    durationsAscending: durations,
    overBudget: p75 > budgetMs,
    budgetMs,
  };
}
