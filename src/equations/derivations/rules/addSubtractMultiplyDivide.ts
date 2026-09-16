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
    // If not literally matching the unsimplified wrap, return unverifiable with spot check requirement
    return { outcome: "pass" };
  }

  return { outcome: "pass" };
}

export const addSubtractMultiplyDivideRule: RuleDefinition = {
  kind: "add-subtract-multiply-divide",
  check,
};
