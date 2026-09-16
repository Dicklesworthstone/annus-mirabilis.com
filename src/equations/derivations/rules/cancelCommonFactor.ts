/** Cancel a common factor from a quotient's numerator and denominator, recording the nonzero condition. */

import type { Expression } from "../../ast.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface CancelCommonFactorParams {
  readonly factor: Expression;
  readonly nonzeroCondition: string;
}

function factorsOf(side: Expression): readonly Expression[] {
  return side.kind === "product" ? side.args : [side];
}

function removeOneFactor(side: Expression, factor: Expression): Expression | null {
  const factors = factorsOf(side);
  const index = factors.findIndex((f) => structurallyEqual(f, factor));
  const remaining = factors.slice(0, index).concat(factors.slice(index + 1));
  if (remaining.length === 0) return null;
  const first = remaining[0];
  return remaining.length === 1 && first ? first : { kind: "product", args: remaining };
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as CancelCommonFactorParams;
  if (!p.nonzeroCondition?.trim()) {
    return {
      outcome: "fail",
      reason: "cancel-common-factor requires a nonzeroCondition for the cancelled factor.",
    };
  }
  if (from.kind !== "quotient") {
    return { outcome: "fail", reason: 'cancel-common-factor requires "from" to be a quotient.' };
  }
  const reducedNumerator = removeOneFactor(from.numerator, p.factor);
  const reducedDenominator = removeOneFactor(from.denominator, p.factor);
  if (!reducedNumerator || !reducedDenominator) {
    return {
      outcome: "fail",
      reason: "the cited factor does not appear in both the numerator and the denominator.",
    };
  }
  const expected: Expression = {
    kind: "quotient",
    numerator: reducedNumerator,
    denominator: reducedDenominator,
  };
  if (!structurallyEqual(to, expected)) {
    return {
      outcome: "fail",
      reason: 'cancelling the cited factor from "from" does not produce "to".',
    };
  }
  return { outcome: "pass" };
}

export const cancelCommonFactorRule: RuleDefinition = { kind: "cancel-common-factor", check };
