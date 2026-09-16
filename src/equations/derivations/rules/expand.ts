/**
 * Expand products and powers, including (a+b)^2 = a^2 + 2ab + b^2.
 * Verifies algebraic equivalence against sample points using withinTolerance.
 */

import { DEFAULT_SPOT_CHECK_TOLERANCE, spotCheckEquivalence } from "../spotCheck.ts";
import { collectTermIds } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface ExpandParams {
  readonly targetId?: string;
  readonly seed?: bigint;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as ExpandParams;
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
