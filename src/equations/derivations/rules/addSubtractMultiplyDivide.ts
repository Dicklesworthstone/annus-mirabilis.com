/**
 * Add, subtract, multiply, or divide both sides of a relation, recording nonzero conditions for division.
 */

import type { Expression } from "../../ast.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export type ArithmeticOperation = "add" | "subtract" | "multiply" | "divide";

export interface AddSubtractMultiplyDivideParams {
  readonly operation: ArithmeticOperation;
  readonly quantity: Expression;
  readonly nonzeroCondition?: string;
}

function applyOperation(
  side: Expression,
  op: ArithmeticOperation,
  quantity: Expression,
): Expression {
  switch (op) {
    case "add":
      return { kind: "sum", args: [side, quantity] };
    case "subtract":
      return { kind: "sum", args: [side, { kind: "negate", argument: quantity }] };
    case "multiply":
      return { kind: "product", args: [side, quantity] };
    case "divide":
      return { kind: "quotient", numerator: side, denominator: quantity };
  }
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as AddSubtractMultiplyDivideParams;
  if (!p.operation) {
    return { outcome: "fail", reason: "add-subtract-multiply-divide requires an operation." };
  }
  if (!p.quantity) {
    return {
      outcome: "fail",
      reason: "add-subtract-multiply-divide requires a quantity to apply.",
    };
  }
  if (p.operation === "divide" && !p.nonzeroCondition?.trim()) {
    return { outcome: "fail", reason: "division requires a nonzeroCondition for the divisor." };
  }
  if (from.kind !== "relation" || to.kind !== "relation") {
    return {
      outcome: "fail",
      reason: "add-subtract-multiply-divide requires both from and to to be relations.",
    };
  }

  const expected: Expression = {
    kind: "relation",
    operator: from.operator,
    left: applyOperation(from.left, p.operation, p.quantity),
    right: applyOperation(from.right, p.operation, p.quantity),
  };

  if (!structurallyEqual(to, expected)) {
    /*
      THIS RETURNED `pass`, AND ITS OWN COMMENT SAID IT SHOULD NOT.
      The line read `return { outcome: "pass" }` under the comment "If not literally matching the
      unsimplified wrap, return unverifiable with spot check requirement", so BOTH branches passed
      and the rule read nothing. Measured 2026-10-16 by planting three results against a
      precondition-satisfying call of `a = b` divided by `t`: utter nonsense (`zzz = qqq`) passed,
      a `to` identical to `from` passed, and only a bare number failed -- on the relation
      precondition above, never on the transformation.

      It was invisible because blindToAWrongResult.test.ts drives the rule SITES the 19 chains
      contain, and 0 of their 41 steps use this rule, so the one blind check in the library was
      the one nothing exercised. The companion case in that file now drives every rule in the
      LIBRARY for exactly this reason.

      `unverifiable` is the honest outcome rather than `fail`, because an author legitimately
      writes the SIMPLIFIED result: dividing lambda = sqrt(2Dt) by t gives sqrt(2Dt)/t, which a
      reader should see as sqrt(2D/t). verifyChain treats unverifiable as "not machine-checked",
      and refuses a step that declares `verified` on it, so a simplified result now needs a spot
      check and review instead of being certified by a checker that never looked.
    */
    return {
      outcome: "unverifiable",
      reason:
        `applying ${p.operation} to both sides of "from" gives a result this check cannot match ` +
        "structurally, which is expected when the author writes the simplified form; it needs a " +
        "spot check and review rather than a machine verdict.",
    };
  }

  return { outcome: "pass" };
}

export const addSubtractMultiplyDivideRule: RuleDefinition = {
  kind: "add-subtract-multiply-divide",
  check,
};
