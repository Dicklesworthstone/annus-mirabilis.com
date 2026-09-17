/**
 * Groups Misconception entries by the result cards they concern (am-read-misconception-
 * callouts-a3o): "On the results face, each result card lists the misconceptions linked to it
 * ... Entries without a result appear inline and in the paper list only."
 */
import type { Misconception } from "../../content/schemas/argument.ts";

export function collectForResults(
  misconceptions: readonly Misconception[],
): ReadonlyMap<string, readonly Misconception[]> {
  const byResult = new Map<string, Misconception[]>();
  for (const m of misconceptions) {
    for (const resultId of m.resultIds) {
      const existing = byResult.get(resultId);
      if (existing) existing.push(m);
      else byResult.set(resultId, [m]);
    }
  }
  return new Map([...byResult.entries()].map(([k, v]) => [k, Object.freeze(v)]));
}

/** Entries with no resultIds at all -- shown only inline and in the paper-level list. */
export function withoutAResult(misconceptions: readonly Misconception[]): readonly Misconception[] {
  return Object.freeze(misconceptions.filter((m) => m.resultIds.length === 0));
}

/** The paper-level list: every entry for one paper, in declaration order. Used by the results
 * face's paper-level list, independent of the per-result grouping above. */
export function forPaper(
  misconceptions: readonly Misconception[],
  paper: string,
): readonly Misconception[] {
  return Object.freeze(misconceptions.filter((m) => m.paper === paper));
}
