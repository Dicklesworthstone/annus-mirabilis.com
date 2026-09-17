/**
 * Selects what a screen reader announces for one accepted snapshot (am-read-result-weave-jex:
 * "single announcement per accepted snapshot"). Pure: the reader surface owns the live region,
 * this only decides which flag (if any) is newly lit since the previous derived result.
 */
import type { WeaveDerived, WeaveFlag } from "./types.ts";

/**
 * Returns the single flag that newly transitioned to lit this snapshot (was unlit or absent
 * before, is lit now), or undefined when nothing newly lit. When more than one predicate lights
 * on the same snapshot, the first by predicate id wins -- a snapshot announces once, not once
 * per predicate.
 */
export function selectAnnouncement(
  previous: WeaveDerived | undefined,
  next: WeaveDerived,
): WeaveFlag | undefined {
  const ids = Object.keys(next.flags).sort();
  for (const id of ids) {
    const nextFlag = next.flags[id];
    if (!nextFlag?.lit) continue;
    const previousFlag = previous?.flags[id];
    if (!previousFlag?.lit) return nextFlag;
  }
  return undefined;
}

/**
 * Enforces "at most one outside-selected-domain predicate expanded per face": given every
 * currently-lit outside-selected-domain flag for a face, returns the id of the one that may be
 * shown expanded (the first by predicate id), or undefined when none is lit. Every other lit
 * outside-selected-domain flag on the same face stays collapsed to a pointer only.
 */
export function selectExpandedOutsideDomain(
  litOutsideDomainFlags: readonly WeaveFlag[],
): string | undefined {
  const sorted = [...litOutsideDomainFlags]
    .filter((f) => f.lit && f.meaning === "outside-selected-domain")
    .sort((a, b) => a.predicateId.localeCompare(b.predicateId));
  return sorted[0]?.predicateId;
}
