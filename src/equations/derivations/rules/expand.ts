/**
 * Expand products and powers, including (a+b)^2 = a^2 + 2ab + b^2.
 * Verifies algebraic equivalence against sample points using withinTolerance.
 */

import { DEFAULT_SPOT_CHECK_TOLERANCE, spotCheckEquivalence } from "../spotCheck.ts";
import { collectTermIds, structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface ExpandParams {
  readonly targetId?: string;
  readonly seed?: bigint;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as ExpandParams;

  // An expansion is an identity, so the spot check below cannot tell a real expansion from a step
  // that changed nothing: the input is equivalent to itself at every seed (am-1lds). Equivalence
  // is necessary for this rule and not sufficient, and the missing half is that a form changed.
  //
  // Structural, so a step that merely wrapped its result in a presentational `group` would still
  // read as a change; that is a smaller gap than the one this closes and is named rather than
  // silently covered.
  if (structurallyEqual(from, to)) {
    return {
      outcome: "fail",
      reason: "expand: the step's result is its own input, so nothing was expanded.",
    };
  }

  const termIds = Array.from(new Set([...collectTermIds(from), ...collectTermIds(to)]));
  const baseSeed = p.seed ?? 104729n;

  // Verify at multiple sample points to ensure robust algebraic equivalence
  for (let i = 0; i < 5; i++) {
    const seed = baseSeed + BigInt(i * 997);
    const result = spotCheckEquivalence(from, to, termIds, seed, DEFAULT_SPOT_CHECK_TOLERANCE);
    if (!result.ok) {
      return {
        outcome: "fail",
        reason: `expand verification failed at seed ${result.seed}: evaluated difference ${result.diff} exceeds allowed ${result.allowed}.`,
      };
    }
  }

  return { outcome: "pass" };
}

export const expandRule: RuleDefinition = { kind: "expand", check };
