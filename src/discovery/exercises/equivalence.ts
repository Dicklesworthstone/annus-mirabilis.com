/**
 * Numerical equivalence over deterministic sample points
 * (am-disc-exercise-checker-i4h2), reported with an honest label: agreement
 * at sampled points, never a proof.
 *
 * KNOWN, DISCLOSED GAP: the bead specifies TWO deterministic point sets --
 * a fixed, checked-in Halton sequence for coverage, and a second,
 * per-exercise set drawn from the TypeScript Philox port
 * (am-fs-philox-ts-port-7kp) for unpredictability, because the Halton
 * sequence alone is a published, fixed grid: its first 16 base-2 points
 * are all m/32, so a periodic function like sin(32*pi*x) can vanish on
 * every one of them (to about 1.08e-14) while differing from the true
 * reference by a full unit just off the grid. This module implements the
 * Halton set only -- the Philox integration (a registered exercise stream
 * kernel id, a SHA-256-derived seed per exercise part) is real integration
 * work this pass does not do. equivalence.test.ts's
 * "known-gap-not-a-success" test proves this checker is currently fooled
 * by that exact construction, so the gap is demonstrated, not hidden.
 */

import { type ToleranceSpec, withinTolerance } from "../../units/tolerance";
import { evaluate } from "./evaluate";
import type { Expr } from "./grammar";
import { type Domain, haltonPoints } from "./samplePoints";

export type EquivalenceOutcome =
  | Readonly<{ status: "equivalent"; acceptedPointCount: number; label: string }>
  | Readonly<{
      status: "not-equivalent";
      point: Readonly<Record<string, number>>;
      readerValue: number;
      referenceValue: number;
    }>
  | Readonly<{ status: "could-not-compare"; reason: string }>;

const CANDIDATE_POOL = 64;
const TARGET_ACCEPTED = 16;
const MIN_ACCEPTED = 12;

/**
 * Checks `reader` against `reference` over `domains` at up to
 * `TARGET_ACCEPTED` Halton points accepted from a pool of `CANDIDATE_POOL`
 * candidates (a candidate is skipped, not counted, when either side is
 * nonfinite or undefined there). `tolerance` is the part's declared
 * combined absolute/relative spec, compared through
 * `src/units/tolerance.ts`, never a bespoke `Math.abs` check.
 */
export function checkEquivalence(
  reader: Expr,
  reference: Expr,
  domains: Readonly<Record<string, Domain>>,
  tolerance: ToleranceSpec,
): EquivalenceOutcome {
  const candidates = haltonPoints(domains, CANDIDATE_POOL);
  const accepted: Array<Readonly<Record<string, number>>> = [];
  for (const point of candidates) {
    if (accepted.length >= TARGET_ACCEPTED) break;
    const readerResult = evaluate(reader, point);
    const referenceResult = evaluate(reference, point);
    if (readerResult.status !== "value" || referenceResult.status !== "value") continue;
    accepted.push(point);
    if (!withinTolerance(readerResult.value, referenceResult.value, tolerance).ok) {
      return {
        status: "not-equivalent",
        point,
        readerValue: readerResult.value,
        referenceValue: referenceResult.value,
      };
    }
  }
  if (accepted.length < MIN_ACCEPTED) {
    return {
      status: "could-not-compare",
      reason: `Only ${accepted.length} of ${CANDIDATE_POOL} candidate points fell inside both expressions' domain; at least ${MIN_ACCEPTED} are needed to compare.`,
    };
  }
  return {
    status: "equivalent",
    acceptedPointCount: accepted.length,
    label:
      `Numerically equivalent at ${accepted.length} Halton points in the stated ranges. ` +
      "This is a numerical check, not a proof.",
  };
}
