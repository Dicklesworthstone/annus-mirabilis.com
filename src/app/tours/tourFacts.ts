/**
 * WHAT THE INDEX SAYS ABOUT A PATH, DERIVED FROM WHICHEVER SOURCE OWNS IT (dispatch 397).
 *
 * THIS IS NOT A MERGE OF THE TWO SOURCES, and the distinction matters because merging them is a
 * design decision that needs the owner. The tours come from two places and keep doing so: one
 * content record under content/tours, read by requireTour, and four entries in the GUIDED_TOURS
 * catalogue in src/discovery/tours/catalogue.ts. This module takes whichever record the page
 * already holds and derives the few facts the index shows; neither source learns about the other,
 * no id is resolved across them, and the page still renders its two lists.
 *
 * WHAT EACH FACT IS READ FROM:
 *   - the stop or step count, from `steps` or `stops`, the arrays themselves;
 *   - what a reader DOES, from the catalogue stops' own `activity` field, in the order they occur
 *     and without repeats;
 *   - where the path begins, from the first stop's `href`;
 *   - for the record-backed path, its budget in minutes and the claim it ends at, which are
 *     `budgetMinutes` and `targetClaim`. The catalogue entries carry neither, and the index says
 *     nothing about timing for them rather than estimating one.
 */

export type TourFacts = Readonly<{
  stopCount: number;
  /** "read, experiment and explain", from the stops' own activity labels. Absent where unrecorded. */
  activities: string | undefined;
  /** Where the path starts, from the first stop's own href. Absent where unrecorded. */
  startHref: string | undefined;
  /** Minutes, for a path whose record carries a budget. */
  budgetMinutes: number | undefined;
  /** What a reader can say at the end, for a path whose record carries it. */
  targetClaim: string | undefined;
}>;

type Stopish = Readonly<{ activity?: unknown; href?: unknown }>;

function activityPhrase(stops: readonly Stopish[]): string | undefined {
  const seen: string[] = [];
  for (const stop of stops) {
    const activity = typeof stop.activity === "string" ? stop.activity : undefined;
    if (activity !== undefined && !seen.includes(activity)) seen.push(activity);
  }
  if (seen.length === 0) return undefined;
  if (seen.length === 1) return seen[0];
  return `${seen.slice(0, -1).join(", ")} and ${seen[seen.length - 1]}`;
}

export function tourFacts(
  units: readonly Stopish[],
  extras: Readonly<{ budgetMinutes?: number | undefined; targetClaim?: string | undefined }> = {},
): TourFacts {
  const first = units[0];
  return {
    stopCount: units.length,
    activities: activityPhrase(units),
    startHref: typeof first?.href === "string" ? first.href : undefined,
    budgetMinutes: extras.budgetMinutes,
    targetClaim: extras.targetClaim,
  };
}
