/**
 * Collect like terms in a sum or algebraic expression.
 * Verifies algebraic equivalence against sample points using withinTolerance.
 */

import { DEFAULT_SPOT_CHECK_TOLERANCE, spotCheckEquivalence } from "../spotCheck.ts";
import { collectTermIds } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface CollectParams {
  readonly variable?: string;
  readonly seed?: bigint;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as CollectParams;
  const termIds = Array.from(new Set([...collectTermIds(from), ...collectTermIds(to)]));
  const baseSeed = p.seed ?? 314159n;

  for (let i = 0; i < 5; i++) {
    const seed = baseSeed + BigInt(i * 997);
    const result = spotCheckEquivalence(from, to, termIds, seed, DEFAULT_SPOT_CHECK_TOLERANCE);
    if (!result.ok) {
      return {
        outcome: "fail",
        reason: `collect verification failed at seed ${result.seed}: evaluated difference ${result.diff} exceeds allowed ${result.allowed}.`,
      };
    }
  }

  return { outcome: "pass" };
}

export const collectRule: RuleDefinition = { kind: "collect", check };
