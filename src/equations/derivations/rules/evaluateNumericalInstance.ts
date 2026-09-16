/**
 * Evaluate a numerical instance of an algebraic expression given specific variable bindings.
 */

import { type ToleranceSpec, withinTolerance } from "../../../units/tolerance.ts";
import { evaluateExpression } from "../spotCheck.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface EvaluateNumericalInstanceParams {
  readonly bindings: Readonly<Record<string, number>>;
  readonly tolerance?: ToleranceSpec;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as EvaluateNumericalInstanceParams;
  if (!p.bindings || typeof p.bindings !== "object") {
    return { outcome: "fail", reason: "evaluate-numerical-instance requires a bindings object." };
  }

  try {
    const fromVal = evaluateExpression(from, p.bindings);
    const toVal = evaluateExpression(to, p.bindings);
    const tolerance = p.tolerance ?? { relative: 1e-10, absolute: 1e-12 };
    const verdict = withinTolerance(fromVal, toVal, tolerance);
    if (!verdict.ok) {
      return {
        outcome: "fail",
        reason: `numerical evaluation mismatch: diff ${verdict.diff} exceeds allowed ${verdict.allowed}.`,
      };
    }
    return { outcome: "pass" };
  } catch (err) {
    return {
      outcome: "fail",
      reason: `numerical evaluation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const evaluateNumericalInstanceRule: RuleDefinition = {
  kind: "evaluate-numerical-instance",
  check,
};
