/**
 * Collect like terms in a sum or algebraic expression.
 * Verifies algebraic equivalence against sample points using withinTolerance.
 */

import { DEFAULT_SPOT_CHECK_TOLERANCE, spotCheckEquivalence } from "../spotCheck.ts";
import { collectTermIds, structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface CollectParams {
  readonly variable?: string;
  readonly seed?: bigint;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as CollectParams;
  // The same gap `expand` had, in the same code (am-1lds, repaired there on 2026-10-14): an
  // equivalence spot check cannot tell a real collection from a step that changed nothing, because
  // the input is equivalent to itself at every seed. Equivalence is necessary for this rule and
  // not sufficient, and the missing half is that a form changed. Found 2026-10-16 by probing the
  // whole library rather than the rule sites the chains happen to use.
  if (structurallyEqual(from, to)) {
    return {
      outcome: "fail",
      reason: "collect: the step's result is its own input, so nothing was collected.",
    };
  }

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
